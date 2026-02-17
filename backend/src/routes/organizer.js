const express = require("express");
const Event = require("../models/eventModel");
const Registration = require("../models/registrationModel");
const { authmiddleware, organizermiddleware } = require("../middleware/auth");
const router = express.Router();
const Ticket = require("../models/ticketModel");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const sendTicketEmail = require("../utils/sendTicketEmail");
const PasswordResetRequest = require("../models/passwordResetRequestModel");
const User = require("../models/userModel");
const Feedback = require("../models/feedbackModel");
const DiscussionMessage = require("../models/discussionModel");

router.post(
  "/create-event",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const {
        name,
        description,
        start_date,
        end_date,
        event_type,
        eligibility,
        registration_deadline,
        registration_limit,
        registration_fee,
        event_tags,
        item_details,
        discord_webhook_url,
      } = req.body;
      if (!name || !description || !start_date || !end_date || !event_type) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (
        !eligibility ||
        !registration_deadline ||
        !Array.isArray(event_tags)
      ) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (event_type === "Merchandise") {
        const stock = Number(item_details?.stock ?? 0);
        const purchase_limit = Number(item_details?.purchase_limit ?? 0);
        if (!Number.isFinite(stock) || stock < 0) {
          return res.status(400).json({ message: "Invalid stock" });
        }
        if (!Number.isFinite(purchase_limit) || purchase_limit < 1) {
          return res.status(400).json({ message: "Invalid purchase limit" });
        }
      }

      const organizer = await User.findById(req.user.userId).select(
        "discord_webhook_url",
      );
      const webhookToUse =
        discord_webhook_url || organizer?.discord_webhook_url || "";

      const newEvent = new Event({
        name,
        description,
        start_date,
        end_date,
        event_type,
        eligibility,
        registration_deadline,
        registration_limit,
        registration_fee,
        event_tags,
        ...(event_type === "Merchandise" ? { item_details } : {}),
        created_by: req.user.userId,
      });
      await newEvent.save();
      if (webhookToUse) {
        fetch(webhookToUse, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: `New Event: ${newEvent.name}` }),
        });
      }
      res.status(201).json({ message: "Event created successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get("/me", authmiddleware, organizermiddleware, async (req, res) => {
  try {
    const organizer = await User.findById(req.user.userId).select(
      "email organizer_name category description contact_email contact_number discord_webhook_url",
    );
    if (!organizer)
      return res.status(404).json({ message: "Organizer not found" });
    res.status(200).json({ organizer });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.put(
  "/profile",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const {
        organizer_name,
        category,
        description,
        contact_email,
        contact_number,
        discord_webhook_url,
      } = req.body || {};

      const updated = await User.findByIdAndUpdate(
        req.user.userId,
        {
          $set: {
            ...(organizer_name !== undefined ? { organizer_name } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(contact_email !== undefined ? { contact_email } : {}),
            ...(contact_number !== undefined ? { contact_number } : {}),
            ...(discord_webhook_url !== undefined
              ? { discord_webhook_url }
              : {}),
          },
        },
        { new: true },
      ).select(
        "email organizer_name category description contact_email contact_number discord_webhook_url",
      );

      if (!updated)
        return res.status(404).json({ message: "Organizer not found" });
      res.status(200).json({ message: "Profile updated", organizer: updated });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/analytics",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const events = await Event.find({ created_by: req.user.userId });
      const eventIds = events.map((e) => e._id);
      const regs = await Registration.find({ event: { $in: eventIds } }).select(
        "event payment_status attendance status merch.quantity team_name",
      );

      const byEvent = new Map();
      for (const e of events) {
        byEvent.set(String(e._id), {
          eventId: String(e._id),
          name: e.name,
          event_type: e.event_type,
          status: e.status,
          registrations: 0,
          paid: 0,
          revenue: 0,
          attendance: 0,
          team: {
            teams_total: 0,
            teams_complete: 0,
            teams_partial: 0,
            completion_rate: 0,
            avg_team_size: 0,
          },
        });
      }

      for (const r of regs) {
        const row = byEvent.get(String(r.event));
        if (!row) continue;
        const st = String(r.status || "").toLowerCase();
        const active = st === "registered" || st === "completed";
        if (active) row.registrations += 1;
        if (active && r.attendance) row.attendance += 1;
        if (active && String(r.payment_status) === "paid") row.paid += 1;
      }

      // Team completion stats (based on team_name + attendance)
      // Definition: a team is "complete" when all its members have attendance=true.
      for (const e of events) {
        if (String(e.event_type) !== "Normal") continue;
        const row = byEvent.get(String(e._id));
        if (!row) continue;

        const teamMap = new Map();
        for (const r of regs) {
          if (String(r.event) !== String(e._id)) continue;
          const st = String(r.status || "").toLowerCase();
          if (!(st === "registered" || st === "completed")) continue;
          const teamRaw = r.team_name;
          const teamName = typeof teamRaw === "string" ? teamRaw.trim() : "";
          if (!teamName) continue;
          const t = teamMap.get(teamName) || { members: 0, attended: 0 };
          t.members += 1;
          if (r.attendance) t.attended += 1;
          teamMap.set(teamName, t);
        }

        const teams = Array.from(teamMap.values());
        const teams_total = teams.length;
        const teams_complete = teams.filter(
          (t) => t.members > 0 && t.attended === t.members,
        ).length;
        const teams_partial = teams.filter(
          (t) => t.attended > 0 && t.attended < t.members,
        ).length;
        const totalMembers = teams.reduce((s, t) => s + t.members, 0);
        row.team = {
          teams_total,
          teams_complete,
          teams_partial,
          completion_rate: teams_total ? teams_complete / teams_total : 0,
          avg_team_size: teams_total ? totalMembers / teams_total : 0,
        };
      }

      // revenue: for Normal, registration_fee * paidCount (or * registrations when free); for merchandise, fee * total quantity paid
      for (const e of events) {
        const row = byEvent.get(String(e._id));
        if (!row) continue;
        if (e.event_type === "Merchandise") {
          const paidRegs = regs.filter(
            (r) =>
              String(r.event) === String(e._id) &&
              String(r.payment_status) === "paid",
          );
          const totalQty = paidRegs.reduce(
            (s, r) => s + Number(r?.merch?.quantity || 1),
            0,
          );
          row.revenue = Number(e.registration_fee || 0) * totalQty;
        } else {
          row.revenue = Number(e.registration_fee || 0) * row.paid;
        }
      }

      const all = Array.from(byEvent.values());
      const completed = all.filter((x) => x.status === "closed");
      const totals = all.reduce(
        (acc, x) => {
          acc.registrations += x.registrations;
          acc.paid += x.paid;
          acc.revenue += x.revenue;
          acc.attendance += x.attendance;
          return acc;
        },
        { registrations: 0, paid: 0, revenue: 0, attendance: 0 },
      );

      res.status(200).json({ totals, completed, all });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.put(
  "/event/:id/custom-form",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (String(event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (event.status !== "draft") {
        return res
          .status(400)
          .json({ message: "Form can be edited only in draft" });
      }
      const regCount = await Registration.countDocuments({ event: event._id });
      if (regCount > 0) {
        return res
          .status(400)
          .json({ message: "Form is locked after first registration" });
      }

      const form = req.body?.custom_form;
      if (!Array.isArray(form)) {
        return res
          .status(400)
          .json({ message: "custom_form must be an array" });
      }
      const allowedTypes = new Set(["text", "dropdown", "checkbox", "file"]);
      for (const f of form) {
        if (!f || !f.label || !f.type) {
          return res
            .status(400)
            .json({ message: "Each field needs label and type" });
        }
        if (!allowedTypes.has(String(f.type))) {
          return res
            .status(400)
            .json({ message: `Invalid field type: ${f.type}` });
        }
        if (f.type === "dropdown" && f.options && !Array.isArray(f.options)) {
          return res.status(400).json({ message: "options must be array" });
        }
      }

      event.custom_form = form.map((f, idx) => ({
        field_id: f.field_id || `f${idx + 1}`,
        label: String(f.label),
        type: String(f.type),
        required: !!f.required,
        options: Array.isArray(f.options) ? f.options.map(String) : undefined,
      }));

      await event.save();
      res
        .status(200)
        .json({ message: "Custom form saved", custom_form: event.custom_form });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/event/:id/published-update",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (String(event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (event.status !== "published") {
        return res
          .status(400)
          .json({ message: "Only published events can be updated" });
      }

      const { description, registration_deadline, registration_limit } =
        req.body || {};

      if (description !== undefined) {
        event.description = description;
      }
      if (registration_deadline !== undefined) {
        const next = new Date(registration_deadline);
        if (Number.isNaN(next.getTime())) {
          return res.status(400).json({ message: "Invalid deadline" });
        }
        if (next < new Date(event.registration_deadline)) {
          return res
            .status(400)
            .json({ message: "Deadline can only be extended" });
        }
        event.registration_deadline = next;
      }
      if (registration_limit !== undefined) {
        const nextLimit = Number(registration_limit);
        if (
          !Number.isFinite(nextLimit) ||
          nextLimit < event.registration_limit
        ) {
          return res
            .status(400)
            .json({ message: "Limit can only be increased" });
        }
        event.registration_limit = nextLimit;
      }

      await event.save();
      res.status(200).json({ message: "Published event updated", event });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/my-events",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const events = await Event.find({ created_by: req.user.userId })
        .sort({ start_date: 1 })
        .populate(
          "created_by",
          "organizer_name category description contact_email",
        );
      res.status(200).json(events);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.get(
  "/event/:id/registrations",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.created_by.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
      const registrations = await Registration.find({ event: req.params.id })
        .populate(
          "participant",
          "first_name last_name email participant_type organisation_name contact_number",
        )
        .sort({ createdAt: -1 });
      res.status(200).json(registrations);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/event/:id/draft",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.created_by.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (event.status !== "draft") {
        return res
          .status(400)
          .json({ message: "Only draft events can be edited" });
      }

      Object.assign(event, req.body);
      await event.save();
      res.status(200).json(event);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/event/:id/publish",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.created_by.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (event.status !== "draft") {
        return res.status(400).json({ message: "Event must be drafted first" });
      }
      event.status = "published";
      await event.save();
      res.status(200).json({ message: "Event is published" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/event/:id/ongoing",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.created_by.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (event.status !== "published") {
        return res
          .status(400)
          .json({ message: "Event must be published first" });
      }
      event.status = "ongoing";
      await event.save();
      res.status(200).json({ message: "Event is ongoing" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/event/:id/close",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.created_by.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (event.status !== "ongoing") {
        return res.status(400).json({ message: "Event must be ongoing first" });
      }
      event.status = "closed";
      await event.save();

      // Mark active registrations as completed when event closes
      await Registration.updateMany(
        { event: event._id, status: "registered" },
        { $set: { status: "completed" } },
      );

      res.status(200).json({ message: "Event is closed" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.patch(
  "/event/:id/attendance",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const { registrationId, attendance } = req.body;
      await Registration.findByIdAndUpdate(registrationId, { attendance });
      res.status(200).json({ message: "Attendance updated successfully" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.post(
  "/verify-ticket",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const { ticketId } = req.body;
      if (!ticketId) {
        return res.status(400).json({ message: "Ticket ID is required" });
      }
      const ticket = await Ticket.findOne({ ticketId }).populate("event");
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      if (!ticket.event || !ticket.event.created_by) {
        return res.status(400).json({ message: "Ticket event data missing" });
      }
      if (ticket.event.created_by.toString() !== req.user.userId.toString()) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      if (ticket.is_used) {
        return res
          .status(400)
          .json({ message: "Ticket has already been used" });
      }
      ticket.is_used = true;
      ticket.used_at = new Date();
      await ticket.save();

      const updatedReg = await Registration.findOneAndUpdate(
        { participant: ticket.participant, event: ticket.event._id },
        { $set: { attendance: true } },
        { new: true },
      );
      if (!updatedReg) {
        return res
          .status(404)
          .json({ message: "Registration not found for this ticket" });
      }
      res.status(200).json({
        message: "Entry Allowed",
        participant: ticket.participant,
        event: ticket.event.name,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

router.post(
  "/password-reset-request",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const message =
        req.body && req.body.message ? String(req.body.message) : "";

      const organizer = await User.findById(req.user.userId);
      if (!organizer)
        return res.status(404).json({ message: "Organizer not found" });
      if (organizer.is_disabled)
        return res.status(400).json({ message: "Organizer is disabled" });

      const existing = await PasswordResetRequest.findOne({
        organizer: req.user.userId,
        status: "pending",
      });
      if (existing) {
        return res
          .status(400)
          .json({ message: "A reset request is already pending" });
      }

      const request = new PasswordResetRequest({
        organizer: req.user.userId,
        message,
      });
      await request.save();
      res.status(201).json({ message: "Password reset request sent to admin" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// ==========================================
// QR Scanner & Attendance Tracking
// ==========================================

// Scan QR code and mark attendance
router.post(
  "/scan-qr",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const { qrData, eventId } = req.body;

      if (!qrData) {
        return res.status(400).json({ message: "QR data is required" });
      }

      let parsed;
      try {
        parsed = JSON.parse(qrData);
      } catch {
        return res.status(400).json({ message: "Invalid QR code format" });
      }

      const { ticketId } = parsed;
      if (!ticketId) {
        return res
          .status(400)
          .json({ message: "Invalid QR code - no ticket ID" });
      }

      const ticket = await Ticket.findOne({ ticketId }).populate(
        "event participant",
      );
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      // Verify organizer owns the event
      if (String(ticket.event.created_by) !== String(req.user.userId)) {
        return res
          .status(403)
          .json({ message: "This ticket is not for your event" });
      }

      // Check if scanning for specific event
      if (eventId && String(ticket.event._id) !== String(eventId)) {
        return res
          .status(400)
          .json({ message: "Ticket is for a different event" });
      }

      // Check if already scanned
      if (ticket.is_used) {
        return res.status(400).json({
          message: "Ticket already scanned",
          scanned_at: ticket.used_at,
          duplicate: true,
        });
      }

      // Mark ticket as used
      ticket.is_used = true;
      ticket.used_at = new Date();
      await ticket.save();

      // Mark attendance in registration
      await Registration.findOneAndUpdate(
        { participant: ticket.participant._id, event: ticket.event._id },
        { $set: { attendance: true } },
      );

      const participant = await User.findById(ticket.participant._id).select(
        "first_name last_name email",
      );

      res.status(200).json({
        message: "Entry allowed",
        participant: {
          name: `${participant?.first_name || ""} ${participant?.last_name || ""}`.trim(),
          email: participant?.email,
        },
        event: ticket.event.name,
        scanned_at: ticket.used_at,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Get attendance dashboard for an event
router.get(
  "/event/:id/attendance-dashboard",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (String(event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const registrations = await Registration.find({
        event: req.params.id,
        status: { $in: ["registered", "completed"] },
      }).populate(
        "participant",
        "first_name last_name email participant_type organisation_name",
      );

      const tickets = await Ticket.find({ event: req.params.id });
      const ticketMap = new Map(tickets.map((t) => [String(t.participant), t]));

      const attendees = [];
      const notYetScanned = [];

      for (const reg of registrations) {
        const ticket = ticketMap.get(String(reg.participant._id));
        const entry = {
          registrationId: reg._id,
          participant: reg.participant,
          ticketId: reg.ticketId,
          attendance: reg.attendance,
          scanned_at: ticket?.used_at || null,
        };

        if (reg.attendance || ticket?.is_used) {
          attendees.push(entry);
        } else {
          notYetScanned.push(entry);
        }
      }

      res.status(200).json({
        event: { _id: event._id, name: event.name },
        totalRegistrations: registrations.length,
        scannedCount: attendees.length,
        pendingCount: notYetScanned.length,
        attendees,
        notYetScanned,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Export attendance report as CSV
router.get(
  "/event/:id/attendance-csv",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (String(event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const registrations = await Registration.find({
        event: req.params.id,
        status: { $in: ["registered", "completed"] },
      }).populate(
        "participant",
        "first_name last_name email participant_type organisation_name contact_number",
      );

      const tickets = await Ticket.find({ event: req.params.id });
      const ticketMap = new Map(tickets.map((t) => [String(t.participant), t]));

      const escape = (v) => {
        const s = String(v ?? "");
        if (s.includes(",") || s.includes("\n") || s.includes('"')) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      };

      const rows = [
        [
          "First Name",
          "Last Name",
          "Email",
          "Type",
          "Organisation",
          "Contact",
          "Ticket ID",
          "Attendance",
          "Scanned At",
        ]
          .map(escape)
          .join(","),
      ];

      for (const reg of registrations) {
        const p = reg.participant || {};
        const ticket = ticketMap.get(String(p._id));
        rows.push(
          [
            p.first_name,
            p.last_name,
            p.email,
            p.participant_type,
            p.organisation_name,
            p.contact_number,
            reg.ticketId,
            reg.attendance ? "Yes" : "No",
            ticket?.used_at ? new Date(ticket.used_at).toISOString() : "",
          ]
            .map(escape)
            .join(","),
        );
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=attendance-${req.params.id}.csv`,
      );
      res.status(200).send(rows.join("\n"));
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Manual attendance override with audit log
router.patch(
  "/event/:id/manual-attendance",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const { registrationId, attendance, reason } = req.body;

      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (String(event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const registration = await Registration.findById(registrationId);
      if (
        !registration ||
        String(registration.event) !== String(req.params.id)
      ) {
        return res.status(404).json({ message: "Registration not found" });
      }

      registration.attendance = attendance;
      await registration.save();

      // Log the manual override (stored in ticket)
      if (registration.ticketId) {
        await Ticket.findOneAndUpdate(
          { ticketId: registration.ticketId },
          {
            $set: {
              is_used: attendance,
              used_at: attendance ? new Date() : null,
            },
            $push: {
              audit_log: {
                action: attendance ? "manual_checkin" : "manual_checkout",
                by: req.user.userId,
                reason: reason || "Manual override",
                at: new Date(),
              },
            },
          },
        );
      }

      res
        .status(200)
        .json({ message: "Attendance updated manually", attendance });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// ==========================================
// Merchandise Payment Approval Workflow
// ==========================================

// Get pending merchandise orders for organizer's events
router.get(
  "/merch-orders",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const events = await Event.find({
        created_by: req.user.userId,
        event_type: "Merchandise",
      }).select("_id");

      const eventIds = events.map((e) => e._id);

      const orders = await Registration.find({
        event: { $in: eventIds },
        merch_payment_status: { $ne: "none" },
      })
        .populate("participant", "first_name last_name email participant_type")
        .populate("event", "name registration_fee item_details")
        .sort({ createdAt: -1 });

      res.status(200).json(orders);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Approve merchandise payment
router.patch(
  "/merch-order/:id/approve",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const registration = await Registration.findById(req.params.id)
        .populate("event")
        .populate("participant", "first_name last_name email");

      if (!registration) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (String(registration.event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (registration.merch_payment_status !== "pending_approval") {
        return res
          .status(400)
          .json({ message: "Order is not pending approval" });
      }

      const qty = Number(registration.merch?.quantity || 1);

      // Decrement stock atomically
      const updated = await Event.findOneAndUpdate(
        { _id: registration.event._id, "item_details.stock": { $gte: qty } },
        { $inc: { "item_details.stock": -qty } },
        { new: true },
      );

      if (!updated) {
        return res.status(400).json({ message: "Out of stock" });
      }

      // Generate ticket and QR
      const ticketId = `FEST-${uuidv4()}`;
      const user = registration.participant;

      const qrPayloadObj = {
        ticketId,
        event: { id: String(updated._id), name: updated.name },
        participant: {
          id: String(registration.participant._id),
          name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
          email: user?.email,
        },
        merchandise: registration.merch,
      };
      const qrPayload = JSON.stringify(qrPayloadObj);
      const qrBase64 = await QRCode.toDataURL(qrPayload);

      // Update registration
      registration.status = "registered";
      registration.merch_payment_status = "approved";
      registration.payment_status = "paid";
      registration.ticketId = ticketId;
      registration.approved_by = req.user.userId;
      registration.approved_at = new Date();
      await registration.save();

      // Create ticket
      const ticket = new Ticket({
        ticketId,
        participant: registration.participant._id,
        event: registration.event._id,
        qrData: qrPayload,
      });
      await ticket.save();

      // Send confirmation email
      try {
        await sendTicketEmail(user.email, ticketId, qrBase64, {
          eventName: updated.name,
          participantName:
            `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
          participantEmail: user.email,
        });
      } catch (emailErr) {
        console.log("Ticket email failed:", emailErr?.message || emailErr);
      }

      res.status(200).json({
        message: "Order approved. Ticket sent to participant.",
        ticketId,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Reject merchandise payment
router.patch(
  "/merch-order/:id/reject",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const { reason } = req.body;

      const registration = await Registration.findById(req.params.id).populate(
        "event",
      );
      if (!registration) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (String(registration.event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (registration.merch_payment_status !== "pending_approval") {
        return res
          .status(400)
          .json({ message: "Order is not pending approval" });
      }

      registration.status = "rejected";
      registration.merch_payment_status = "rejected";
      registration.payment_rejection_reason =
        reason || "Payment proof rejected";
      await registration.save();

      res.status(200).json({ message: "Order rejected" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// ==========================================
// Anonymous Feedback System (Organizer View)
// ==========================================

// Get feedback for organizer's events
router.get(
  "/event/:id/feedback",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (String(event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const feedbacks = await Feedback.find({ event: req.params.id })
        .select("rating comment createdAt") // Anonymous - no participant info
        .sort({ createdAt: -1 });

      const ratings = feedbacks.map((f) => f.rating);
      const avgRating =
        ratings.length > 0
          ? ratings.reduce((a, b) => a + b, 0) / ratings.length
          : 0;

      const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const r of ratings) {
        ratingDistribution[r] = (ratingDistribution[r] || 0) + 1;
      }

      res.status(200).json({
        totalFeedback: feedbacks.length,
        averageRating: Math.round(avgRating * 10) / 10,
        ratingDistribution,
        feedbacks,
      });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// ==========================================
// Discussion Forum (Organizer Moderation)
// ==========================================

// Get discussion messages for an event (organizer)
router.get(
  "/event/:id/discussion",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (String(event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await DiscussionMessage.find({
        event: req.params.id,
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

// Post announcement/message as organizer
router.post(
  "/event/:id/discussion",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const { content, isAnnouncement } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });
      if (String(event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const message = new DiscussionMessage({
        event: req.params.id,
        author: req.user.userId,
        content: content.trim().slice(0, 2000),
        is_announcement: !!isAnnouncement,
        is_pinned: !!isAnnouncement, // Announcements are auto-pinned
      });
      await message.save();

      const populated = await DiscussionMessage.findById(message._id).populate(
        "author",
        "first_name last_name role organizer_name",
      );

      // Emit real-time event via Socket.IO
      const io = req.app.get("io");
      if (io) {
        io.to(`event-${req.params.id}`).emit("new-message", populated);
        if (isAnnouncement) {
          io.to(`event-${req.params.id}`).emit("new-announcement", populated);
        }
      }

      res.status(201).json(populated);
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Pin/unpin message
router.patch(
  "/discussion/:messageId/pin",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const message = await DiscussionMessage.findById(
        req.params.messageId,
      ).populate("event");
      if (!message)
        return res.status(404).json({ message: "Message not found" });

      if (String(message.event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      message.is_pinned = !message.is_pinned;
      await message.save();

      // Emit real-time pin update
      const io = req.app.get("io");
      if (io) {
        io.to(`event-${message.event._id}`).emit("message-pinned", {
          messageId: message._id,
          is_pinned: message.is_pinned,
        });
      }

      res
        .status(200)
        .json({ message: "Pin status updated", is_pinned: message.is_pinned });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

// Delete message (soft delete)
router.delete(
  "/discussion/:messageId",
  authmiddleware,
  organizermiddleware,
  async (req, res) => {
    try {
      const message = await DiscussionMessage.findById(
        req.params.messageId,
      ).populate("event");
      if (!message)
        return res.status(404).json({ message: "Message not found" });

      if (String(message.event.created_by) !== String(req.user.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      message.is_deleted = true;
      message.content = "[Message deleted by organizer]";
      await message.save();

      // Emit real-time delete event
      const io = req.app.get("io");
      if (io) {
        io.to(`event-${message.event._id}`).emit("message-deleted", {
          messageId: message._id,
        });
      }

      res.status(200).json({ message: "Message deleted" });
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  },
);

module.exports = router;
