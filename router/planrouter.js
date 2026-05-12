const express = require("express");
const router = express.Router();
const authController = require("../controller/authController");

router.get(
  "/check-warning",
  authController.protect,
  authController.restrictTo("owner"),
  authController.checkSubscription,
  (req, res) => {
    res.status(200).json({
      message: "Success",
    });
  },
);

module.exports = router;
