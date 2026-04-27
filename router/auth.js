const express = require("express");
const authController = require("../controller/authController");
const userController = require("../controller/userController/userController");
const router = express.Router();

router.post("/signup", authController.register);
router.post("/login", authController.login);
router.get("/getAllusers", authController.protect, userController.getAllusers);

router.post("/forgotPassword", authController.forgotPassword);
router.patch("/resetPassword/:token", authController.resetPassword);

module.exports = router;
