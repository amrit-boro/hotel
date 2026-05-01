const catchAsync = require("../utils/catchAsync");
const Hotel = require("../models/hotel");
const User = require("../models/userSchema");
const HotelStaff = require("../models/hotelStuff");
const { default: mongoose } = require("mongoose");
const AppError = require("../utils/appError");

// Register new hotel with free trial
exports.registerHotel = catchAsync(async (req, res, next) => {
  const { name, location, phone, email, openingTime, closingTime } = req.body;

  const ownerId = req.user._id;

  // Check if owner already has a hotel
  const existingHotel = await Hotel.findOne({
    ownerId,
    isDeleted: { $ne: true },
  });
  if (existingHotel) {
    return next(new AppError("You already have a registered hotel", 400));
  }

  // Don't include subscriptionExpiresAt - let pre-save middleware handle it
  const hotel = await Hotel.create({
    ownerId,
    name,
    location,
    phone,
    email,
    openingTime: openingTime || "10:00",
    closingTime: closingTime || "22:00",
    isActive: true,
    subscriptionPlan: "free_trial",
    // subscriptionExpiresAt will be auto-set by pre-save middleware
  });

  // ✅ ROLE UPGRADE GOES HERE
  await User.findByIdAndUpdate(req.user._id, {
    role: "owner",
  });

  res.status(201).json({
    status: "success",
    message: "Hotel created successfully with 30-day free trial",
    data: {
      hotel,
    },
  });
});
