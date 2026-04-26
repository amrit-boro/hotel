const Hotel = require("../models/hotel");
const HotelStaff = require("../models/hotelStuff");

exports.determineHotelId = async (user, providedId) => {
  // 1. If ID is provided explicitly, use it (The safe way) which is hotelId
  if (providedId) return providedId;

  // 2. If NO ID provided, try to find it automatically
  // A. Check if they are an OWNER of any hotel
  const ownedHotels = await Hotel.find({ ownerId: user._id.toString() });
  console.log("OwnedHote:", ownedHotels);

  // B. Check if they are STAFF at any hotel
  const staffRecords = await HotelStaff.find({ userId: user._id.toString() });

  // 4. COMBINE THEM INTO A LIST OF UNIQUE IDs
  // We use a Set to automatically remove duplicates
  const distinctHotelIds = new Set();

  ownedHotels.forEach((h) => distinctHotelIds.add(h._id.toString()));
  staffRecords.forEach((s) => distinctHotelIds.add(s.hotelId.toString()));

  const uniqueCount = distinctHotelIds.size;

  // SCENARIO 1: New user or no hotels
  if (uniqueCount === 0) {
    throw new AppError("You are not linked to any hotel.", 400);
  }

  // SCENARIO 2: Single Hotel (The "Auto-Detect" Magic ✨)
  if (uniqueCount === 1) {
    if (ownedHotels.length === 1) return ownedHotels[0]._id;
    if (staffRecords.length === 1) return staffRecords[0].hotelId;
  }

  // SCENARIO 3: Multiple Hotels (Ambiguity 🛑)
  if (uniqueCount > 1) {
    throw new AppError(
      "You manage multiple hotels. Please specify 'hotelId'.",
      400
    );
  }
};
