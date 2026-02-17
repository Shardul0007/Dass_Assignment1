const express = require("express");
const Registration = require("../models/registrationModel");
const Event = require("../models/eventModel");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { authmiddleware, participantmiddleware } = require("../middleware/auth");
const router = express.Router();
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const Ticket = require("../models/ticketModel");
const sendTicketEmail = require("../utils/sendTicketEmail");
const User = require("../models/userModel");
const Feedback = require("../models/feedbackModel");
const DiscussionMessage = require("../models/discussionModel");

router.post(
  "/register-event",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { eventId, formResponse, team_name } = req.body;
      if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
      }

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: "Invalid Event ID" });
      }

      const check_event = await Event.findById(eventId);
      if (!check_event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (check_event.event_type !== "Normal") {
        return res
          .status(400)
          .json({ message: "Use merchandise purchase for Merchandise events" });
      }
      if (check_event.status !== "published") {
        return res
          .status(400)
          .json({ message: "Event is not open for registration" });
      }

      // Eligibility enforcement
      if (check_event.eligibility === "IIIT") {
        const user = await User.findById(req.user.userId).select(
          "participant_type",
        );
        if (!user || user.participant_type !== "IIIT") {
          return res
            .status(403)
            .json({ message: "Not eligible for this event" });
        }
      }

      if (new Date() > new Date(check_event.registration_deadline)) {
        return res
          .status(400)
          .json({ message: "Registration deadline has passed" });
      }

      if (check_event.registration_limit !== null) {
        const registered_count = await Registration.countDocuments({
          event: eventId,
          status: "registered",
        });
        if (registered_count >= check_event.registration_limit) {
          return res
            .status(400)
            .json({ message: "Event registration limit reached" });
        }
      }

      const alreadyRegistered = await Registration.exists({
        participant: req.user.userId,
        event: eventId,
        status: "registered",
      });
      if (alreadyRegistered) {
        return res
          .status(400)
          .json({ message: "Already registered for this event" });
      }

      const ticketId = `FEST-${uuidv4()}`;

      const user = await User.findById(req.user.userId).select(
        "first_name last_name email",
      );
      const qrPayloadObj = {
        ticketId,
        event: { id: String(check_event._id), name: check_event.name },
        participant: {
          id: String(req.user.userId),
          name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
          email: user?.email,
        },
      };
      const qrPayload = JSON.stringify(qrPayloadObj);
      const qrBase64 = await QRCode.toDataURL(qrPayload);

      // Custom form validation (only if organizer configured it)
      if (
        Array.isArray(check_event.custom_form) &&
        check_event.custom_form.length > 0
      ) {
        const resp =
          formResponse && typeof formResponse === "object" ? formResponse : {};
        for (const f of check_event.custom_form) {
          if (!f || !f.required) continue;
          const key = f.field_id || f.label;
          const v = resp[key];
          if (f.type === "file") {
            const file = v;
            if (!file || !file.dataBase64) {
              return res
                .status(400)
                .json({ message: `Missing required file: ${f.label}` });
            }
            if (String(file.dataBase64).length > 1_500_000) {
              return res
                .status(400)
                .json({ message: `File too large: ${f.label}` });
            }
          } else {
            if (v === undefined || v === null || String(v).trim() === "") {
              return res
                .status(400)
                .json({ message: `Missing required field: ${f.label}` });
            }
          }
        }
      }

      const newRegistration = new Registration({
        participant: req.user.userId,
        event: eventId,
        ticketId,
        status: "registered",
        payment_status: "paid",
        team_name: team_name ? String(team_name) : undefined,
        form_response:
          formResponse && typeof formResponse === "object"
            ? formResponse
            : undefined,
      });
      await newRegistration.save();

      const ticket = new Ticket({
        ticketId,
        participant: req.user.userId,
        event: eventId,
        qrData: qrPayload,
      });
      await ticket.save();

      await sendTicketEmail(user.email, ticketId, qrBase64, {
        eventName: check_event.name,
        participantName:
          `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
        participantEmail: user.email,
      });
      res.status(201).json({ message: "Registered for event successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.post(
  "/purchase-merchandise",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { eventId, size, color, quantity } = req.body;
      const qty = Number(quantity || 1);
      if (!eventId)
        return res.status(400).json({ message: "Event ID is required" });
      if (!Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }
      const event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.event_type !== "Merchandise") {
        return res
          .status(400)
          .json({ message: "Event is not a merchandise event" });
      }

      const allowedSizes = Array.isArray(event.item_details?.sizes)
        ? event.item_details.sizes
        : [];
      const allowedColors = Array.isArray(event.item_details?.colors)
        ? event.item_details.colors
        : [];
      if (allowedSizes.length > 0 && size && !allowedSizes.includes(size)) {
        return res.status(400).json({ message: "Invalid size" });
      }
      if (allowedColors.length > 0 && color && !allowedColors.includes(color)) {
        return res.status(400).json({ message: "Invalid color" });
      }
      if (event.status !== "published") {
        return res.status(400).json({ message: "Event is not open" });
      }
      if (new Date() > new Date(event.registration_deadline)) {
        return res
          .status(400)
          .json({ message: "Purchase deadline has passed" });
      }
      if (event.eligibility === "IIIT") {
        const userType = await User.findById(req.user.userId).select(
          "participant_type",
        );
        if (!userType || userType.participant_type !== "IIIT") {
          return res
            .status(403)
            .json({ message: "Not eligible for this event" });
        }
      }

      const stock = Number(event.item_details?.stock ?? 0);
      if (!Number.isFinite(stock) || stock <= 0) {
        return res.status(400).json({ message: "Out of stock" });
      }
      if (qty > stock) {
        return res.status(400).json({ message: "Not enough stock" });
      }

      const purchaseLimit = Number(event.item_details?.purchase_limit ?? 1);
      const existingRegs = await Registration.find({
        participant: req.user.userId,
        event: eventId,
      }).select("merch.quantity");
      const alreadyQty = existingRegs.reduce(
        (sum, r) => sum + Number(r?.merch?.quantity || 0),
        0,
      );
      if (alreadyQty + qty > purchaseLimit) {
        return res.status(400).json({ message: "Purchase limit exceeded" });
      }

      // decrement stock atomically
      const updated = await Event.findOneAndUpdate(
        { _id: eventId, "item_details.stock": { $gte: qty } },
        { $inc: { "item_details.stock": -qty } },
        { new: true },
      );
      if (!updated) {
        return res.status(400).json({ message: "Out of stock" });
      }

      const ticketId = `FEST-${uuidv4()}`;
      const user = await User.findById(req.user.userId).select(
        "first_name last_name email",
      );

      const qrPayloadObj = {
        ticketId,
        event: { id: String(updated._id), name: updated.name },
        participant: {
          id: String(req.user.userId),
          name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
          email: user?.email,
        },
        merchandise: { size, color, quantity: qty },
      };
      const qrPayload = JSON.stringify(qrPayloadObj);
      const qrBase64 = await QRCode.toDataURL(qrPayload);

      const reg = new Registration({
        participant: req.user.userId,
        event: eventId,
        ticketId,
        status: "registered",
        payment_status: "paid",
        merch: { size, color, quantity: qty },
      });
      await reg.save();

      const ticket = new Ticket({
        ticketId,
        participant: req.user.userId,
        event: eventId,
        qrData: qrPayload,
      });
      await ticket.save();

      await sendTicketEmail(user.email, ticketId, qrBase64, {
        eventName: updated.name,
        participantName:
          `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
        participantEmail: user.email,
      });

      res.status(201).json({ message: "Purchase successful", ticketId });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/my-events",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const registrations = await Registration.find({
        participant: req.user.userId,
        status: "registered",
      });
      if (registrations.length === 0) {
        return res.status(200).json([]);
      }
      const eventIds = registrations.map((reg) => reg.event);
      const events = await Event.find({ _id: { $in: eventIds } })
        .populate(
          "created_by",
          "organizer_name category description contact_email",
        )
        .sort({ start_date: 1 });
      res.status(200).json(events);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.delete(
  "/cancel-registration/:eventId",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const eventId = req.params.eventId;
      if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
      }

      if (!mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: "Invalid Event ID" });
      }

      if (!mongoose.Types.ObjectId.isValid(req.user.userId)) {
        return res.status(400).json({ message: "Invalid User ID" });
      }

      const participantObjectId = new mongoose.Types.ObjectId(req.user.userId);
      const eventObjectId = new mongoose.Types.ObjectId(eventId);

      const result = await Registration.updateMany(
        { participant: participantObjectId, event: eventObjectId },
        { $set: { status: "cancelled" } },
      );

      if (!result || result.matchedCount === 0) {
        return res.status(404).json({ message: "Registration not found" });
      }

      res.status(200).json({ message: "Registration cancelled successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/my-registrations",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const registrations = await Registration.find({
        participant: req.user.userId,
      }).populate("event");
      res.status(200).json(registrations);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/my-tickets",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const tickets = await Ticket.find({
        participant: req.user.userId,
      }).populate("event");
      res.status(200).json(tickets);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/tickets/:ticketId",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const ticket = await Ticket.findOne({ ticketId: req.params.ticketId })
        .populate("event")
        .populate("participant", "first_name last_name email participant_type");
      if (!ticket) return res.status(404).json({ message: "Ticket not found" });
      if (String(ticket.participant?._id) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const qrBase64 = await QRCode.toDataURL(ticket.qrData);
      res.status(200).json({ ticket, qrBase64 });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/trending-events",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const data = await Registration.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: "$event", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]);

      res.json(data);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// ==========================================
// Merchandise Payment Approval Workflow
// ==========================================

// Place merchandise order (payment proof required)
router.post(
  "/place-merchandise-order",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { eventId, size, color, quantity, paymentProofImage } = req.body;
      const qty = Number(quantity || 1);

      if (!eventId)
        return res.status(400).json({ message: "Event ID is required" });
      if (!paymentProofImage)
        return res
          .status(400)
          .json({ message: "Payment proof image is required" });
      if (!Number.isFinite(qty) || qty < 1) {
        return res.status(400).json({ message: "Invalid quantity" });
      }

      // Validate image size (max 2MB base64)
      if (paymentProofImage.length > 2_800_000) {
        return res
          .status(400)
          .json({ message: "Payment proof image too large (max 2MB)" });
      }

      const event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (event.event_type !== "Merchandise") {
        return res
          .status(400)
          .json({ message: "Event is not a merchandise event" });
      }

      const allowedSizes = Array.isArray(event.item_details?.sizes)
        ? event.item_details.sizes
        : [];
      const allowedColors = Array.isArray(event.item_details?.colors)
        ? event.item_details.colors
        : [];
      if (allowedSizes.length > 0 && size && !allowedSizes.includes(size)) {
        return res.status(400).json({ message: "Invalid size" });
      }
      if (allowedColors.length > 0 && color && !allowedColors.includes(color)) {
        return res.status(400).json({ message: "Invalid color" });
      }
      if (event.status !== "published") {
        return res.status(400).json({ message: "Event is not open" });
      }
      if (new Date() > new Date(event.registration_deadline)) {
        return res
          .status(400)
          .json({ message: "Purchase deadline has passed" });
      }
      if (event.eligibility === "IIIT") {
        const userType = await User.findById(req.user.userId).select(
          "participant_type",
        );
        if (!userType || userType.participant_type !== "IIIT") {
          return res
            .status(403)
            .json({ message: "Not eligible for this event" });
        }
      }

      const stock = Number(event.item_details?.stock ?? 0);
      if (!Number.isFinite(stock) || stock <= 0) {
        return res.status(400).json({ message: "Out of stock" });
      }
      if (qty > stock) {
        return res.status(400).json({ message: "Not enough stock" });
      }

      const purchaseLimit = Number(event.item_details?.purchase_limit ?? 1);
      const existingRegs = await Registration.find({
        participant: req.user.userId,
        event: eventId,
        status: { $nin: ["cancelled", "rejected"] },
      }).select("merch.quantity");
      const alreadyQty = existingRegs.reduce(
        (sum, r) => sum + Number(r?.merch?.quantity || 0),
        0,
      );
      if (alreadyQty + qty > purchaseLimit) {
        return res.status(400).json({ message: "Purchase limit exceeded" });
      }

      // Create registration with pending_approval status
      const reg = new Registration({
        participant: req.user.userId,
        event: eventId,
        status: "pending_approval",
        payment_status: "pending",
        merch_payment_status: "pending_approval",
        payment_proof_image: paymentProofImage,
        merch: { size, color, quantity: qty },
      });
      await reg.save();

      res.status(201).json({
        message: "Order placed. Awaiting payment approval from organizer.",
        registrationId: reg._id,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Get my pending merchandise orders
router.get(
  "/my-merch-orders",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const orders = await Registration.find({
        participant: req.user.userId,
        merch_payment_status: { $ne: "none" },
      })
        .populate("event", "name event_type registration_fee item_details")
        .sort({ createdAt: -1 });
      res.status(200).json(orders);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// ==========================================
// Anonymous Feedback System
// ==========================================

// Submit feedback for an attended event
router.post(
  "/feedback",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { eventId, rating, comment } = req.body;

      if (!eventId)
        return res.status(400).json({ message: "Event ID is required" });
      if (!rating || rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ message: "Rating must be between 1 and 5" });
      }

      const event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      // Check if participant attended the event
      const registration = await Registration.findOne({
        participant: req.user.userId,
        event: eventId,
        status: { $in: ["registered", "completed"] },
      });

      if (!registration) {
        return res.status(403).json({
          message: "You must be registered for this event to submit feedback",
        });
      }

      // Check if event is completed/closed
      const isCompleted =
        event.status === "closed" ||
        registration.status === "completed" ||
        (event.end_date && new Date(event.end_date) < new Date());

      if (!isCompleted) {
        return res.status(400).json({
          message: "Feedback can only be submitted for completed events",
        });
      }

      // Check for existing feedback
      const existing = await Feedback.findOne({
        event: eventId,
        participant: req.user.userId,
      });

      if (existing) {
        return res.status(400).json({
          message: "You have already submitted feedback for this event",
        });
      }

      const feedback = new Feedback({
        event: eventId,
        participant: req.user.userId,
        rating: Number(rating),
        comment: comment ? String(comment).slice(0, 1000) : "",
      });
      await feedback.save();

      res.status(201).json({ message: "Feedback submitted successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Get my feedback submissions
router.get(
  "/my-feedback",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const feedbacks = await Feedback.find({ participant: req.user.userId })
        .populate("event", "name")
        .sort({ createdAt: -1 });
      res.status(200).json(feedbacks);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// ==========================================
// Discussion Forum
// ==========================================

// Get discussion messages for an event
router.get(
  "/event/:eventId/discussion",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { eventId } = req.params;

      // Verify registration
      const registration = await Registration.findOne({
        participant: req.user.userId,
        event: eventId,
        status: { $in: ["registered", "completed"] },
      });

      if (!registration) {
        return res.status(403).json({
          message: "You must be registered for this event to view discussions",
        });
      }

      const messages = await DiscussionMessage.find({
        event: eventId,
        is_deleted: false,
      })
        .populate("author", "first_name last_name role organizer_name")
        .populate("parent_message")
        .sort({ is_pinned: -1, createdAt: -1 });

      res.status(200).json(messages);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Post a message in discussion
router.post(
  "/event/:eventId/discussion",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { content, parentMessageId } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      // Verify registration
      const registration = await Registration.findOne({
        participant: req.user.userId,
        event: eventId,
        status: { $in: ["registered", "completed"] },
      });

      if (!registration) {
        return res.status(403).json({
          message: "You must be registered for this event to post messages",
        });
      }

      const message = new DiscussionMessage({
        event: eventId,
        author: req.user.userId,
        content: content.trim().slice(0, 2000),
        parent_message: parentMessageId || null,
      });
      await message.save();

      const populated = await DiscussionMessage.findById(message._id).populate(
        "author",
        "first_name last_name role organizer_name",
      );

      // Emit real-time event via Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.to(`event-${eventId}`).emit("new-message", populated);
      }

      res.status(201).json(populated);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// React to a message
router.post(
  "/discussion/:messageId/react",
  authmiddleware,
  participantmiddleware,
  async (req, res) => {
    try {
      const { messageId } = req.params;
      const { reaction } = req.body; // e.g., "like", "heart", "thumbsup"

      if (!reaction) {
        return res.status(400).json({ message: "Reaction type is required" });
      }

      const message = await DiscussionMessage.findById(messageId);
      if (!message || message.is_deleted) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Toggle reaction
      const userReactions = message.reactions.get(reaction) || [];
      const userIdStr = req.user.userId.toString();
      const userIndex = userReactions.findIndex(
        (id) => id.toString() === userIdStr,
      );

      if (userIndex > -1) {
        userReactions.splice(userIndex, 1);
      } else {
        userReactions.push(req.user.userId);
      }

      message.reactions.set(reaction, userReactions);
      await message.save();

      // Emit real-time reaction update
      const io = req.app.get("io");
      if (io) {
        io.to(`event-${message.event.toString()}`).emit("reaction-update", {
          messageId: message._id,
          reactions: Object.fromEntries(message.reactions),
        });
      }

      res.status(200).json({
        message: "Reaction updated",
        reactions: Object.fromEntries(message.reactions),
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

module.exports = router;
