const express = require("express");
const authController = require("../controller/authController");
const hotelController = require("../controller/hotelController");

const router = express.Router();

router.post(
  "/Hotelcreation",
  authController.protect,
  hotelController.createHotel
);

module.exports = router;
