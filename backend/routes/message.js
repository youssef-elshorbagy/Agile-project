const express = require("express");
const router = express.Router();
const { protectRoutes } = require("../controllers/auth.controllers");
const { getMessages, sendMessage, getConversation, getParentMessages, sendParentMessage } = require("../controllers/message.controller");

// Protect all routes
router.use(protectRoutes);

// Get all messages for current user
router.get("/", getMessages);

// Parent-specific message endpoints
router.get("/parent", getParentMessages);
router.post("/parent", sendParentMessage);

// Send a new message
router.post("/", sendMessage);

// Get conversation with specific user
router.get("/conversation/:userId", getConversation);

module.exports = router;