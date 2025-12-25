const { sql } = require("../config/db");
const pathLib = require('path');

const createCourse = async (req, res) => {
  try {
    const { name, code, creditHours, instructor } = req.body;

    // 1. Check if course code exists
    const check = await sql.query`SELECT * FROM Courses WHERE code = ${code}`;
    if (check.recordset.length > 0) return res.status(400).json({ status: "fail", message: "Course Code already exists" });

    // 2. Insert Course (Using 'instructorId' which links to Users table)
    const result = await sql.query`
        INSERT INTO Courses (name, code, creditHours, instructorId)
        OUTPUT INSERTED.*
        VALUES (${name}, ${code}, ${creditHours}, ${instructor})
    `;

    res.status(201).json({ status: "success", data: { course: result.recordset[0] } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const getAllCourses = async (req, res) => {
  try {
    // 1. Get all courses with Instructor Name
    const result = await sql.query`
        SELECT C.*, U.fullName as instructorName, U.id as instructorId 
        FROM Courses C 
        LEFT JOIN Users U ON C.instructorId = U.id
    `;
    let courses = result.recordset;

    // 2. Loop to get students (Enrollments)
    for (let course of courses) {
        // If requester is an advisor, only return pending students assigned to that advisor
        let pendingRes;
        if (req.user && req.user.isAdvisor) {
            pendingRes = await sql.query`
                SELECT U.id, U.fullName, U.email, E.EnrollmentID 
                FROM Enrollments E
                JOIN Users U ON E.studentId = U.id
                JOIN StudentAdvisors SA ON SA.studentId = U.id
                WHERE E.courseId = ${course.id} AND E.status = 'pending' AND SA.advisorId = ${req.user.id}
            `;
        } else {
            pendingRes = await sql.query`
                SELECT U.id, U.fullName, U.email, E.EnrollmentID 
                FROM Enrollments E
                JOIN Users U ON E.studentId = U.id
                WHERE E.courseId = ${course.id} AND E.status = 'pending'
            `;
        }
        course.studentsPending = pendingRes.recordset;

        const enrolledRes = await sql.query`
            SELECT U.id, U.fullName, U.email FROM Enrollments E
            JOIN Users U ON E.studentId = U.id
            WHERE E.courseId = ${course.id} AND E.status = 'enrolled'
        `;
        course.studentsEnrolled = enrolledRes.recordset;
        
        // Format instructor object for frontend
        course.instructor = { fullName: course.instructorName, id: course.instructorId };
    }
    
    res.status(200).json({ status: "success", results: courses.length, data: { courses } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const requestEnrollment = async (req, res) => {
    try {
        const courseId = req.params.id;
        const studentId = req.user.id; 

        // Check if already enrolled/pending
        const enrollCheck = await sql.query`SELECT * FROM Enrollments WHERE studentId = ${studentId} AND courseId = ${courseId}`;
        
        if (enrollCheck.recordset.length > 0) {
            const status = enrollCheck.recordset[0].status;
            if (status === 'enrolled') return res.status(400).json({ status: "fail", message: "Already enrolled" });
            if (status === 'pending') return res.status(400).json({ status: "fail", message: "Already pending" });
        }

        await sql.query`INSERT INTO Enrollments (studentId, courseId, status) VALUES (${studentId}, ${courseId}, 'pending')`;
        res.status(200).json({ status: "success", message: "Request sent successfully" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const manageEnrollment = async (req, res) => {
    try {
        const { enrollmentId, status } = req.body; 

        // SECURITY: Only Advisors or Admins can accept/reject
        if (!req.user || (!req.user.isAdvisor && req.user.role !== 'admin')) {
            return res.status(403).json({ status: "fail", message: "Access Denied: Only Advisors can manage requests." });
        }

        if (!enrollmentId) {
            return res.status(400).json({ status: "fail", message: "Missing Enrollment ID" });
        }

        // Run the Update using the UNIQUE EnrollmentID
        if (status === 'enrolled') {
             await sql.query`
                UPDATE Enrollments 
                SET status = 'enrolled' 
                WHERE EnrollmentID = ${enrollmentId}
            `;
        } else if (status === 'rejected') {
            // Delete the request entirely
            await sql.query`
                DELETE FROM Enrollments 
                WHERE EnrollmentID = ${enrollmentId}
            `;
        }

        res.status(200).json({ status: "success", message: `Request ${status === 'enrolled' ? 'Approved' : 'Rejected'}` });

    } catch (error) {
        console.error("Manage Request Error:", error);
        res.status(500).json({ status: "fail", message: error.message });
    }
};

const getMyCourses = async (req, res) => {
    try {
        const userId = req.user.id;
        let result;

        // 1. Get the basic course list
        if (req.user.role === 'teacher') {
            result = await sql.query`
                SELECT C.*, U.fullName as instructorName, U.id as instructorId 
                FROM Courses C
                JOIN Users U ON C.instructorId = U.id
                WHERE C.instructorId = ${userId}
            `;
        } else {
            result = await sql.query`
                SELECT C.*, U.fullName as instructorName, U.id as instructorId 
                FROM Courses C
                JOIN Enrollments E ON C.id = E.courseId
                JOIN Users U ON C.instructorId = U.id
                WHERE E.studentId = ${userId} AND E.status = 'enrolled'
            `;
        }

        let courses = result.recordset;

        // Loop through courses to attach students/requests
        for (let course of courses) {
            // Get Pending Requests WITH EnrollmentID
            const pendingRes = await sql.query`
                SELECT U.id, U.fullName, U.email, E.EnrollmentID 
                FROM Enrollments E
                JOIN Users U ON E.studentId = U.id
                WHERE E.courseId = ${course.id} AND E.status = 'pending'
            `;
            course.studentsPending = pendingRes.recordset;

            // Get Enrolled Students
            const enrolledRes = await sql.query`
                SELECT U.id, U.fullName, U.email 
                FROM Enrollments E
                JOIN Users U ON E.studentId = U.id
                WHERE E.courseId = ${course.id} AND E.status = 'enrolled'
            `;
            course.studentsEnrolled = enrolledRes.recordset;
            
            // Format instructor object for frontend consistency
            course.instructor = { fullName: course.instructorName, id: course.instructorId };
        }

        res.status(200).json({ status: "success", data: { courses } });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const getCourseDetails = async (req, res) => {
    try {
        const courseId = req.params.id;
        
        // 1. Get Course Info
        const courseRes = await sql.query`
            SELECT C.*, U.fullName as instructorName FROM Courses C
            JOIN Users U ON C.instructorId = U.id WHERE C.id = ${courseId}
        `;

        if(courseRes.recordset.length === 0) return res.status(404).json({ status: "fail", message: "Course not found" });

        const course = courseRes.recordset[0];
        
        // 2. Get Announcements
        const annRes = await sql.query`SELECT * FROM Announcements WHERE courseId = ${courseId} ORDER BY createdAt DESC`;
        course.announcements = annRes.recordset;

        // 3. Get Lectures
        const lecRes = await sql.query`SELECT * FROM Lectures WHERE courseId = ${courseId} ORDER BY createdAt DESC`;
        course.lectures = lecRes.recordset;

        // 4. Get Assignments
        const assignRes = await sql.query`SELECT * FROM Assignments WHERE courseId = ${courseId} ORDER BY deadline ASC`;
        
        // Helper function to find a column even if Capitalization is wrong
        const getVal = (row, key) => {
            const foundKey = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
            return foundKey ? row[foundKey] : null;
        };

        course.assignments = assignRes.recordset.map(a => {
            const realTitle = getVal(a, 'title') || getVal(a, 'assignmenttitle') || "Untitled Assignment";
            const realDesc = getVal(a, 'description');
            const realId = getVal(a, 'assignmentid') || getVal(a, 'id');
            const realFilePath = getVal(a, 'filepath');
            const realFileName = getVal(a, 'filename');

            const fileName = realFileName || (realFilePath ? realFilePath.split('\\').pop().split('/').pop() : null);
            
            return {
                id: realId, 
                courseId: courseId,
                title: realTitle,
                description: realDesc,
                deadline: getVal(a, 'deadline'),
                fileName: fileName,
                filePath: realFilePath,
                link: fileName ? `${req.protocol}://${req.get('host')}/uploads/${fileName}` : null,
                createdAt: getVal(a, 'createdat')
            };
        });

        res.status(200).json({ status: "success", data: { course } });

    } catch (error) {
        console.error("Backend Error:", error);
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const addAnnouncement = async (req, res) => {
    try {
        const { text } = req.body; 
        await sql.query`
            INSERT INTO Announcements (courseId, teacherName, content)
            VALUES (${req.params.id}, ${req.user.fullName}, ${text})
        `;
        res.status(200).json({ status: "success", message: "Announcement added" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const addLecture = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: "fail", message: "No PDF file uploaded" });

        await sql.query`
            INSERT INTO Lectures (courseId, title, fileName, filePath)
            VALUES (${req.params.id}, ${req.body.title}, ${req.file.filename}, ${req.file.path})
        `;
        res.status(200).json({ status: "success", message: "Lecture uploaded" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const addAssignment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: "fail", message: "No PDF file uploaded" });

        const { title, description, deadline } = req.body;

        if (!title || !deadline) {
            return res.status(400).json({ status: "fail", message: "Title and deadline are required" });
        }

        const parsedDeadline = new Date(deadline);
        if (isNaN(parsedDeadline)) {
            return res.status(400).json({ status: "fail", message: "Invalid deadline format" });
        }

        const sqlDeadline = parsedDeadline.toISOString().slice(0, 19).replace('T', ' ');
        const cleanDescription = description === '' || description === 'null' ? null : description;

        const result = await sql.query`
            INSERT INTO Assignments (courseId, title, description, deadline, fileName, filePath)
            OUTPUT INSERTED.*
            VALUES (${req.params.id}, ${title}, ${cleanDescription}, ${sqlDeadline}, ${req.file.filename}, ${req.file.path})
        `;

        res.status(201).json({ status: "success", message: "Assignment uploaded", data: { assignment: result.recordset[0] } });

    } catch (error) {
        console.error(error);
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const submitAssignment = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ status: "fail", message: "No PDF uploaded." });
        }

        const assignmentId = req.params.id;
        const studentId = req.user.id;

        await sql.query`
            INSERT INTO Submissions (assignmentId, studentId, fileName, filePath)
            VALUES (${assignmentId}, ${studentId}, ${req.file.filename}, ${req.file.path})
        `;

        res.status(200).json({ status: "success", message: "Assignment submitted successfully!" });

    } catch (error) {
        console.error("Submission Error:", error);
        res.status(500).json({ status: "fail", message: error.message });
    }
};

const getSubmissionsForAssignment = async (req, res) => {
    try {
        const assignmentId = req.params.assId;

        const result = await sql.query(`
            SELECT 
                S.SubmissionID, 
                S.FilePath, 
                S.SubmittedAt, 
                S.Grade, 
                S.Feedback,
                U.ID as StudentID, 
                U.fullName AS StudentName, 
                U.universityId 
            FROM Submissions S
            JOIN Users U ON S.StudentID = U.ID
            WHERE S.AssignmentID = ${assignmentId}
            ORDER BY S.SubmittedAt DESC
        `);

        const submissions = result.recordset.map(s => ({
            ...s,
            downloadLink: s.FilePath ? `${req.protocol}://${req.get('host')}/uploads/${s.FilePath.split('\\').pop().split('/').pop()}` : null,
            id: s.SubmissionID
        }));

        res.status(200).json({ status: "success", data: submissions });

    } catch (error) {
        console.error("Error fetching submissions:", error);
        res.status(500).json({ status: "fail", message: error.message });
    }
};

const gradeSubmission = async (req, res) => {
    try {
        const submissionId = req.params.subId;
        const { grade, feedback } = req.body;

        if (grade === undefined || grade === null) {
            return res.status(400).json({ status: "fail", message: "Grade is required." });
        }

        await sql.query`
            UPDATE Submissions 
            SET Grade = ${grade}, Feedback = ${feedback || null} 
            WHERE SubmissionID = ${submissionId}
        `;

        res.status(200).json({ status: "success", message: "Grade saved successfully." });

    } catch (error) {
        console.error("Error grading submission:", error);
        res.status(500).json({ status: "fail", message: error.message });
    }
};

module.exports = { 
    createCourse, 
    getAllCourses, 
    requestEnrollment, 
    manageEnrollment, 
    getMyCourses,
    getCourseDetails, 
    addAnnouncement, 
    addLecture, 
    addAssignment, 
    submitAssignment, 
    getSubmissionsForAssignment,
    gradeSubmission
};