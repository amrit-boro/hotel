const catchAsync = require("../utils/catchAsync");
const mongoose = require("mongoose");
const Hotel = require("../models/hotel");
const User = require("../models/userSchema");
const HotelStaff = require("../models/hotelStuff");
const AppError = require("../utils/appError");
const { cloudinary } = require("../utils/cloudinary");

// Register new hotel with free trial
exports.registerHotel = catchAsync(async (req, res, next) => {
  const { name, location, phone } = req.body;
  const ownerId = req.user._id;

  // 1. Validation check if image was uploaded by Multer
  if (!req.file) {
    return next(new AppError("Please provide a logo", 400));
  }

  // 2. Optimization: Check for existing hotel before starting heavy logic
  // Check if owner already has a hotel
  const existingHotel = await Hotel.findOne({
    ownerId,
    isDeleted: { $ne: true },
  });

  if (existingHotel) {
    // Professional Cleanup: Delete the image from Cloudinary since we are aborting
    await cloudinary.uploader.destroy(req.file.filename);
    return next(new AppError("You already have a registered hotel", 400));
  }

  // Start Database Transaction ====
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 4. Create Hotel
    const [newHotel] = await Hotel.create(
      [
        {
          ownerId,
          name,
          location,
          phone,
          logoUrl: req.file.path,
          logoUrlPublicId: req.file.filename,
          isActive: true,
          subscriptionPlan: "free_trial",
        },
      ],
      {
        session,
      },
    );

    // Upgrade User Role
    await User.findByIdAndUpdate(
      ownerId,
      { role: "owner" },
      { session, runValidators: true },
    );

    // Success: Commit changes
    await session.commitTransaction();
    res.status(201).json({
      status: "success",
      message: "Hotel registered successfully",
      data: { hotel: newHotel },
    });
  } catch (error) {
    // 6. Rollback: Something went wrong in the DB
    await session.abortTransaction();

    // CRITICAL: Delete the uploaded image from Cloudinary
    // so we don't store files for hotels that failed to create
    if (req.file && req.file.filename) {
      await cloudinary.uploader.destroy(req.file.filename);
    }

    return next(new AppError("Registration failed. Please try again", 500));
  } finally {
    session.endSession();
  }
});

exports.getHotel = catchAsync(async (req, res, next) => {
  const hotel = await Hotel.findOne({
    _id: req.params.id,
    ownerId: req.user._id,
    isActive: true,
  });

  if (!hotel) return next(new AppError("Hotel not found", 404));

  res.status(200).json({ status: "success", data: { hotel } });
});
