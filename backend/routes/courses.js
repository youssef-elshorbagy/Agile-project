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
// In courseController.js or routes/courses.js
router.get("/student/:id", userControllers.protectRoutes, courseControllers.getStudentPerformance);

router.post("/:id/request", userControllers.protectRoutes, courseControllers.requestEnrollment);

router.post("/manage-request", userControllers.protectRoutes, courseControllers.manageEnrollment);
router.get("/student/:id", async (req, res) => {
  try {
    const { sql } = require("../config/db");
    const studentId = req.params.id;

    // Verify parent has access to this student
    if (req.user.role === 'parent') {
      const accessCheck = await sql.query`
        SELECT * FROM parent_student 
        WHERE parent_id = ${req.user.id} AND student_id = ${studentId}
      `;
      
      if (accessCheck.recordset.length === 0) {
        return res.status(403).json({ 
          status: "fail", 
          message: "You don't have access to this student's data" 
        });
      }
    }

    // Get enrolled courses with full details
    const result = await sql.query`
      SELECT 
        C.id, C.name, C.code, C.creditHours, 
        U.fullName as instructorName,
        U.email as instructorEmail
      FROM Courses C
      JOIN Enrollments E ON C.id = E.courseId
      LEFT JOIN Users U ON C.instructorId = U.id
      WHERE E.studentId = ${studentId} AND E.status = 'enrolled'
      ORDER BY C.code
    `;

    res.json({ 
      status: 'success', 
      data: { courses: result.recordset } 
    });

  } catch (error) {
    console.error('Error fetching student courses:', error);
    res.status(500).json({ status: 'fail', message: error.message });
  }
});

module.exports = router;