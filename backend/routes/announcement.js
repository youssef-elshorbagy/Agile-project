const express = require("express");
const router = express.Router();

// Example Route
router.get("/", async (req, res) => {
    try {
        // Your logic for fetching announcements
        res.json({ message: "Announcements fetched" });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// IMPORTANT: This is what was missing!
module.exports = router;