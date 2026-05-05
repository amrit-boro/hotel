const express = require("express");
const { uploadImage, cloudinary } = require("../utils/cloudinary");
const hotelMenuController_v2 = require("../controller/hotelmenuController_v2");
const authController = require("../controller/authController");

const router = express.Router();

// Protect all routes
router.use(authController.protect, authController.restrictTo("owner"));

/* =========================
   GET ROUTES
========================= */

router.get("/:hotelId/menuDetails", hotelMenuController_v2.menuDetails);

/* =========================
   CREATE ROUTES
========================= */

router
  .route("/:id/createCategory")
  .post(uploadImage.single("image"), hotelMenuController_v2.createCategory);

router
  .route("/:id/createItem")
  .post(uploadImage.single("image"), hotelMenuController_v2.createMenuItem);

router
  .route("/:id/update-item")
  .patch(hotelMenuController_v2.updateItemAvailability);

router
  .route("/:itemId/:optionId/option-availability")
  .patch(hotelMenuController_v2.updateOptionAvailability);

router
  .route("/:itemId/:optionId/:choiceId/choice-availability")
  .patch(hotelMenuController_v2.updateChoiceAvailability);

// Item-level
router.patch("/:itemId/soft-delete", hotelMenuController_v2.softDeleteItem); // soft delete
router.patch("/:itemId/restore", hotelMenuController_v2.restoreItem); // undo soft delete
router.delete("/:itemId", hotelMenuController_v2.hardDeleteItem); // permanent delete

// Option-level
router.delete(
  "/:itemId/options/:optionId",
  hotelMenuController_v2.deleteOption,
);

// Choice-level
router.delete(
  "/:itemId/options/:optionId/choices/:choiceId",
  hotelMenuController_v2.deleteChoice,
);

module.exports = router;
