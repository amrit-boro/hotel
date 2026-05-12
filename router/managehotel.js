const express = require("express");
const authController = require("../controller/authController");
const hotelController = require("../controller/hotelController");
const { uploadImage, cloudinary } = require("../utils/cloudinary");

const router = express.Router();
router.use(authController.protect); // PROTECT
router
  .route("/register")
  .post(uploadImage.single("logo"), hotelController.registerHotel); // REGISTER HOTEL

// GET route
router.use(authController.restrictTo("owner"));
router.patch(
  "/updateLogo/:id",
  uploadImage.single("image"),
  hotelController.updateLogo,
);
router
  .route("/:id")
  .get(hotelController.getHotel)
  .patch(uploadImage.single("image"), hotelController.updateHotel); // GET HOTEL

module.exports = router;
