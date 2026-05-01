const { default: mongoose } = require("mongoose");
const Hotel = require("../models/hotel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

// Check if hotel subscription is active
// middlewares/subscriptionMiddleware.js

exports.checkSubscription = catchAsync(async (req, res, next) => {
  let hotelId = null;

  // PRIORITY 1: Get hotelId from request (attached by protect middleware)
  if (req.hotelId) {
    hotelId = req.hotelId;
  }
  // PRIORITY 2: From request params
  else if (req.params.hotelId) {
    hotelId = req.params.hotelId;
  }
  // PRIORITY 3: From request body
  else if (req.body.hotelId) {
    hotelId = req.body.hotelId;
  }
  // PRIORITY 4: From query string
  else if (req.query.hotelId) {
    hotelId = req.query.hotelId;
  }
  // PRIORITY 5: From headers
  else if (req.headers["x-hotel-id"]) {
    hotelId = req.headers["x-hotel-id"];
  }

  // If user is logged in but has no hotelId in token, check database
  if (!hotelId && req.user) {
    const hotel = await Hotel.findOne({ ownerId: req.user._id });
    if (hotel) {
      hotelId = hotel._id;
      // Attach to request for future use
      req.hotelId = hotelId;
    }
  }

  // If STILL no hotelId, user hasn't created a hotel yet
  if (!hotelId) {
    // Allow access to hotel creation routes only
    const isHotelCreationRoute =
      (req.path === "/" && req.method === "POST") ||
      req.path === "/register" ||
      (req.path.includes("/hotel") && req.method === "POST");

    if (isHotelCreationRoute) {
      return next(); // Allow access to create hotel
    }

    // Block access to other routes
    return next(
      new AppError(
        "Please create a hotel first before accessing this feature.",
        400,
      ),
    );
  }

  // Validate hotelId format
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    return next(new AppError("Invalid hotel ID format", 400));
  }

  // Fetch hotel with subscription details
  const hotel = await Hotel.findById(hotelId).select(
    "isActive subscriptionPlan subscriptionExpiresAt name email",
  );

  if (!hotel) {
    return next(new AppError("Hotel not found", 404));
  }

  // Check if hotel is deactivated
  if (!hotel.isActive) {
    return next(
      new AppError(
        "Your account has been deactivated. Please contact support or renew your subscription.",
        403,
      ),
    );
  }

  // Check if subscription is expired
  const now = new Date();
  if (hotel.subscriptionExpiresAt && hotel.subscriptionExpiresAt < now) {
    // Auto-deactivate expired hotel
    await Hotel.findByIdAndUpdate(hotelId, {
      isActive: false,
      deactivatedReason: "Subscription expired",
      deactivatedAt: now,
    });

    return next(
      new AppError(
        `Your subscription expired on ${hotel.subscriptionExpiresAt.toDateString()}. Please renew to continue.`,
        403,
      ),
    );
  }

  // Check if subscription is about to expire (send warning in response header)
  const daysRemaining = Math.ceil(
    (hotel.subscriptionExpiresAt - now) / (1000 * 60 * 60 * 24),
  );
  if (daysRemaining <= 7 && daysRemaining > 0) {
    res.setHeader("X-Subscription-Expiring", `${daysRemaining}`);
    res.setHeader(
      "X-Subscription-Expiry-Date",
      hotel.subscriptionExpiresAt.toISOString(),
    );
  }

  // Attach hotel info to request for use in controllers
  req.hotel = hotel;
  req.hotelId = hotelId;

  next();
});
