const express = require("express");
const authController = require("../controller/authController");
const hotelController = require("../controller/hotelController");

const router = express.Router();
router.use(authController.protect);
router.route("/").post(hotelController.registerHotel);
// get hotel

module.exports = router;
