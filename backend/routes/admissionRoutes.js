const express = require('express');
const router = express.Router();
const admissionController = require('../controllers/admissionController');

const upload = require('../middleware/upload'); 

// Configure the two specific files we expect
const admissionUploads = upload.fields([
    { name: 'birthCertificate', maxCount: 1 },
    { name: 'highSchoolCertificate', maxCount: 1 }
]);
router.get('/', admissionController.getPendingAdmissions);
router.post('/decide', admissionController.decideAdmission);
// POST http://localhost:3000/api/admissions/apply
router.post('/apply', admissionUploads, admissionController.submitAdmission);

module.exports = router;