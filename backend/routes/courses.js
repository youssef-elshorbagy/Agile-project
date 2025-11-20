const express = require("express");
const router = express.Router();
const courseControllers = require("../controllers/course.controllers");
const userControllers = require("../controllers/auth.controllers");
const upload = require("../middleware/upload");

router.get("/my-courses", userControllers.protectRoutes, courseControllers.getMyCourses);
router.get("/:id", userControllers.protectRoutes, courseControllers.getCourseDetails);
router.get("/", userControllers.protectRoutes, courseControllers.getAllCourses);
router.post("/", userControllers.protectRoutes, courseControllers.createCourse);


router.post("/:id/announcement", userControllers.protectRoutes, courseControllers.addAnnouncement);
router.post("/:id/lecture", 
    userControllers.protectRoutes, 
    upload.single("file"), // 'file' is the name we will use in frontend
    courseControllers.addLecture
);
router.post("/:id/request", userControllers.protectRoutes, courseControllers.requestEnrollment);

// Admin approves/declines
router.post("/manage-request", userControllers.protectRoutes, courseControllers.manageEnrollment);

module.exports = router;