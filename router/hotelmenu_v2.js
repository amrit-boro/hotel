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
router.get(
  "/:hotelId/available/full",
  hotelMenuController_v2.getAvailableMenuItems,
);

/* =========================
   CREATE ROUTES
========================= */
router.post(
  "/add-item/:id",
  uploadImage.single("image"),
  (req, res, next) => {
    console.log("file: ", req.file);
  },
  hotelMenuController_v2.addNewItem,
);

/* =========================
   UPDATE ROUTES
========================= */
router.patch(
  "/update-item/:id/:itemIndex",
  uploadImage.single("image"),
  hotelMenuController_v2.updateItem,
);

router.patch(
  "/:id/:itemIndex/restore",
  hotelMenuController_v2.restoreSoftDeleteItem,
);

router.patch(
  "/option-availability/:id/:itemIndex/:optionIndex",
  hotelMenuController_v2.updateOptionAvailability,
);

router.patch(
  "/choice-availability/:id/:itemIndex/:optionIndex/:choiceIndex",
  hotelMenuController_v2.updateChoiceAvailability,
);

/* =========================
   DELETE ROUTES
========================= */
router.delete(
  "/hard-delete/:id/:itemIndex",
  hotelMenuController_v2.hardDeleteItem,
);

router.delete(
  "/delete-choice/:id/:itemIndex/:optionIndex/:choiceIndex",
  hotelMenuController_v2.deleteChoice,
);

router.delete("/:id/:itemIndex", hotelMenuController_v2.softDeleteItem);

module.exports = router;
