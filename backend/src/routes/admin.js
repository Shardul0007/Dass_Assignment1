const express = require("express");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { authmiddleware, adminmiddleware } = require("../middleware/auth");
const PasswordResetRequest = require("../models/passwordResetRequestModel");
const { sendPasswordResetEmail } = require("../utils/sendPasswordResetEmail");
const Event = require("../models/eventModel");
const Registration = require("../models/registrationModel");
const Ticket = require("../models/ticketModel");
const router = express.Router();

router.post(
  "/create-organizer",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const { organizer_name, category, description, contact_email, email } =
        req.body;
      if (
        !organizer_name ||
        !category ||
        !description ||
        !contact_email ||
        !email
      ) {
        return res
          .status(400)
          .json({ message: "All fields are required (including login email)" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Auto-generate password (10 characters)
      const rawPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      const unique = await User.findOne({ email });
      if (unique) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      }
      const newOrganizer = new User({
        email,
        password: hashedPassword,
        role: "organizer",
        organizer_name,
        category,
        description,
        contact_email,
      });
      await newOrganizer.save();

      // Send credentials email to organizer
      try {
        await sendPasswordResetEmail({
          to: email,
          subject: "Your Felicity Organizer Account Has Been Created",
          html: `
            <h2>Welcome to Felicity!</h2>
            <p>Your organizer account has been created by the admin.</p>
            <h3>Your Login Credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${rawPassword}</p>
            <p>Please login at the Felicity portal using this password.</p>
            <br/>
            <p>Best regards,<br/>Felicity Team</p>
          `,
        });
      } catch (emailErr) {
        console.log("Failed to send credentials email:", emailErr);
        // Continue even if email fails - organizer is created
      }

      res.status(201).json({
        message: "Organizer created successfully. Credentials sent to email.",
        email,
        password: rawPassword,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/disable-organizer/:id",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const organizer = await User.findById(req.params.id);
      if (!organizer) {
        return res.status(404).json({ message: "Organizer not found" });
      }
      if (organizer.role !== "organizer") {
        return res.status(400).json({ message: "User is not an organizer" });
      }
      organizer.is_disabled = true;
      await organizer.save();
      res.status(200).json({ message: "Organizer disabled successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/enable-organizer/:id",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const organizer = await User.findById(req.params.id);
      if (!organizer) {
        return res.status(404).json({ message: "Organizer not found" });
      }
      if (organizer.role !== "organizer") {
        return res.status(400).json({ message: "User is not an organizer" });
      }
      organizer.is_disabled = false;
      await organizer.save();
      res.status(200).json({ message: "Organizer enabled successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get("/organizers", authmiddleware, adminmiddleware, async (req, res) => {
  try {
    const organizers = await User.find({ role: "organizer" });
    res.status(200).json(organizers);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.patch(
  "/archive-organizer/:id",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const organizer = await User.findById(req.params.id);
      if (!organizer) {
        return res.status(404).json({ message: "Organizer not found" });
      }
      if (organizer.role !== "organizer") {
        return res.status(400).json({ message: "User is not an organizer" });
      }

      organizer.is_archived = true;
      organizer.archived_at = new Date();
      organizer.is_disabled = true;
      await organizer.save();
      res.status(200).json({ message: "Organizer archived successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/restore-organizer/:id",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const organizer = await User.findById(req.params.id);
      if (!organizer) {
        return res.status(404).json({ message: "Organizer not found" });
      }
      if (organizer.role !== "organizer") {
        return res.status(400).json({ message: "User is not an organizer" });
      }

      organizer.is_archived = false;
      organizer.archived_at = undefined;
      organizer.is_disabled = false;
      await organizer.save();
      res.status(200).json({ message: "Organizer restored successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.delete(
  "/delete-organizer/:id",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const organizerId = req.params.id;
      const organizer = await User.findById(organizerId);
      if (!organizer) {
        return res.status(404).json({ message: "Organizer not found" });
      }
      if (organizer.role !== "organizer") {
        return res.status(400).json({ message: "User is not an organizer" });
      }

      const events = await Event.find({ created_by: organizerId }).select(
        "_id",
      );
      const eventIds = events.map((e) => e._id);

      if (eventIds.length > 0) {
        await Registration.deleteMany({ event: { $in: eventIds } });
        await Ticket.deleteMany({ event: { $in: eventIds } });
        await Event.deleteMany({ _id: { $in: eventIds } });
      }

      await PasswordResetRequest.deleteMany({ organizer: organizerId });

      // Remove organizer from any participant follow lists
      await User.updateMany(
        { followed_organizers: organizerId },
        { $pull: { followed_organizers: organizerId } },
      );

      await User.deleteOne({ _id: organizerId });
      res.status(200).json({ message: "Organizer permanently deleted" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/password-reset-requests",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const requests = await PasswordResetRequest.find()
        .populate("organizer", "organizer_name email is_disabled")
        .sort({ createdAt: -1 });
      res.status(200).json(requests);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/password-reset-requests/:id/approve",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const request = await PasswordResetRequest.findById(
        req.params.id,
      ).populate("organizer");
      if (!request)
        return res.status(404).json({ message: "Request not found" });
      if (request.status !== "pending") {
        return res.status(400).json({ message: "Request already handled" });
      }

      const rawPassword = Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(rawPassword, 10);

      await User.findByIdAndUpdate(request.organizer._id, {
        password: hashedPassword,
      });

      request.status = "approved";
      request.handled_by = req.user.userId;
      request.handled_at = new Date();
      await request.save();

      let emailSent = false;
      try {
        await sendPasswordResetEmail({
          to: request.organizer.email,
          subject: "Password Reset Approved",
          html: `
              <h2>Password Reset Approved</h2>
              <p>Your organizer account password has been reset by Admin.</p>
              <p><b>New Password:</b> ${rawPassword}</p>
            `,
        });
        emailSent = true;
      } catch (emailErr) {
        console.log("Password reset approval email failed:", {
          message: emailErr?.message,
          code: emailErr?.code,
          response: emailErr?.response,
          responseCode: emailErr?.responseCode,
        });
      }

      res
        .status(200)
        .json({
          message: emailSent
            ? "Approved and emailed"
            : "Approved (email failed to send)",
          password: rawPassword,
          emailSent,
        });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/password-reset-requests/:id/reject",
  authmiddleware,
  adminmiddleware,
  async (req, res) => {
    try {
      const request = await PasswordResetRequest.findById(
        req.params.id,
      ).populate("organizer");
      if (!request)
        return res.status(404).json({ message: "Request not found" });
      if (request.status !== "pending") {
        return res.status(400).json({ message: "Request already handled" });
      }

      request.status = "rejected";
      request.handled_by = req.user.userId;
      request.handled_at = new Date();
      await request.save();

      let emailSent = false;
      try {
        await sendPasswordResetEmail({
          to: request.organizer.email,
          subject: "Password Reset Rejected",
          html: `
              <h2>Password Reset Rejected</h2>
              <p>Your password reset request was rejected by Admin.</p>
              <p>If you think this is a mistake, contact the admin team.</p>
            `,
        });
        emailSent = true;
      } catch (emailErr) {
        console.log("Password reset rejection email failed:", {
          message: emailErr?.message,
          code: emailErr?.code,
          response: emailErr?.response,
          responseCode: emailErr?.responseCode,
        });
      }

      res.status(200).json({
        message: emailSent
          ? "Rejected and emailed"
          : "Rejected (email failed to send)",
        emailSent,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

module.exports = router;
