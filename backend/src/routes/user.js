const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const PasswordResetRequest = require("../models/passwordResetRequestModel");
const {
  authmiddleware,
  adminmiddleware,
  organizermiddleware,
  participantmiddleware,
} = require("../middleware/auth");

router.get("/", authmiddleware, (req, res) => {
  res.send("hello world");
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const existinguser = await User.findOne({ email });
    if (existinguser && existinguser.is_disabled) {
      return res
        .status(400)
        .json({ message: "Currently user is disabled by admin" });
    }
    if (!existinguser) {
      return res.status(400).json({ message: "Invalid Credentials" });
    } else {
      const compare = await bcrypt.compare(password, existinguser.password);
      console.log(existinguser);
      console.log(compare);
      if (!compare) {
        return res.status(400).json({ message: "Invalid Credentials" });
      }
      const token = jwt.sign(
        {
          userId: existinguser._id,
          role: existinguser.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      );

      return res.status(200).json({
        message: "User login successfully",
        token,
        role: existinguser.role,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const {
      email,
      password,
      first_name,
      last_name,
      participant_type,
      organisation_name,
      contact_number,
    } = req.body;
    if (
      !email ||
      !password ||
      !first_name ||
      !last_name ||
      !participant_type ||
      !organisation_name ||
      !contact_number
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const role = "participant";
    if (participant_type === "IIIT") {
      if (
        !email.endsWith("@students.iiit.ac.in") &&
        !email.endsWith("@research.iiit.ac.in")
      ) {
        return res.status(400).json({ message: "Invalid IIIT email address" });
      }
    }
    const existinguser = await User.findOne({ email });
    if (existinguser) {
      return res.status(400).json({ message: "User already exists" });
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({
        email,
        password: hashedPassword,
        role,
        first_name,
        last_name,
        participant_type,
        organisation_name,
        contact_number,
      });
      await newUser.save();
      return res.status(200).json({ message: "User login successfully", role });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Organizer password reset request (from login page - no auth required)
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, reason } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Find the organizer
    const organizer = await User.findOne({ email, role: "organizer" });
    if (!organizer) {
      // Don't reveal if email exists - return generic message
      return res
        .status(200)
        .json({
          message:
            "If this email belongs to an organizer account, admin will receive your request.",
        });
    }

    if (organizer.is_disabled) {
      return res
        .status(400)
        .json({ message: "This account is disabled. Contact admin." });
    }

    // Check for existing pending request
    const existing = await PasswordResetRequest.findOne({
      organizer: organizer._id,
      status: "pending",
    });

    if (existing) {
      return res
        .status(400)
        .json({
          message:
            "A password reset request is already pending for this account.",
        });
    }

    // Create new password reset request
    const request = new PasswordResetRequest({
      organizer: organizer._id,
      message: reason || "Forgot password",
    });
    await request.save();

    res
      .status(200)
      .json({
        message:
          "Password reset request sent to admin. You will receive an email once approved.",
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put(
  "/preferences",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { interests, followed_organizers } = req.body;
      if (interests && !Array.isArray(interests)) {
        return res
          .status(400)
          .json({ message: "Interests should be an array of strings" });
      }

      if (followed_organizers && !Array.isArray(followed_organizers)) {
        return res.status(400).json({
          message: "Followed organizers should be an array of organizer IDs",
        });
      }
      const updatedfields = {};
      updatedfields.interests = interests;
      updatedfields.followed_organizers = followed_organizers;
      const updatedData = await User.findByIdAndUpdate(
        req.user.userId,
        { $set: updatedfields },
        { $new: true },
      );
      res.status(200).json({
        message: "Preferences updated successfully",
        preferences: {
          interests: updatedData.interests,
          followed_organizers: updatedData.followed_organizers,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.get("/me", authmiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select(
      "email role participant_type first_name last_name organisation_name contact_number interests followed_organizers organizer_name category description contact_email discord_webhook_url",
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.put(
  "/profile",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { first_name, last_name, contact_number, organisation_name } =
        req.body || {};

      const updated = await User.findByIdAndUpdate(
        req.user.userId,
        {
          $set: {
            ...(first_name !== undefined ? { first_name } : {}),
            ...(last_name !== undefined ? { last_name } : {}),
            ...(contact_number !== undefined ? { contact_number } : {}),
            ...(organisation_name !== undefined ? { organisation_name } : {}),
          },
        },
        { new: true },
      ).select(
        "email participant_type first_name last_name organisation_name contact_number",
      );

      if (!updated) {
        return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ message: "Profile updated", user: updated });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

router.post(
  "/change-password",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};
      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ message: "Current and new password are required" });
      }
      if (String(newPassword).length < 6) {
        return res
          .status(400)
          .json({ message: "New password must be at least 6 characters" });
      }

      const user = await User.findById(req.user.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      user.password = await bcrypt.hash(String(newPassword), 10);
      await user.save();

      res.status(200).json({ message: "Password updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  },
);

module.exports = router;
