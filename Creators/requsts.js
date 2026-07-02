const mongoose = require("mongoose");
const Scheme = mongoose.Schema;

const markertdata = new Scheme(
  {
    creator_portfolio_id: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      required: false,
    },

    time: {
      type: String,
      required: false,
    },

    place: {
      type: String,
      required: false,
    },

    userid: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      require: false,
      default: "pending",
    },

    date: {
      type: String,
      required: false,
    },
    price: {
      type: Number,
      required: false,
    },
    expiresAt: {
      type: Date,
      required: false,
    },
    sessionEndAt: {
  type: Date,
  required: false,
},
sessionNotified: {
  type: Boolean,
  default: false,
},
  },
  { timestamps: true }
);

module.exports = mongoose.model("Requests", markertdata);
