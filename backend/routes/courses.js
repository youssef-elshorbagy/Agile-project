const express = require("express");
const router = express.Router();
const { sql } = require("../config/db"); 

const courseControllers = require("../controllers/course.controllers");
const userControllers = require("../controllers/auth.controllers");
const upload = require("../middleware/upload");

// =========================================================================
// 1. SPECIFIC ROUTES (Must come BEFORE /:id)
// =========================================================================

// ADVISOR: Get all pending enrollments (THIS FIXES THE EMPTY TABLE)
router.get('/pending-enrollments', userControllers.protectRoutes, async (req, res) => {
    try {
        // Fetch all enrollments where status is 'pending'
        const result = await sql.query(`
            SELECT e.EnrollmentID, u.fullName AS StudentName, u.universityId, c.code, c.name AS CourseName
            FROM Enrollments e
            JOIN Users u ON e.studentId = u.ID
            JOIN Courses c ON e.courseId = c.id
            WHERE e.status = 'pending'
        `);

        res.json({ status: 'success', data: result.recordset });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ADVISOR: Approve or Reject a request
router.post('/manage-request', userControllers.protectRoutes, async (req, res) => {
    try {
        const { enrollmentId, status } = req.body; 
        
        await sql.query(`UPDATE Enrollments SET status = '${status}' WHERE EnrollmentID = ${enrollmentId}`);
        
        res.json({ status: 'success', message: `Request ${status}` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET ALL ASSIGNMENTS (DEBUG VERSION)
router.get('/my-assignments', userControllers.protectRoutes, async (req, res) => {
    try {
        const studentId = req.user.id; 
        
        const query = `
            SELECT 
                a.AssignmentID, a.Title, a.Deadline, 
                c.name AS CourseName, c.code AS CourseCode,
                s.SubmissionID, s.Grade, s.SubmittedAt
            FROM Assignments a
            JOIN Courses c ON a.CourseID = c.id
            JOIN Enrollments e ON c.id = e.courseId
            LEFT JOIN Submissions s ON a.AssignmentID = s.AssignmentID AND s.StudentID = ${studentId}
            WHERE e.studentId = ${studentId}
            ORDER BY a.Deadline ASC
        `;

        const result = await sql.query(query);
        res.json({ status: 'success', data: result.recordset });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get("/my-courses", userControllers.protectRoutes, courseControllers.getMyCourses);

router.get("/my-submissions", userControllers.protectRoutes, async (req, res) => {
    res.json({ message: "Use course-specific submission route" });
});

router.get("/", userControllers.protectRoutes, courseControllers.getAllCourses);

router.post("/", userControllers.protectRoutes, courseControllers.createCourse);

// =========================================================================
// 2. DYNAMIC ID ROUTES (Must come AFTER specific routes)
// =========================================================================

router.get("/:id", userControllers.protectRoutes, courseControllers.getCourseDetails);

router.post("/:id/announcement", userControllers.protectRoutes, courseControllers.addAnnouncement);

router.post("/:id/request", userControllers.protectRoutes, courseControllers.requestEnrollment);

// File Upload Routes
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

// =========================================================================
// 3. SUBMISSION & GRADING ROUTES
// =========================================================================

// STUDENT: Submit Assignment
router.post('/:courseId/assignments/:assId/submit', userControllers.protectRoutes, upload.single('file'), async (req, res) => {
    try {
        const { assId } = req.params;
        const studentId = req.user.id; 
        const filePath = req.file ? req.file.filename : null;

        if (!filePath) return res.status(400).json({ message: "No file uploaded" });

        const check = await sql.query(`SELECT * FROM Submissions WHERE AssignmentID = ${assId} AND StudentID = ${studentId}`);
        
        if (check.recordset.length > 0) {
            await sql.query(`
                UPDATE Submissions 
                SET FilePath = '${filePath}', SubmittedAt = GETDATE()
                WHERE AssignmentID = ${assId} AND StudentID = ${studentId}
            `);
            return res.json({ status: 'success', message: 'Submission updated!' });
        }

        await sql.query(`
            INSERT INTO Submissions (AssignmentID, StudentID, FilePath)
            VALUES (${assId}, ${studentId}, '${filePath}')
        `);

        res.json({ status: 'success', message: 'Assignment submitted!' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// STUDENT: Get My Submissions for a Course
router.get('/:courseId/my-submissions', userControllers.protectRoutes, async (req, res) => {
    try {
        const { courseId } = req.params;
        const studentId = req.user.id;

        const result = await sql.query(`
            SELECT s.* FROM Submissions s
            JOIN Assignments a ON s.AssignmentID = a.AssignmentID
            WHERE a.CourseID = ${courseId} AND s.StudentID = ${studentId}
        `);

        res.json({ status: 'success', data: result.recordset });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});



// TEACHER: Get All Submissions for an Assignment
router.get('/:courseId/assignments/:assId/submissions', userControllers.protectRoutes, async (req, res) => {
    try {
        const { assId } = req.params;
        
        const result = await sql.query(`
            SELECT s.*, u.fullName, u.email, u.universityId
            FROM Submissions s
            JOIN Users u ON s.StudentID = u.ID
            WHERE s.AssignmentID = ${assId}
        `);

        res.json({ status: 'success', data: result.recordset });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// TEACHER: Grade a Submission
router.post('/submissions/:subId/grade', userControllers.protectRoutes, async (req, res) => {
    try {
        const { subId } = req.params;
        const { grade, feedback } = req.body;

        await sql.query(`
            UPDATE Submissions 
            SET Grade = ${grade}, Feedback = '${feedback || ''}'
            WHERE SubmissionID = ${subId}
        `);

        res.json({ status: 'success', message: 'Grade saved.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;