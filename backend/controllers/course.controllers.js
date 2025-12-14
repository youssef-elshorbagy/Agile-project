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
                SELECT U.id, U.fullName, U.email FROM Enrollments E
                JOIN Users U ON E.studentId = U.id
                JOIN StudentAdvisors SA ON SA.studentId = U.id
                WHERE E.courseId = ${course.id} AND E.status = 'pending' AND SA.advisorId = ${req.user.id}
            `;
        } else {
            pendingRes = await sql.query`
                SELECT U.id, U.fullName, U.email FROM Enrollments E
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
        const { courseId, studentId, action } = req.body; 

        // 🔒 SECURITY: Only Advisors (flagged) can accept/reject
        if (!req.user || !req.user.isAdvisor) {
            return res.status(403).json({ status: "fail", message: "Access Denied: Only Advisors can manage requests." });
        }
        
        if (action === 'approve') {
            await sql.query`UPDATE Enrollments SET status = 'enrolled' WHERE studentId = ${studentId} AND courseId = ${courseId}`;
        } else {
            await sql.query`DELETE FROM Enrollments WHERE studentId = ${studentId} AND courseId = ${courseId}`;
        }
        res.status(200).json({ status: "success", message: `Request ${action}d` });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const getMyCourses = async (req, res) => {
    try {
        const userId = req.user.id;
        let result;

        if (req.user.role === 'teacher') {
            result = await sql.query`
                SELECT C.*, U.fullName as instructorName FROM Courses C
                JOIN Users U ON C.instructorId = U.id
                WHERE C.instructorId = ${userId}
            `;
        } else {
            result = await sql.query`
                SELECT C.*, U.fullName as instructorName FROM Courses C
                JOIN Enrollments E ON C.id = E.courseId
                JOIN Users U ON C.instructorId = U.id
                WHERE E.studentId = ${userId} AND E.status = 'enrolled'
            `;
        }
        res.status(200).json({ status: "success", data: { courses: result.recordset } });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const getCourseDetails = async (req, res) => {
    try {
        const courseId = req.params.id;
        const courseRes = await sql.query`
            SELECT C.*, U.fullName as instructorName FROM Courses C
            JOIN Users U ON C.instructorId = U.id WHERE C.id = ${courseId}
        `;

        if(courseRes.recordset.length === 0) return res.status(404).json({ status: "fail", message: "Course not found" });

        const course = courseRes.recordset[0];
        
        const annRes = await sql.query`SELECT * FROM Announcements WHERE courseId = ${courseId} ORDER BY createdAt DESC`;
        course.announcements = annRes.recordset;

        const lecRes = await sql.query`SELECT * FROM Lectures WHERE courseId = ${courseId} ORDER BY createdAt DESC`;
        course.lectures = lecRes.recordset.map(l => {
            const fileName = l.fileName || (l.filePath ? pathLib.basename(l.filePath) : null);
            return {
                id: l.id,
                title: l.title,
                link: fileName ? `${req.protocol}://${req.get('host')}/uploads/${fileName}` : null,
                fileName: fileName,
                filePath: l.filePath,
                createdAt: l.createdAt
            };
        });


        const assignRes = await sql.query` SELECT * FROM Assignments WHERE courseId = ${courseId} ORDER BY deadline ASC`;
        course.assignments = assignRes.recordset.map(a => {
            const fileName = a.fileName || (a.filePath ? pathLib.basename(a.filePath) : null);
            return {
                id: a.id,
                courseId: a.courseId,
                title: a.title,
                description: a.description,
                deadline: a.deadline,
                fileName: fileName,
                filePath: a.filePath,
                link: fileName ? `${req.protocol}://${req.get('host')}/uploads/${fileName}` : null,
                createdAt: a.createdAt
            };
        });


        res.status(200).json({ status: "success", data: { course } });
    } catch (error) {
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

        await sql.query`
            INSERT INTO Assignments (courseId, title, description, deadline, fileName, filePath)
            VALUES (${req.params.id}, ${title}, ${cleanDescription}, ${sqlDeadline}, ${req.file.filename}, ${req.file.path})
        `;

        res.status(201).json({ status: "success", message: "Assignment uploaded" });

    } catch (error) {
        console.error(error);
        res.status(400).json({ status: "fail", message: error.message });
    }
};


module.exports = { 
    createCourse, getAllCourses, requestEnrollment, manageEnrollment, getMyCourses,
    getCourseDetails, addAnnouncement, addLecture, addAssignment
};

// Note: deleteAssignment removed to disable assignment deletion via API