const mongoose = require("mongoose");
const Scheme = mongoose.Schema;


const markertdata = new Scheme(
  {
    userid: {
      type: String,
      required: true,
    },
    postfilelink: {
      type: String,
      required: false,
    },
    postfilepublicid: {
      type: String,
      required: false,
    },
    posttime: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: false,
    },
    posttype: {
      type: String,
      required: false,
    },
    isExclusive: {
      type: Boolean,
      required: false,
      default: false,
    },
    price: {
      type: Number,
      required: false,
    },
    hashtags: {
      type: [String],
      required: false,
      default: [],
    },
    mediaItems: {
  type: [
    {
      url: { type: String, required: true },
      publicId: { type: String, required: true },
      type: { type: String, enum: ["image", "video"], required: true },
    }
  ],
  required: false,
  default: [],
},
  },
  { timestamps: true }
);

// Virtuals for likeCount and likedBy can be handled in aggregation
module.exports = mongoose.model("Post", markertdata);
