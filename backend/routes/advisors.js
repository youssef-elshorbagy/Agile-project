const express = require('express');
const router = express.Router();
const advisorControllers = require('../controllers/advisor.controllers');
const userControllers = require('../controllers/auth.controllers');

router.get('/', userControllers.protectRoutes, advisorControllers.listAdvisors);

// Assign student to advisor (admin only)
router.post('/:advisorId/assign', userControllers.protectRoutes, async (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ status: 'fail', message: 'Only admin can assign advisors' });
    next();
}, advisorControllers.assignAdvisorToStudent);

router.delete('/student/:studentId/unassign', userControllers.protectRoutes, async (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ status: 'fail', message: 'Only admin can unassign advisors' });
    next();
}, advisorControllers.unassignAdvisorFromStudent);

module.exports = router;
