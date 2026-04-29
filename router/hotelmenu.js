const express = require("express");
const { uploadImage, cloudinary } = require("../utils/cloudinary");
const hotelMenuController = require("../controller/hotelmenuController");
const authController = require("../controller/authController");
const router = express.Router();

// CUSTOMER WILL SCAN AND GET THE MENU---------------------------------
router.get("/", hotelMenuController.allItem);

// Item details ===================
router.get("/item/:itemId", hotelMenuController.getItem);
// CREATE MENU ==============
router.post(
  "/create",
  uploadImage.single("image"),
  hotelMenuController.createMenu,
);

// ======================================================
// router.use(authController.protect);

// ======================================================
// 2. UPDATE ITEM (With Image)
router.patch(
  "/update/:id",
  uploadImage.single("image"),
  hotelMenuController.updateMenu,
);

router.patch(
  "/update/choic-availability/:id",
  hotelMenuController.updateChoiceAvailability,
);

router.delete("/delete/:id", hotelMenuController.deleteMenu);

module.exports = router;
