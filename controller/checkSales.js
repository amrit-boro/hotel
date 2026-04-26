const HotelStaff = require("../models/hotelStuff");
const Hotel = require("../models/hotel");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.protectSale = catchAsync(async (req, res, next) => {
  const userId = req.user._id.toString();

  // We expect hotelId to be in the body (POST) or params (GET)
  // For GET requests, usually it's in params or query
  const hotelId = req.params.hotelId || req.body.hotelId;

  console.log("userid", userId, "hotelId: ", hotelId);

  // 1. Check if Owner (Automatic Pass)
  const hotel = await Hotel.findById(hotelId);
  if (hotel.ownerId.equals(userId)) {
    return next();
  }

  // 2. Check Staff Permissions
  const staffMember = await HotelStaff.findOne({ hotelId, userId });

  if (!staffMember) {
    return next(new AppError("You do not work at this hotel.", 403));
  }

  // 3. THE BLOCKING LOGIC 🛑
  if (staffMember.permissions.canViewSales === false) {
    return next(
      new AppError("Access Denied: You cannot view sensitive sales data.", 403)
    );
  }

  next(); // Permission granted
});
