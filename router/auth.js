const express = require("express");
const authController = require("../controller/authController");
const userController = require("../controller/userController/userController");
const router = express.Router();
const passport = require("../utils/googleAuth");

router.post("/signup", authController.register);
router.post("/verify-email", authController.verifyEmail);
router.post("/resend-otp", authController.resendOtp);
router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/getAllusers", authController.protect, userController.getAllusers);

router.get("/me", authController.getMe);

// Step 1: redirect to Google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

// Step 2: callback
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  authController.googleCallback,
);

router.post("/forgotPassword", authController.forgotPassword);
router.patch("/resetPassword/:token", authController.resetPassword);

module.exports = router;
