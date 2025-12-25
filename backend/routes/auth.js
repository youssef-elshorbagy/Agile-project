const express = require("express");
const userControllers = require("../controllers/auth.controllers");
const router = express.Router();

router.post("/signup", userControllers.signup); 
router.post("/login", userControllers.login);

// Protected Routes
router.get("/", userControllers.protectRoutes, userControllers.getAllUsers);
router.get("/profile", userControllers.protectRoutes, userControllers.getProfile);
router.patch("/profile", userControllers.protectRoutes, userControllers.updateProfile);
router.get("/student-performance", userControllers.protectRoutes, userControllers.getStudentPerformance);
router.get("/student/:id/courses", userControllers.protectRoutes, userControllers.getStudentCourses);
router.get("/student/:studentId/course/:courseId/grades", userControllers.protectRoutes, userControllers.getStudentGrades);
module.exports = router;