const express = require("express");
const { uploadImage, cloudinary } = require("../utils/cloudinary");
const hotelMenuController = require("../controller/hotelmenuController");
const hotelMenuController_v2 = require("../controller/hotelmenuController_v2");

const authController = require("../controller/authController");
const router = express.Router();

// All routes require authentication and active subscription
router.use(
  authController.protect,
  authController.restrictTo("owner"),
  authController.checkSubscription,
);

// Delete routes
router.delete("/:id", hotelMenuController.deleteMenuItem); // Hard
// router.patch("/:id/soft-delete", hotelMenuController.softDeleteMenuItem); v1
// router.patch("/:id/restore", hotelMenuController.restoreMenuItem);  v1

// // Hotel level operations
router.delete("/hotel/:hotelId/all", hotelMenuController.deleteAllHotelItems);

// // Cleanup (Admin only)
router.delete(
  "/cleanup/soft-deleted",
  hotelMenuController.cleanupSoftDeletedItems,
);

// // ======================================================
// // 2. UPDATE ITEM (With Image)
router.patch(
  "/update/:id",
  uploadImage.single("image"),
  hotelMenuController.updateMenu,
);

router.patch(
  "/update/choic-availability/:id",
  hotelMenuController.updateChoiceAvailability,
);

// // Regular CRUD

router.route("/").get(authController.protect, hotelMenuController.allItem);

// router
//   .route("/:hotelId/create")
// .post(uploadImage.single("image"), hotelMenuController.createMenu);

//v2
router
  .route("/:hotelId/create")
  .post(uploadImage.single("image"), hotelMenuController_v2.createMenu);

router.get("/:itemId", hotelMenuController.getItem);

// Option management routes
router.post("/:id/options", hotelMenuController.addOption);
router
  .route("/:id/options/:optionIndex")
  .put(hotelMenuController.updateOption)
  .delete(hotelMenuController.removeOption);

module.exports = router;
