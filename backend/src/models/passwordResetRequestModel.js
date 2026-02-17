const mongoose = require("mongoose");

const PasswordResetRequestSchema = new mongoose.Schema(
  {
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    message: {
      type: String,
      default: "",
    },
    handled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    handled_at: {
      type: Date,
    },
  },
  { timestamps: true },
);

// One pending request per organizer
PasswordResetRequestSchema.index(
  { organizer: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

module.exports = mongoose.model(
  "PasswordResetRequest",
  PasswordResetRequestSchema,
);
