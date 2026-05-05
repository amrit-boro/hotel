const express = require("express");
const authController = require("../controller/authController");
const hotelController = require("../controller/hotelController");
const { uploadImage, cloudinary } = require("../utils/cloudinary");

const router = express.Router();
router.use(authController.protect);
router
  .route("/register")
  .post(uploadImage.single("logo"), hotelController.registerHotel);
// get hotel

module.exports = router;
