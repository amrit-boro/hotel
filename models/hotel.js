const mongoose = require("mongoose");

const HotelSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner ID is required"],
      index: true,
    },

    name: {
      type: String,
      required: [true, "Hotel name is required"],
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, "Please provide phone number"],
      unique: true,
      sparse: true, // IMPORTANT to avoid unique conflicts when null
      match: [/^[0-9]{10}$/, "Please provide a valid 10-digit phone number"],
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },

    openingTime: {
      type: String,
      default: "10:00",
    },

    closingTime: {
      type: String,
      default: "22:00",
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    subscriptionPlan: {
      type: String,
      enum: ["free_trial", "basic", "premium"],
      default: "free_trial",
      index: true,
    },

    subscriptionExpiresAt: {
      type: Date,
      // required: false,  // Not required - will be auto-set by pre-save
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Pre-save middleware to auto-set subscription expiry
HotelSchema.pre("save", function () {
  if (!this.subscriptionExpiresAt && this.subscriptionPlan === "free_trial") {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    this.subscriptionExpiresAt = expiryDate;
  }
});

// HotelSchema.pre("save", function () {
//   if (!this.subscriptionExpiresAt && this.subscriptionPlan === "free_trial") {
//     const expiryDate = new Date(Date.now() + 1000); // 1 sec for testing
//     this.subscriptionExpiresAt = expiryDate;
//   }
// });

// Virtual for subscription status
HotelSchema.virtual("subscriptionStatus").get(function () {
  const now = new Date();
  if (!this.subscriptionExpiresAt) return "active";
  return this.subscriptionExpiresAt > now ? "active" : "expired";
});

HotelSchema.virtual("daysRemaining").get(function () {
  const now = new Date();
  if (!this.subscriptionExpiresAt || this.subscriptionExpiresAt < now) return 0;
  const diffTime = Math.abs(this.subscriptionExpiresAt - now);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

const Hotel = mongoose.model("Hotel", HotelSchema);
module.exports = Hotel;
