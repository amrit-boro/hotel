const User = require("../models/userSchema");
const Hotel = require("../models/hotel");

const { promisify } = require("util");
const sendEmail = require("../utils/email");
const crypto = require("crypto");

const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// --- 2. HELPER: Send Cookie & Response ---
// const createSendToken = (user, statusCode, res) => {
//   const token = signToken(user._id);

//   // Define Cookie Options
//   const cookieOptions = {
//     expires: new Date(
//       Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000, //Note: JWT_COOKIE_EXPIRES_IN is just a number (90), because inside the code we multiply it to turn it into milliseconds)
//     ), // Convert days to milliseconds
//     httpOnly: true, // IMPORTANT: Prevents browser JS from reading the cookie
//   };

//   // Only send over HTTPS in production
//   if (process.env.NODE_ENV === "production") {
//     cookieOptions.secure = true;
//     cookieOptions.sameSite = "None"; // Required for cross-site cookies in prod
//   }

//   // ✅ SEND THE COOKIE
//   res.cookie("jwt", token, cookieOptions);

//   // Remove password from output (Security)
//   user.password = undefined;

//   res.status(statusCode).json({
//     status: "success",
//     token, // We send it in JSON too, just in case specific clients need it
//     data: {
//       user,
//     },
//   });
// };

const createSendToken = (user, statusCode, res, redirectUrl) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
    sameSite: "Lax", // important for redirect
  };

  res.cookie("jwt", token, cookieOptions);

  user.password = undefined;

  // 🔥 OAuth flow → redirect
  if (redirectUrl) {
    return res.redirect(redirectUrl);
  }

  // normal API response
  res.status(statusCode).json({
    status: "success",
    token,
    data: { user },
  });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and checking if it's there
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // ✅ ADD THIS — block the logout sentinel before jwt.verify runs
  if (!token || token === "loggedout") {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401),
    );
  }

  // 2) Verification token
  // If token is invalid/expired, this throws error caught by globalErrorHandler
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError("The user belonging to this token no longer exists.", 401), // <--- ADDED 401
    );
  }

  // 4) Check if user changed password after the token was issued
  // We pass the 'iat' (issued at) timestamp from the token
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401),
    );
  }

  // Attach the hotel that belongs to this owner
  const hotel = await Hotel.findOne({
    ownerId: currentUser._id,
    isDeleted: { $ne: true },
  });

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  req.user.hotelId = hotel?._id ?? null; // safely attach, null if no hotel yet

  res.locals.user = currentUser; // Useful for server-side rendering (optional)
  next();
});

// const generateToken = (payload) => {};

exports.register = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    // passwordConfirm: req.body.passwordConfirm,
    role: "user",
  });

  // 2. Log them in immediately (Send Cookie & Token)
  // We use 201 for "Created"
  createSendToken(newUser, 201, res);
});

// Google callback
exports.googleCallback = (req, res) => {
  createSendToken(req.user, 200, res, "http://localhost:5173/welcome");
};
// --- 3. LOGIN CONTROLLER ---
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }

  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // 3) If everything ok, send token via Cookie
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  // We send a cookie with the same name but set its expiration to a date in the past
  res.cookie("jwt", "loggedout", {
    httpOnly: true,
    maxAge: 0,
  });

  res.status(200).json({
    status: "success",
    message: "User logged out successfully",
  });
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};

// A. FORGOT PASSWORD (User requests link)
exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with that email address.", 404));
  }

  // 2. Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false }); // Save token to DB

  // 3. Send it to user's email
  // Frontend URL: http://localhost:5173/reset-password/TOKEN
  const resetURL = `${req.protocol}://${
    process.env.FRONTEND_URL || "localhost:5173"
  }/reset-password/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your Password Reset Token (Valid for 10 min)",
      message,
    });

    res.status(200).json({
      status: "success",
      message: "Token sent to email!",
    });
  } catch (err) {
    // If email fails, delete the token so user can try again
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("There was an error sending the email. Try again later!"),
      500,
    );
  }
});

// B. RESET PASSWORD (User clicks link & sends new password)
exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on the token
  // We must HASH the incoming token to match what's in the DB
  console.log("token: ", req.params.token);
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }, // Token must not be expired
  });

  // 2. If token invalid/expired
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }

  // 3. Update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  // Clear reset fields
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  // Update 'passwordChangedAt' property (Critical for your 'protect' middleware!)
  user.passwordChangedAt = Date.now();

  await user.save(); // This triggers pre('save') hooks to hash password

  // 4. Log the user in (Send new cookie)
  createSendToken(user, 200, res);
});

// controllers/authController.js

exports.getMe = async (req, res) => {
  const token = req.cookies.jwt;
  if (!token) {
    return res.status(401).json({ status: "fail", message: "Not logged in" });
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  const user = await User.findById(decoded.id).select("-password");

  res.status(200).json({
    status: "success",
    data: { user },
  });
};

// SubsScription

// authController.js  (add this alongside your protect middleware)

exports.checkSubscription = catchAsync(async (req, res, next) => {
  // 1) Read-only methods always pass through
  const READ_ONLY_METHODS = ["GET", "HEAD", "OPTIONS"];
  if (READ_ONLY_METHODS.includes(req.method)) return next();

  // 2) Resolve hotelId from request
  const hotelId = req.user.hotelId;

  if (!hotelId) {
    return next(new AppError("No hotel associated with this request.", 400));
  }

  // 3) Fetch hotel — NOT lean() so virtuals (subscriptionStatus, daysRemaining) work
  const hotel = await Hotel.findOne({
    _id: hotelId,
    isDeleted: false, // respect soft-delete
  }).select("+isDeleted subscriptionPlan subscriptionExpiresAt ownerId");

  if (!hotel) {
    return next(new AppError("Hotel not found.", 404));
  }

  // 4) Ownership guard — your schema uses ownerId, not owner
  if (hotel.ownerId.toString() !== req.user._id.toString()) {
    return next(
      new AppError("You do not have permission to modify this hotel.", 403),
    );
  }

  // 5) Use the virtual to check subscription status
  //    virtual returns "active" | "expired"  (see your schema)
  if (hotel.subscriptionStatus === "expired") {
    return next(
      new AppError(
        `Your ${formatPlan(hotel.subscriptionPlan)} has expired. ` +
          "Please renew your subscription to continue.",
        403,
      ),
    );
  }

  // 6) Warn if subscription is expiring soon (≤ 5 days) but still let request through
  //    Frontend can read this header and show a banner
  if (hotel.daysRemaining <= 5 && hotel.daysRemaining > 0) {
    res.set(
      "X-Subscription-Warning",
      `Your subscription expires in ${hotel.daysRemaining} day(s).`,
    );
  }

  // 7) Attach hotel to req — downstream controllers won't need to re-fetch
  req.hotel = hotel;
  next();
});

// Helper: turns "free_trial" → "Free Trial", "premium" → "Premium"
function formatPlan(plan) {
  return plan
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
