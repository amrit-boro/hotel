const User = require("../models/userSchema");
const Hotel = require("../models/hotel");
const cloudinary = require("../utils/cloudinary"); // your cloudinary config
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// ─── helpers ─────────────────────────────────────────────────────────────────

const filterObj = (obj, ...allowedFields) => {
  const filtered = {};
  allowedFields.forEach((f) => {
    if (obj[f] !== undefined) filtered[f] = obj[f];
  });
  return filtered;
};

// Upload base64 / buffer to cloudinary and return { url, publicId }
const uploadToCloudinary = async (file, folder) => {
  const result = await cloudinary.uploader.upload(file, {
    folder,
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
    ],
  });
  return { url: result.secure_url, publicId: result.public_id };
};

// ─── USER ─────────────────────────────────────────────────────────────────────

// GET /api/users/me
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (!user) return next(new AppError("User not found", 404));

  res.status(200).json({ status: "success", data: { user } });
});

// PATCH /api/users/me
exports.updateMe = catchAsync(async (req, res, next) => {
  // Block password updates through this route
  if (req.body.password || req.body.passwordConfirm)
    return next(
      new AppError(
        "This route is not for password updates. Use /updateMyPassword.",
        400,
      ),
    );

  const filtered = filterObj(req.body, "name", "email");

  // Handle photo upload
  if (req.body.photo) {
    // Delete old photo from cloudinary if exists
    const currentUser = await User.findById(req.user._id);
    if (currentUser.photoPublicId) {
      await cloudinary.uploader.destroy(currentUser.photoPublicId);
    }

    const { url, publicId } = await uploadToCloudinary(
      req.body.photo,
      "qrmenu/users",
    );
    filtered.photo = url;
    filtered.photoPublicId = publicId;
  }

  const updatedUser = await User.findByIdAndUpdate(req.user._id, filtered, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ status: "success", data: { user: updatedUser } });
});

// PATCH /api/users/updateMyPassword
exports.updateMyPassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword)
    return next(new AppError("Please provide all password fields", 400));

  if (newPassword !== confirmPassword)
    return next(new AppError("New passwords do not match", 400));

  if (newPassword.length < 8)
    return next(new AppError("Password must be at least 8 characters", 400));

  const user = await User.findById(req.user._id).select("+password");

  const isCorrect = await user.correctPassword(currentPassword, user.password);
  if (!isCorrect)
    return next(new AppError("Current password is incorrect", 401));

  user.password = newPassword;
  user.passwordChangedAt = Date.now();
  await user.save();

  res
    .status(200)
    .json({ status: "success", message: "Password updated successfully" });
});

// ─── HOTEL ────────────────────────────────────────────────────────────────────

// GET /api/hotels/:id
exports.getHotel = catchAsync(async (req, res, next) => {
  const hotel = await Hotel.findOne({
    _id: req.params.id,
    ownerId: req.user._id,
    isDeleted: false,
  });

  if (!hotel) return next(new AppError("Hotel not found", 404));

  res.status(200).json({ status: "success", data: { hotel } });
});

// PATCH /api/hotels/:id
exports.updateHotel = catchAsync(async (req, res, next) => {
  const hotel = await Hotel.findOne({
    _id: req.params.id,
    ownerId: req.user._id,
    isDeleted: false,
  });

  if (!hotel) return next(new AppError("Hotel not found", 404));

  const filtered = filterObj(req.body, "name", "phone", "location");

  // Handle logo upload
  if (req.body.logoUrl) {
    // Delete old logo from cloudinary
    if (hotel.logoUrlPublicId) {
      await cloudinary.uploader.destroy(hotel.logoUrlPublicId);
    }

    const { url, publicId } = await uploadToCloudinary(
      req.body.logoUrl,
      "qrmenu/hotels",
    );
    filtered.logoUrl = url;
    filtered.logoUrlPublicId = publicId;
  }

  const updatedHotel = await Hotel.findByIdAndUpdate(req.params.id, filtered, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ status: "success", data: { hotel: updatedHotel } });
});

// DELETE /api/hotels/:id  (soft delete)
exports.deleteHotel = catchAsync(async (req, res, next) => {
  const hotel = await Hotel.findOne({
    _id: req.params.id,
    ownerId: req.user._id,
    isDeleted: false,
  });

  if (!hotel) return next(new AppError("Hotel not found", 404));

  hotel.isDeleted = true;
  hotel.deletedAt = new Date();
  hotel.isActive = false;
  await hotel.save({ validateBeforeSave: false });

  res
    .status(200)
    .json({ status: "success", message: "Hotel deleted successfully" });
});
