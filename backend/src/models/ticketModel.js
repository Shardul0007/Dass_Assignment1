const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true,
    required: true,
  },
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  qrData: {
    type: String,
    unique: true,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  is_used: {
    type: Boolean,
    default: false,
  },
  used_at: {
    type: Date,
  },
  // Audit log for manual overrides
  audit_log: [
    {
      action: { type: String },
      by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reason: { type: String },
      at: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model("Ticket", TicketSchema);
