const express = require("express");
const router = express.Router();

const courseControllers = require("../controllers/course.controllers");
const userControllers = require("../controllers/auth.controllers");
const upload = require("../middleware/upload");

// --- GET Routes ---
router.get("/my-courses", userControllers.protectRoutes, courseControllers.getMyCourses);
router.get("/my-assignments", userControllers.protectRoutes, courseControllers.getStudentAssignments);
router.get("/:id", userControllers.protectRoutes, courseControllers.getCourseDetails);
router.get("/", userControllers.protectRoutes, courseControllers.getAllCourses);

// Updated inline route to use People instead of Users
router.get("/student/:id", userControllers.protectRoutes, async (req, res) => {
  try {
    const { sql } = require("../config/db");
    const studentId = req.params.id;

    // Check parent access
    if (req.user.role === 'parent') {
      const accessCheck = await sql.query`
        SELECT * FROM parent_student 
        WHERE parent_id = ${req.user.id} AND student_id = ${studentId}`;
      if (accessCheck.recordset.length === 0) {
        return res.status(403).json({ status: "fail", message: "Access Denied" });
      }
    }

    // UPDATED QUERY: JOIN People instead of Users
    const result = await sql.query`
      SELECT 
        C.id, C.name, C.code, C.creditHours, 
        P.fullName as instructorName, P.email as instructorEmail
      FROM Courses C
      JOIN Enrollments E ON C.id = E.courseId
      LEFT JOIN People P ON C.instructorId = P.id
      WHERE E.studentId = ${studentId} AND E.status = 'enrolled'
      ORDER BY C.code
    `;
    res.json({ status: 'success', data: { courses: result.recordset } });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
});

// --- POST Routes ---
router.post("/", userControllers.protectRoutes, courseControllers.createCourse);
router.post("/:id/announcement", userControllers.protectRoutes, courseControllers.addAnnouncement);
router.post("/:id/lecture", userControllers.protectRoutes, upload.single("file"), courseControllers.addLecture);
router.post("/:id/assignment", userControllers.protectRoutes, upload.single("file"), courseControllers.addAssignment);

router.post("/:id/assignments/:assId/submit", 
    userControllers.protectRoutes, 
    upload.single("file"), 
    courseControllers.submitAssignment
);

// Teacher: Get Submissions for specific assignment
router.get("/:id/assignments/:assId/submissions", 
    userControllers.protectRoutes, 
    courseControllers.getSubmissionsForAssignment
);

router.get("/:id/my-submissions", userControllers.protectRoutes, courseControllers.getMyCourseSubmissions);

// Teacher: Grade a specific submission
router.post("/submissions/:subId/grade", 
    userControllers.protectRoutes, 
    courseControllers.gradeSubmission
);

router.post("/:id/request", userControllers.protectRoutes, courseControllers.requestEnrollment);
router.post("/manage-request", userControllers.protectRoutes, courseControllers.manageEnrollment);

module.exports = router;