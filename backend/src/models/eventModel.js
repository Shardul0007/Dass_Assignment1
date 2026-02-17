const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    event_type: {
      type: String,
      required: true,
    },
    eligibility: {
      type: String,
      required: true,
    },
    registration_deadline: {
      type: Date,
      required: true,
    },
    registration_limit: {
      type: Number,
      required: true,
    },
    registration_fee: {
      type: Number,
      required: true,
    },
    event_tags: {
      type: [String],
      required: true,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    item_details: {
      sizes: {
        type: [String],
      },
      colors: {
        type: [String],
      },
      stock: {
        type: Number,
      },
      purchase_limit: {
        type: Number,
      },
    },
    custom_form: {
      type: [
        {
          field_id: { type: String },
          label: { type: String, required: true },
          type: { type: String, required: true },
          required: { type: Boolean, default: false },
          options: { type: [String] },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "published", "ongoing", "closed"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  },
);
module.exports = mongoose.model("Event", EventSchema);
