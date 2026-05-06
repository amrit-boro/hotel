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
router.get(
  "/:hotelId/categories",
  hotelMenuController_v2.getCategoriesViewData,
);

router.get("/:hotelId/menuItems", hotelMenuController_v2.getMenuItemViewData);

/* =========================
   CREATE ROUTES
========================= */

router
  .route("/createCategory")
  .post(uploadImage.single("image"), hotelMenuController_v2.createCategory);

router
  .route("/createItem")
  .post(uploadImage.single("image"), hotelMenuController_v2.createMenuItem);

// update route

router.route("/:itemId/updateItem", hotelMenuController_v2.updateMenuItem);

router
  .route("/:id/update-itemAvailability")
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

// Options
router.post("/:itemId/options", hotelMenuController_v2.addOption);
router.patch("/:itemId/options/:optionId", hotelMenuController_v2.updateOption);

// Choices
router.post(
  "/:itemId/options/:optionId/choices",
  hotelMenuController_v2.addChoice,
);
router.patch(
  "/:itemId/options/:optionId/choices/:choiceId",
  hotelMenuController_v2.updateChoice,
);

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
