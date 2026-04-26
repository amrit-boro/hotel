const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const User = require("../models/userSchema");
// FIXED: Typo in filename (ensure file is actually named hotelStaff.js)
const HotelStaff = require("../models/hotelStuff");

exports.createStaff = catchAsync(async (req, res, next) => {
  // 1. Get Inputs
  console.log("user : ", req.user);
  const { email, name, password, hotelId, role, phone } = req.body;
  const requesterId = req.user._id.toString();

  console.log("user Id: ", requesterId);

  // ======================================================
  // 🔒 SECURITY CHECK
  // ======================================================
  // We check if the requester is actually the OWNER of this specific hotel.
  const requesterBadge = await HotelStaff.findOne({
    userId: requesterId,
    hotelId: hotelId,
  });

  if (!requesterBadge || requesterBadge.role !== "hotel_owner") {
    return next(
      new AppError("Access Denied. Only the Hotel Owner can add staff.", 403)
    );
  }
  // ======================================================

  // 2. Find or Create the User (Global Account)
  let staffUser = await User.findOne({ email });

  if (!staffUser) {
    staffUser = await User.create({
      name,
      email,
      password,
      phone,
      passwordConfirm: password, // IMPORTANT: If your User model requires this
      // FIXED: Don't hardcode "chef". Use a generic role or the input role.
      role: "kitchen_staff",
    });
  }

  // 3. Define Permissions (FIXED LOGIC)
  let permissions = {
    canEditMenu: false,
    canManageOrders: false,
    canViewSales: false,
  };

  // --- Logic Correction ---
  if (role === "head_chef") {
    // Managers get everything
    permissions.canEditMenu = true;
    permissions.canManageOrders = true;
    permissions.canViewSales = false;
  } else if (role === "waiter") {
    // Waiters only need to serve
    permissions.canManageOrders = true;
  }

  // 4. Create the Staff Link (With Duplicate Handling)
  try {
    await HotelStaff.create({
      hotelId,
      userId: staffUser._id,
      role,
      permissions,
    });
  } catch (err) {
    // Catch "Duplicate Key" error (Code 11000)
    // This happens if you try to add the same email to the same hotel twice
    if (err.code === 11000) {
      return next(
        new AppError("This user is already staff at this hotel!", 400)
      );
    }
    // If it's a different error, pass it to global handler
    return next(err);
  }

  res.status(201).json({
    success: true,
    msg: `${name} has been added as a ${role}!`,
  });
});
