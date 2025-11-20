const express = require("express");
const userControllers = require("../controllers/auth.controllers");
// REMOVED: upload middleware
// REMOVED: multerErrorHandler
const router = express.Router();

// CHANGED: Removed upload.single("photo") and multerErrorHandler
router.post("/signup", userControllers.signup); 

router.post("/login", userControllers.login);
router.get("/", userControllers.protectRoutes, userControllers.getAllUsers);
router.get("/profile", userControllers.protectRoutes, userControllers.getProfile);
router.patch("/profile", userControllers.protectRoutes, userControllers.updateProfile);

module.exports = router;

// get post put delete
// view create update delete 
// const response = axios.get("localhost:3000/users", { });
// console.log(response);
// 