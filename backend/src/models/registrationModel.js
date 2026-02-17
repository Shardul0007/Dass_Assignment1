const mongoose = require("mongoose");
const userModel = require("./userModel");
const eventModel = require("./eventModel");

const RegistrationSchema = new mongoose.Schema(
  {
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
    registered_on: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: [
        "registered",
        "cancelled",
        "completed",
        "rejected",
        "pending_approval",
      ],
      default: "registered",
    },
    team_name: {
      type: String,
    },
    ticketId: {
      type: String,
      unique: true,
      sparse: true,
    },
    form_response: {
      type: mongoose.Schema.Types.Mixed,
    },
    merch: {
      size: { type: String },
      color: { type: String },
      quantity: { type: Number, default: 1 },
    },
    attendance: {
      type: Boolean,
      default: false,
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    // Merchandise Payment Approval Workflow
    merch_payment_status: {
      type: String,
      enum: ["none", "pending_approval", "approved", "rejected"],
      default: "none",
    },
    payment_proof_image: {
      type: String, // Base64 image data
    },
    payment_rejection_reason: {
      type: String,
    },
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approved_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Registration", RegistrationSchema);
