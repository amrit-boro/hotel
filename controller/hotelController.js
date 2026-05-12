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
  const logoUrl = req.file
    ? req.file.path
    : "https://example.com/default-logo.png";

  const logoUrlPublicId = req.file ? req.file.filename : null;

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
          logoUrl,
          logoUrlPublicId,
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
    console.log(error); // ADD THIS

    await session.abortTransaction();

    // CRITICAL: Delete the uploaded image from Cloudinary
    // so we don't store files for hotels that failed to create
    if (req.file && req.file.filename) {
      await cloudinary.uploader.destroy(req.file.filename);
    }

    return next(error);
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

// UPDATE HOTEL LOGO
exports.updateLogo = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  console.log(req.file);
  // Validate hotel id
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Please provide a valid hotelId", 400));
  }

  // Check file uploaded
  if (!req.file) {
    return next(new AppError("Please upload a logo", 400));
  }

  // Check hotel exists
  const hotel = await Hotel.findById(id);

  if (!hotel) {
    return next(new AppError(`Hotel not found with Id ${id}`, 404));
  }

  // Authorization check
  if (hotel.ownerId.toString() !== req.user.id) {
    return next(new AppError("You are not allowed to update this hotel", 403));
  }

  // Delete old logo from cloudinary
  if (hotel.logoUrlPublicId) {
    await cloudinary.uploader.destroy(hotel.logoUrlPublicId);
  }

  // New uploaded logo
  hotel.logoUrl = req.file.path;
  hotel.logoUrlPublicId = req.file.filename;

  await hotel.save();

  console.log("successfull");
  res.status(200).json({
    status: "success",
    message: "Logo updated successfully",
    data: {
      hotel,
    },
  });
});

exports.updateHotel = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  console.log(req.file);
  console.log(req.body);
  // Validate hotel id
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new AppError("Please provide valid hotelId", 400));
  }

  // Allowed fields
  const ALLOWED_FIELDS = ["name", "phone", "location"];

  const filterBody = {};

  // Filter req.body fields
  Object.keys(req.body).forEach((key) => {
    if (ALLOWED_FIELDS.includes(key)) {
      filterBody[key] = req.body[key];
    }
  });

  // Handle image upload
  if (req.file) {
    filterBody.logoUrl = req.file.path;

    // If using Cloudinary
    filterBody.logoUrlPublicId = req.file.filename;
  }

  // Check hotel exists
  const isHotelExists = await Hotel.findById(id);

  if (!isHotelExists) {
    return next(new AppError(`Hotel not found with Id ${id}`, 404));
  }

  console.log("filterBody", filterBody);

  // Update hotel
  const hotel = await Hotel.findOneAndUpdate(
    {
      _id: id,
      ownerId: req.user.id,
    },
    {
      $set: filterBody,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  res.status(200).json({
    status: "success",
    message: "Hotel updated successfully",
    data: {
      hotel,
    },
  });
});
