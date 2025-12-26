const express = require("express");
const router = express.Router();
const announcementController = require("../controllers/announcement.controller");
const userControllers = require("../controllers/auth.controllers");

// Protect all announcement routes
router.use(userControllers.protectRoutes);

// Get announcements (Automatically handles Student/Teacher/Parent logic)
router.get("/", announcementController.getAllAnnouncements);

module.exports = router;