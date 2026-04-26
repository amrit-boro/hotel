const express = require("express");
const cors = require("cors");
const http = require("http");
// REMOVED: const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// --- SECURITY PACKAGES ---
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");

// --- ROUTE IMPORTS ---
const authrouter = require("./router/auth");
const hotelMenu = require("./router/hotelmenu");
const order = require("./router/order");
const manageHotel = require("./router/managehotel");
const manageHotelstaff = require("./router/Hotelstaff");

// --- UTILS ---
const globalErrorHandler = require("./controller/errorController");
const AppError = require("./utils/appError");

// 1. SETUP WHITELIST
const whitelist = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

// 2. INITIALIZE APP & SERVER
const app = express();
const server = http.createServer(app);

// REMOVED: Socket.IO initialization

// 4. CORS CONFIGURATION
// const corsOptions = {
//   origin: (origin, callback) => {
//     if (!origin) return callback(null, true);
//     if (whitelist.indexOf(origin) !== -1) {
//       callback(null, true);
//     } else {
//       console.error(`Blocked by CORS: ${origin}`);
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// };

// ==================================================
// 🛡️ SECURITY & MIDDLEWARE STACK
// ==================================================

// A. Security Headers
app.use(helmet());

// B. Rate Limiting
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests from this IP, please try again in an hour!",
});
app.use("/api", limiter);

// C. CORS
app.use(
  cors({
    origin: "http://10.233.127.165:5173",
    credentials: true,
  }),
);
// D. Body Parsers
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

// E. Data Sanitization
// app.use((req, res, next) => {
//   if (req.body) req.body = mongoSanitize.sanitize(req.body);
//   if (req.params) req.params = mongoSanitize.sanitize(req.params);
//   next();
// });

// F. Prevent Parameter Pollution
// app.use(hpp());

// ==================================================

// REMOVED: req.io injection middleware

// REMOVED: socket connection logic

// 7. ROUTES
app.use((req, res, next) => {
  console.log("Hello from the server");
  next();
});

app.use("/api/auth", authrouter);
app.use("/api/hotel", manageHotel);
// app.use("/api/hotelStaff", manageHotelstaff);
app.use("/api/v1/menu", hotelMenu);
// app.use("/api/orders", order);

// 8. ERROR HANDLER
app.use((req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl}`, 404));
});

app.use(globalErrorHandler);

module.exports = server;
