const Hotel = require("../models/hotel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

// Check if hotel subscription is active
exports.checkSubscription = catchAsync(async (req, res, next) => {
  let hotelId;

  // Get hotelId from different sources
  if (req.params.hotelId) {
    hotelId = req.params.hotelId;
  } else if (req.body.hotelId) {
    hotelId = req.body.hotelId;
  } else if (req.query.hotelId) {
    hotelId = req.query.hotelId;
  } else if (req.user && req.user.hotelId) {
    hotelId = req.user.hotelId;
  }

  if (!hotelId) {
    return next(new AppError("Hotel ID not found", 400));
  }

  const hotel = await Hotel.findById(hotelId).select(
    "isActive subscriptionPlan subscriptionExpiresAt",
  );

  if (!hotel) {
    return next(new AppError("Hotel not found", 404));
  }

  // Check if hotel is deactivated
  if (!hotel.isActive) {
    return next(
      new AppError(
        "Your account has been deactivated due to non-payment. Please contact support to reactivate.",
        403,
      ),
    );
  }

  // Check if subscription is expired
  const now = new Date();
  if (hotel.subscriptionExpiresAt && hotel.subscriptionExpiresAt < now) {
    // Auto-deactivate if expired
    await Hotel.findByIdAndUpdate(hotelId, { isActive: false });

    return next(
      new AppError(
        "Your subscription has expired. Please renew to continue using our services.",
        403,
      ),
    );
  }

  // Hotel is active, proceed
  req.hotel = hotel;
  next();
});
