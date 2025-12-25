// routes/parent.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const parentController = require('../controllers/parentController');

router.get('/children', auth('parent'), parentController.getChildren);
router.get('/children/:studentId/courses', auth('parent'), parentController.getChildCourses);
router.get('/children/:studentId/progress', auth('parent'), parentController.getChildProgress);
module.exports = router;
