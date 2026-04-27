const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const HotelSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: [true, "Hotel name is required"] },
    location: { type: String, trim: true },
    logoUrl: { type: String, trim: true, default: "123img.jpg" },

    // --- SAAS / BUSINESS CONTROL ---
    // If they stop paying you, set this to false to disable their QR codes
    isActive: { type: Boolean, default: true },
    subscriptionPlan: {
      type: String,
      enum: ["free_trial", "basic", "premium"],
      default: "free_trial",
    },
    subscriptionExpiresAt: Date,
    // Soft Delete (better than removing data permanently)
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

// ===============================================================================
// pre
// ===============================================================================
HotelSchema.pre("save", async function () {
  // 1. If password wasn't modified, exit the function immediately.
  // (In an async function, 'return' acts like 'next()')
  if (!this.isModified("kitchenPassword")) return;

  // 2. Hash the password with cost of 12
  this.kitchenPassword = await bcrypt.hash(this.kitchenPassword, 12);

  // No need to call next()!
  // When this function finishes successfully, Mongoose moves on.
});

const Hotel = mongoose.model("Hotel", HotelSchema);
module.exports = Hotel;
