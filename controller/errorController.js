const AppError = require("../utils/appError");

const sendErrorDev = (err, res) => {
  // 1. Force a valid status code. If it's missing, assume Server Error (500)
  const statusCode = err.statusCode || 500;
  const status = err.status || "error";

  console.log("🔥 ERROR STATUS:", statusCode); // Helpful for debugging

  res.status(statusCode).json({
    status: status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};
const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.error("Error", err);
    res.status(500).json({
      status: "error",
      message: "Something went very wrong!",
    });
  }
};

const handleDuplicateFieldsDb = (err) => {
  // fallback handling for nested errorResponse
  const value = err.keyValue ? err.keyValue.email : "";
  const message = `${value} already exists. Please use another.`;
  return new AppError(message, 400);
};

const handleCastErrorDB = (err) => {
  return new AppError("Invalid Id", 400);
};

// validation Error --------------------

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data. ${errors.join(". ")}`;
  return new AppError(message, 400);
};

const handleJWTError = () => {
  return new AppError("Your Token has expired! Please login again", 401);
};

const handleJsonwebtoken = () => {
  return new AppError("Invalid Token. Please login Again", 401);
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else if (process.env.NODE_ENV === "production") {
    // 1. Create the copy
    let error = { ...err };

    // 2. FIX: Manually copy the message and name
    error.message = err.message;
    error.name = err.name;

    // 3. Run your specific checks
    if (error.name === "CastError") error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDb(error);
    if (error.name === "ValidationError") error = handleValidationError(error);
    if (error.name === "TokenExpiredError") error = handleJWTError(error);
    if (error.name === "JsonWebTokenError") error = handleJsonwebtoken(error);

    sendErrorProd(error, res);
  }
};
