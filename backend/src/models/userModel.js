const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["organizer", "participant", "admin"],
      required: true,
    },

    first_name: {
      type: String,
    },
    last_name: {
      type: String,
    },
    participant_type: {
      type: String,
      enum: ["IIIT", "Non-IIIT"],
    },
    organisation_name: {
      type: String,
    },
    contact_number: {
      type: String,
    },
    interests: {
      type: [String],
    },
    followed_organizers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    is_disabled: {
      type: Boolean,
      default: false,
    },

    is_archived: {
      type: Boolean,
      default: false,
    },
    archived_at: {
      type: Date,
    },

    organizer_name: {
      type: String,
    },
    category: {
      type: String,
    },
    description: {
      type: String,
    },
    contact_email: {
      type: String,
    },
    discord_webhook_url: {
      type: String,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
