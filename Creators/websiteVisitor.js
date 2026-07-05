const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const websiteVisitorSchema = new Schema(
  {
    // Visitor identifier - can be userid if logged in, or sessionId if anonymous
    visitorId: {
      type: String,
      required: true,
      index: true,
    },
    // User ID if logged in, null if anonymous
    userid: {
      type: String,
      required: false,
      index: true,
    },
    // Session ID for anonymous visitors
    sessionId: {
      type: String,
      required: false,
      index: true,
    },
    // Date of visit
    date: {
      type: Date,
      required: true,
      index: true,
    },
    // Location information
    location: {
      country: { type: String, required: false },
      city: { type: String, required: false },
      region: { type: String, required: false },
      timezone: { type: String, required: false },
      ipAddress: { type: String, required: false },
    },
    // Device information
    device: {
      type: { type: String, required: false }, // desktop, mobile, tablet
      browser: { type: String, required: false },
      os: { type: String, required: false },
      userAgent: { type: String, required: false },
    },
    // Time tracking
    firstVisit: {
      type: Date,
      required: true,
    },
    lastVisit: {
      type: Date,
      required: true,
    },
    // Total time spent in milliseconds
    totalTimeSpent: {
      type: Number,
      default: 0,
    },
    // Number of page views
    pageViews: {
      type: Number,
      default: 1,
    },
    pagesVisited: {
  type: [
    {
      path: { type: String, required: true },
      timestamp: { type: Date, required: true },
    }
  ],
  default: [],
},
    // Whether visitor signed up (for logged-in users)
    signedUp: {
      type: Boolean,
      default: false,
    },
    // Gender if available (for logged-in users)
    gender: {
      type: String,
      required: false,
    },
    // Mark if visitor is anonymous (not logged in)
    isAnonymous: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
websiteVisitorSchema.index({ date: 1, visitorId: 1 });
websiteVisitorSchema.index({ userid: 1, date: 1 });
websiteVisitorSchema.index({ date: 1, signedUp: 1 });

module.exports = mongoose.model("WebsiteVisitor", websiteVisitorSchema);

