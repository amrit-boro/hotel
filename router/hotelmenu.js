const express = require("express");
const { parser: upload, cloudinary } = require("../utils/cloudinary");
const hotelMenuController = require("../controller/hotelmenuController");
const authController = require("../controller/authController");
const router = express.Router();

// CUSTOMER WILL SCAN AND GET THE MENU---------------------------------
router.get("/:hotelId", hotelMenuController.hotelMenu);

// Item details ===================
router.get("/item/:itemId", hotelMenuController.getItem);

// ======================================================
router.use(authController.protect);
// add menu----------------------------------------
router.post("/add", upload.single("image"), hotelMenuController.addMenu);

// ======================================================
// 2. UPDATE ITEM (With Image)
router.patch(
  "/update/:id",
  upload.single("image"),
  hotelMenuController.updateMenu,
);

router.delete("/delete/:id", hotelMenuController.deleteMenu);

module.exports = router;
