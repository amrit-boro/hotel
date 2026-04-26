const Hotel = require("../models/hotel");
const HotelStaff = require("../models/hotelStuff");

exports.checkMenuPermission = async (userId, hotelId) => {
  // 1. Check if Owner
  const hotel = await Hotel.findById(hotelId);
  if (!hotel) return false;

  if (hotel.ownerId.equals(userId)) {
    console.log("Owner hoi...");
    return true; // Owner passes
  }
  console.log("Owner nohoi.....");

  // 2. Check if Staff with Permission
  const staff = await HotelStaff.findOne({ userId, hotelId });

  if (staff && staff.permissions.canEditMenu === true) {
    console.log("Staff hoi.....");
    return true; // Vikram passes
  }

  return false; // Everyone else fails
};
