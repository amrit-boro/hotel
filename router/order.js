const express = require("express");
const router = express.Router();
const orderController = require("../controller/orderController");

// Create Order-------------------------------------------------
router.post("/", orderController.createOrder);

// 👨‍🍳 KITCHEN: Get Active Orders---------------------------
router.get("/kitchen/:hotelId", orderController.getOrders);

// Giving status from the kitchen------------------------------------
router.patch("/:id/status", orderController.updateOrderStatus);
router.get("/qr/:tabeId", orderController.qr);

module.exports = router;
