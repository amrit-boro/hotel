const express = require("express");
const router = express.Router();
const hotelStuffController = require("../controller/hotelStuffController");
const authController = require("../controller/authController");
const checkSales = require("../controller/checkSales");

router.post("/add", authController.protect, hotelStuffController.createStaff);
router.get(
  "/:hotelId/sales",
  authController.protect,
  checkSales.protectSale,
  (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        todayRevenue: 50000,
        totalOrders: 150,
      },
    });
  }
);

module.exports = router;
