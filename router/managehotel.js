const express = require("express");
const authController = require("../controller/authController");
const hotelController = require("../controller/hotelController");

const router = express.Router();

router.route("/").post(hotelController.registerHotel);

module.exports = router;
