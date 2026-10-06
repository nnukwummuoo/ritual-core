const mongoose = require("mongoose");
const Scheme = mongoose.Schema;

const markertdata = new Scheme(
  {
    userid: {
      type: String,
      required: false, // Made optional for global notifications
    },
    message: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: false,
    },
    end_date: {
      type: String,
      required: false,
    },
    suspend: {
      type: Boolean,
      required: false,
    },
    seen: {
      type: Boolean,
      required: false,
    },
    delete: {
      type: Boolean,
      required: false,
    },
    email: {
      type: String,
      required: false,
    },
    // New fields for admin notifications
    adminNotification: {
      type: Boolean,
      required: false,
      default: false,
    },
    hasLearnMore: {
      type: Boolean,
      required: false,
      default: false,
    },
    learnMoreUrl: {
      type: String,
      required: false,
    },
    targetGender: {
      type: String,
      required: false,
      enum: ['all', 'male', 'female', 'creators', 'specific'],
    },
    isActive: {
      type: Boolean,
      required: false,
      default: true,
    },
 type: {
      type: String,
      required: false,
      default: 'admin_broadcast',
    },
    // Groups all per-user notification docs created by a single admin broadcast.
    // Replaces the old title/message/time-window heuristic used to group,
    // edit and delete a campaign.
    batchId: {
      type: String,
      required: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("admindb", markertdata);
