const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const creatorfileschema = Schema({
  creatorfilelink: {
    type: String,
    required: false,
  },

  creatorfilepublicid: {
    type: String,
    required: false,
  },
});

const markertdata = new Schema(
  {
    userid: {
      type: String,
      required: true,
    },

    verify: {
      type: String,
      required: false,
    },

    name: {
      type: String,
      required: false,
    },

    age: {
      type: String,
      required: false,
    },

    location: {
      type: String,
      required: false,
    },

    price: {
      type: String,
      required: false,
    },

    duration: {
      type: String,
      required: false,
    },

    description: {
      type: String,
      required: false,
    },

    gender: {
      type: String,
      required: false,
    },

    timeava: {
      type: [String],
      required: false,
    },

    daysava: {
      type: [String],
      required: false,
    },

    hosttype: {
      type: String,
      required: false,
    },
    views: {
      type: [String],
      default: [],
    },
    lastNotificationView: {
      type: Number,
      default: 0,
    },
    followers: {
      type: [String],
      default: [],
    },
    earnings: {
      type: Number,
      default: 0,
    },

    creatorfiles: [creatorfileschema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Creator", markertdata);
