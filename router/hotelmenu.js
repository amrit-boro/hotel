const express = require("express");
const { uploadImage, cloudinary } = require("../utils/cloudinary");
const hotelMenuController = require("../controller/hotelmenuController");
const authController = require("../controller/authController");
const { checkSubscription } = require("../middlewares/subcriptionMiddleware");
const router = express.Router();

// All routes require authentication and active subscription
// router.use(checkSubscription);

// Delete routes
router.delete("/:id", hotelMenuController.deleteMenuItem);
router.patch("/:id/soft-delete", hotelMenuController.softDeleteMenuItem);
router.patch("/:id/restore", hotelMenuController.restoreMenuItem);
router.patch("/:id/:optionIndex", hotelMenuController.softDeleteOption);
router.patch(
  "/:id/:optionIndex/restore",
  hotelMenuController.restoreSoftDeleteOption,
);

router.delete("/:id/option/:optionIndex", hotelMenuController.deleteOption); // Delete a Specific Option
router.delete(
  "/:id/option/:optionIndex/choice/:choiceIndex",
  hotelMenuController.deleteChoice,
);

// Bulk operations
router.post("/bulk-delete", hotelMenuController.bulkDeleteMenuItems);
router.post("/bulk-soft-delete", hotelMenuController.bulkSoftDeleteMenuItems);

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

router.route("/").get(hotelMenuController.allItem);

router
  .route("/:hotelId/create")
  .post(uploadImage.single("image"), hotelMenuController.createMenu);

router.get("/:itemId", hotelMenuController.getItem);

// Option management routes
router.post("/:id/options", hotelMenuController.addOption);
router
  .route("/:id/options/:optionIndex")
  .put(hotelMenuController.updateOption)
  .delete(hotelMenuController.removeOption);

module.exports = router;
