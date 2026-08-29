const mongoose = require("mongoose");
const Scheme = mongoose.Schema;

const markertdata = new Scheme(
  {
    firstname: {
      type: String,
      required: true,
    },

    lastname: {
      type: String,
      required: true,
    },

    gender: {
      type: String,
      required: true,
    },
    

    username: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // allow multiple null/empty, unique only for non-empty
      lowercase: true,
      trim: true,
    },

    bio: {
      type: String,
      required: false,
    },

    photolink: {
      type: String,
      required: false,
    },

    photoID: {
      type: String,
      required: false,
    },

    // email: {
    //   type: String,
    //   required: true,
    // },

    password: {
      type: String,
      required: true,
    },

    // emailconfirm: {
    //   type: String,
    //   required: true,
    // },

    // secretPhrase: {
    //   type: [String], // Array of 12 words (stored as plain text for recovery)
    //   required: true
    // },

    secretPhraseHash: {
      type: String,
      required: true, // No longer needed
    },

    active: {
      type: Boolean,
      required: true,
      default: false,
    },

    country: {
      type: String,
      required: true,
    },

    refreshtoken: {
      type: String,
      required: false,
    },

    accessToken: {
      type: String,
      required: false,
    },

    age: {
      type: String,
      required: true,
    },

    admin: {
      type: Boolean,
      required: true,
    },

    passcode: {
      type: String,
      required: false,
    },

    balance: {
      type: String,
      required: false,
    },
    withdrawbalance: {
      type: String,
      required: false,
    },
    creator_verified: {
      type: Boolean,
      required: false,
      default: false,
    },
    dob: {
      type: String,
      required: false,
    },
    creator_portfolio: {
      type: Boolean,
      required: false,
      default: false,
    },
    Creator_Application_status: {
      type: String,
      enum: ["none", "pending", "accepted", "rejected"],
      default: "none",
    },
    fan_verified: {
  type: Boolean,
  required: false,
  default: false,
},
first_portfolio_created_at: {
  type: Date,
  required: false,
  default: null,
},
fan_application_status: {
  type: String,
  enum: ["none", "pending", "accepted", "rejected", "approved", "declined"],
  default: "none",
},
    // Creator_Application: { type: Boolean, required: false, default: false },
    creator_portfolio_id: {
      type: String,
      required: false,
      default: "",
    },
    followers: {
      type: [String],
      required: false,
      default: [],
    },
    following: {
      type: [String],
      required: false,
      default: [],
    },
    isVip: {
      type: Boolean,
      required: false,
      default: false,
    },
    vipStartDate: {
      type: Date,
      required: false,
    },
    vipEndDate: {
      type: Date,
      required: false,
    },
    vipAutoRenewal: {
      type: Boolean,
      required: false,
      default: true,
    },
    coinBalance: {
      type: Number,
      required: false,
      default: 0,
    },
    vipCelebrationViewed: {
      type: Map,
      of: String, // userId -> monthKey (e.g., "2024-0")
      required: false,
      default: new Map(),
    },
    pending: {
      type: Number,
      required: false,
      default: 0,
    },
    earnings: {
      type: Number,
      required: false,
      default: 0,
    },
    banned: {
      type: Boolean,
      required: false,
      default: false,
    },
    banReason: {
      type: String,
      required: false,
      default: "",
    },
    bannedAt: {
      type: Date,
      required: false,
    },
    referralCode: {
      type: String,
      unique: true,
      required: false,
    },
    referredBy: {
      type: String, // User ID of the referring user
      required: false,
    },
    referralCount: {
      type: Number,
      required: false,
      default: 0,
    },
    rewardBalance: {
      type: Number,
      required: false,
      default: 0,
    },
    deviceId: {
      type: String,
      required: false,
      index: true, // Indexed for faster lookups
    },
    normalizedEmail: {
      type: String,
      required: false,
      index: true,
    },
    lastLoginIP: {
      type: String,
      required: false,
    },
    lastActive: {
      type: Date,
      required: false,
      index: true,
    },
    // Pay Per View Fields
    ppvStatus: {
      type: String,
      enum: ["none", "pending", "approved", "declined"],
      default: "none",
    },
    ppvPrice: {
      type: Number,
      default: 0,
    },
    ppvEnabled: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserDB", markertdata);
