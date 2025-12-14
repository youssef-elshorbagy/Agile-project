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

// 'file' must match the name="file" in your HTML form
router.post("/:id/lecture", 
    userControllers.protectRoutes, 
    upload.single("file"), 
    courseControllers.addLecture
);
router.post("/:id/assignment", 
    userControllers.protectRoutes, 
    upload.single("file"),
    courseControllers.addAssignment   
);


router.post("/:id/request", userControllers.protectRoutes, courseControllers.requestEnrollment);

router.post("/manage-request", userControllers.protectRoutes, courseControllers.manageEnrollment);

module.exports = router;