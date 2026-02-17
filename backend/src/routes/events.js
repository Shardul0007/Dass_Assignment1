const express = require("express");
const router = express.Router();
const Event = require("../models/eventModel");
const Registration = require("../models/registrationModel");

router.get("/", async (req, res) => {
  try {
    const event = await Event.find()
      .populate(
        "created_by",
        "organizer_name category description contact_email",
      )
      .sort({ start_date: 1 });
    res.status(200).json(event);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id).populate(
      "created_by",
      "organizer_name category description contact_email",
    );
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.status(200).json(event);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

router.get("/:id/availability", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.event_type === "Merchandise") {
      const stock = Number(event.item_details?.stock ?? 0);
      return res.status(200).json({
        eventId: String(event._id),
        event_type: event.event_type,
        stock,
        outOfStock: !Number.isFinite(stock) || stock <= 0,
        purchase_limit: Number(event.item_details?.purchase_limit ?? 1),
      });
    }

    const limit = event.registration_limit;
    if (limit === null || limit === undefined) {
      return res.status(200).json({
        eventId: String(event._id),
        event_type: event.event_type,
        registration_limit: null,
        registered_count: null,
        isFull: false,
      });
    }

    const registered_count = await Registration.countDocuments({
      event: event._id,
      status: "registered",
    });
    const isFull = registered_count >= Number(limit);
    res.status(200).json({
      eventId: String(event._id),
      event_type: event.event_type,
      registration_limit: Number(limit),
      registered_count,
      isFull,
      remaining: Math.max(0, Number(limit) - registered_count),
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
