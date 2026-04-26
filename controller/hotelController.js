const catchAsync = require("../utils/catchAsync");
const Hotel = require("../models/hotel");
const HotelStaff = require("../models/hotelStuff");
const { default: mongoose } = require("mongoose");

exports.createHotel = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  console.log("user Id :", req.user._id.toString());

  try {
    const userid = req.user._id;
    const { name, location, totalTables, kitchenPassword } = req.body;

    // 1. Create the Hotel Document
    // Note: We use [{...}] array syntax because passing {session} requires it
    const newHotel = await Hotel.create(
      [
        {
          name,
          location,
          totalTables,
          kitchenPassword,
          ownerId: userid,
        },
      ],
      { session }
    );

    console.log("new Hotel: ", newHotel);

    const hotelId = newHotel[0]._id.toString();

    // 2. Create the "Owner Badge" (HotelStaff)
    // This gives them the "Super Admin" powers for this specific hotel
    const hotelstaff = await HotelStaff.create(
      [
        {
          userId: userid,
          hotelId,
          role: "hotel_owner", // Make sure this matches your Enum in Schema!
          permissions: {
            canEditMenu: true,
            canManageOrders: true,
            canViewSales: true,
          },
        },
      ],
      { session }
    );

    console.log("hotelStaff: ", hotelstaff);

    // 3. (Optional but Recommended) Update User's Global Role
    // If they registered as a generic "user", upgrade them to "hotel_owner" globally
    // so the frontend knows to show them the "My Hotels" dashboard button.
    // const User = require('../models/User'); // Import if not already imported
    // await User.findByIdAndUpdate(
    //   userid,
    //   { role: 'hotel_owner' },
    //   { session }
    // );

    // 4. Success! Commit everything.
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: {
        hotel: newHotel[0], // Return the object, not the array
      },
    });
  } catch (err) {
    // 5. CRITICAL: If anything fails, undo ALL database changes
    await session.abortTransaction();
    session.endSession();

    // Pass the error to your global error handler
    return next(err);
  }
});
