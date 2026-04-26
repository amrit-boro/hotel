const mongoose = require("mongoose");

const HotelStaffSchema = new mongoose.Schema({
  // Link to the Hotel they work for
  hotelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hotel",
    required: true,
    index: true,
  },

  // Link to the Staff Member's personal account
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // What are they allowed to do?
  role: {
    type: String,
    enum: ["head_chef", "waiter", "hotel_owner"],
    required: true,
  },

  // Optional: Granular toggle switches for specific access
  permissions: {
    canEditMenu: { type: Boolean, default: false },
    canViewSales: { type: Boolean, default: false },
    canManageOrders: { type: Boolean, default: true },
  },

  joinedAt: { type: Date, default: Date.now },
});

// Compound Index: Ensures a user can't be added twice to the SAME hotel
HotelStaffSchema.index({ hotelId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("HotelStaff", HotelStaffSchema);
