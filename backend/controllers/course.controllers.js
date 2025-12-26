const { sql } = require("../config/db");
const pathLib = require('path');

const createCourse = async (req, res) => {
  try {
    // Now accepting level and prerequisite
    const { name, code, creditHours, level, prerequisite, instructor } = req.body;

    const check = await sql.query`SELECT * FROM Courses WHERE code = ${code}`;
    if (check.recordset.length > 0) return res.status(400).json({ status: "fail", message: "Course Code already exists" });

    // 1. Insert Core Course Data
    const result = await sql.query`
        INSERT INTO Courses (name, code, instructorId)
        OUTPUT INSERTED.id
        VALUES (${name}, ${code}, ${instructor})
    `;
    const courseId = result.recordset[0].id;

    // 2. Helper to insert EAV values
    const insertAttr = async (attrName, value) => {
        if (value) {
            await sql.query`
                INSERT INTO CourseAttributeValues (course_id, attr_id, attr_value)
                SELECT ${courseId}, attr_id, ${value} 
                FROM CourseAttributes WHERE attributeName = ${attrName}
            `;
        }
    };

    // 3. Insert Attributes
    await insertAttr('CreditHours', creditHours);
    await insertAttr('Level', level);
    await insertAttr('Prerequisite', prerequisite);

    res.status(201).json({ status: "success", message: "Course created successfully", data: { course: result.recordset[0] } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const getAllCourses = async (req, res) => {
  try {
    // EAV Pivot to get CreditHours, Level, Prereq back as columns
    const result = await sql.query`
        SELECT 
            C.id, C.name, C.code, 
            P.fullName as instructorName, P.id as instructorId,
            MAX(CASE WHEN CA.attributeName = 'CreditHours' THEN CAV.attr_value END) as creditHours,
            MAX(CASE WHEN CA.attributeName = 'Level' THEN CAV.attr_value END) as level,
            MAX(CASE WHEN CA.attributeName = 'Prerequisite' THEN CAV.attr_value END) as prerequisite
        FROM Courses C 
        LEFT JOIN People P ON C.instructorId = P.id
        LEFT JOIN CourseAttributeValues CAV ON C.id = CAV.course_id
        LEFT JOIN CourseAttributes CA ON CAV.attr_id = CA.attr_id
        GROUP BY C.id, C.name, C.code, P.fullName, P.id
    `;
    let courses = result.recordset;

    // Attach Enrollment Counts
    for (let course of courses) {
        const pendingRes = await sql.query`
            SELECT P.id, P.fullName, P.email, E.EnrollmentID FROM Enrollments E
            JOIN People P ON E.studentId = P.id WHERE E.courseId = ${course.id} AND E.status = 'pending'
        `;
        course.studentsPending = pendingRes.recordset;
        
        const enrolledRes = await sql.query`
            SELECT P.id, P.fullName, P.email FROM Enrollments E
            JOIN People P ON E.studentId = P.id WHERE E.courseId = ${course.id} AND E.status = 'enrolled'
        `;
        course.studentsEnrolled = enrolledRes.recordset;
        
        course.instructor = { fullName: course.instructorName, id: course.instructorId };
    }
    res.status(200).json({ status: "success", results: courses.length, data: { courses } });
  } catch (error) { res.status(400).json({ status: "fail", message: error.message }); }
};

const getMyCourses = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = (req.user.role || '').toLowerCase();
        let result;

        // Base Query with EAV Pivot
        const baseSelect = `
            SELECT 
                C.id, C.name, C.code, 
                MAX(CASE WHEN CA.attributeName = 'CreditHours' THEN CAV.attr_value END) as creditHours,
                MAX(CASE WHEN CA.attributeName = 'Level' THEN CAV.attr_value END) as level,
                P.fullName as instructorName
            FROM Courses C
            LEFT JOIN People P ON C.instructorId = P.id
            LEFT JOIN CourseAttributeValues CAV ON C.id = CAV.course_id
            LEFT JOIN CourseAttributes CA ON CAV.attr_id = CA.attr_id
        `;

        if (userRole === 'teacher' || userRole === 'admin') {
            result = await sql.query(baseSelect + ` WHERE C.instructorId = ${userId} GROUP BY C.id, C.name, C.code, P.fullName`);
        } else {
            result = await sql.query(baseSelect + ` 
                JOIN Enrollments E ON C.id = E.courseId 
                WHERE E.studentId = ${userId} AND E.status = 'enrolled'
                GROUP BY C.id, C.name, C.code, P.fullName
            `);
        }

        const courses = result.recordset;
        // Attach student counts
        for (let course of courses) {
            const pending = await sql.query`SELECT studentId FROM Enrollments WHERE courseId = ${course.id} AND status = 'pending'`;
            const enrolled = await sql.query`SELECT studentId FROM Enrollments WHERE courseId = ${course.id} AND status = 'enrolled'`;
            course.studentsPending = pending.recordset;
            course.studentsEnrolled = enrolled.recordset;
        }
        res.status(200).json({ status: "success", data: { courses } });
    } catch (error) { res.status(400).json({ status: "fail", message: error.message }); }
};

const getCourseDetails = async (req, res) => {
    try {
        const courseId = req.params.id;
        
        // EAV Pivot for Single Course
        const result = await sql.query`
            SELECT 
                C.id, C.name, C.code, P.fullName as instructorName, P.id as instructorId,
                MAX(CASE WHEN CA.attributeName = 'CreditHours' THEN CAV.attr_value END) as creditHours,
                MAX(CASE WHEN CA.attributeName = 'Level' THEN CAV.attr_value END) as level,
                MAX(CASE WHEN CA.attributeName = 'Prerequisite' THEN CAV.attr_value END) as prerequisite
            FROM Courses C
            LEFT JOIN People P ON C.instructorId = P.id
            LEFT JOIN CourseAttributeValues CAV ON C.id = CAV.course_id
            LEFT JOIN CourseAttributes CA ON CAV.attr_id = CA.attr_id
            WHERE C.id = ${courseId}
            GROUP BY C.id, C.name, C.code, P.fullName, P.id
        `;
        
        const course = result.recordset[0];
        if (!course) return res.status(404).json({ status: "fail", message: "Course not found" });

        course.instructor = { fullName: course.instructorName, id: course.instructorId };
        const annRes = await sql.query`SELECT * FROM Announcements WHERE courseId = ${courseId} ORDER BY createdAt DESC`;
        course.announcements = annRes.recordset;

        const assignRes = await sql.query`
            SELECT U.id, U.title, U.fileName, U.filePath, U.createdAt,
            MAX(CASE WHEN UA.attributeName = 'Deadline' THEN UAV.attr_value END) as deadline,
            MAX(CASE WHEN UA.attributeName = 'MaxScore' THEN UAV.attr_value END) as maxScore
            FROM Uploads U
            LEFT JOIN UploadAttributeValues UAV ON U.id = UAV.upload_id
            LEFT JOIN UploadAttributes UA ON UAV.attr_id = UA.attr_id
            WHERE U.courseId = ${courseId} AND U.uploadType = 'assignment_item'
            GROUP BY U.id, U.title, U.fileName, U.filePath, U.createdAt
        `;
        course.assignments = assignRes.recordset.map(a => ({
            ...a, link: a.fileName ? `${req.protocol}://${req.get('host')}/uploads/${a.fileName}` : null
        }));

        const lecRes = await sql.query`SELECT * FROM Uploads WHERE courseId = ${courseId} AND uploadType = 'lecture_pdf'`;
        course.lectures = lecRes.recordset;

        res.status(200).json({ status: "success", data: { course } });
    } catch (error) { res.status(400).json({ status: "fail", message: error.message }); }
};

// ... Helper functions
const requestEnrollment = async (req, res) => {
    try {
        const courseId = req.params.id;
        const studentId = req.user.id; 
        const enrollCheck = await sql.query`SELECT * FROM Enrollments WHERE studentId = ${studentId} AND courseId = ${courseId}`;
        if (enrollCheck.recordset.length > 0) return res.status(400).json({ status: "fail", message: "Already enrolled or pending" });
        await sql.query`INSERT INTO Enrollments (studentId, courseId, status) VALUES (${studentId}, ${courseId}, 'pending')`;
        res.status(200).json({ status: "success", message: "Request sent successfully" });
    } catch (error) { res.status(400).json({ status: "fail", message: error.message }); }
};

const manageEnrollment = async (req, res) => {
    try {
        const { enrollmentId, status } = req.body; 
        if (!enrollmentId) return res.status(400).json({ status: "fail", message: "Missing Enrollment ID" });
        if (status === 'enrolled') await sql.query`UPDATE Enrollments SET status = 'enrolled' WHERE EnrollmentID = ${enrollmentId}`;
        else if (status === 'rejected') await sql.query`DELETE FROM Enrollments WHERE EnrollmentID = ${enrollmentId}`;
        res.status(200).json({ status: "success", message: `Request ${status}` });
    } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

const addAnnouncement = async (req, res) => {
    try {
        const { text } = req.body; 
        await sql.query`INSERT INTO Announcements (courseId, teacherName, content) VALUES (${req.params.id}, ${req.user.fullName}, ${text})`;
        res.status(200).json({ status: "success", message: "Announcement added" });
    } catch (error) { res.status(400).json({ status: "fail", message: error.message }); }
};

const addLecture = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: "fail", message: "No PDF file uploaded" });
        await sql.query`INSERT INTO Uploads (courseId, uploaderId, uploadType, title, fileName, filePath) VALUES (${req.params.id}, ${req.user.id}, 'lecture_pdf', ${req.body.title}, ${req.file.filename}, ${req.file.path})`;
        res.status(200).json({ status: "success", message: "Lecture uploaded" });
    } catch (error) { res.status(400).json({ status: "fail", message: error.message }); }
};

const addAssignment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: "fail", message: "No PDF file uploaded" });
        const { title, deadline, maxScore } = req.body;
        const uploadRes = await sql.query`INSERT INTO Uploads (courseId, uploaderId, uploadType, title, fileName, filePath) OUTPUT INSERTED.id VALUES (${req.params.id}, ${req.user.id}, 'assignment_item', ${title}, ${req.file.filename}, ${req.file.path})`;
        const uploadId = uploadRes.recordset[0].id;
        await sql.query`INSERT INTO UploadAttributeValues (upload_id, attr_id, attr_value) SELECT ${uploadId}, attr_id, ${deadline} FROM UploadAttributes WHERE attributeName = 'Deadline'`;
        await sql.query`INSERT INTO UploadAttributeValues (upload_id, attr_id, attr_value) SELECT ${uploadId}, attr_id, ${maxScore || '100'} FROM UploadAttributes WHERE attributeName = 'MaxScore'`;
        res.status(201).json({ status: "success", message: "Assignment uploaded" });
    } catch (error) { res.status(400).json({ status: "fail", message: error.message }); }
};

const submitAssignment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ status: "fail", message: "No PDF uploaded." });
        const uploadRes = await sql.query`INSERT INTO Uploads (courseId, uploaderId, uploadType, fileName, filePath) OUTPUT INSERTED.id VALUES (NULL, ${req.user.id}, 'student_submission', ${req.file.filename}, ${req.file.path})`;
        const submissionId = uploadRes.recordset[0].id;
        await sql.query`INSERT INTO UploadAttributeValues (upload_id, attr_id, attr_value) SELECT ${submissionId}, attr_id, ${req.params.assId} FROM UploadAttributes WHERE attributeName = 'ReferenceId'`;
        res.status(200).json({ status: "success", message: "Submitted successfully!" });
    } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

const getSubmissionsForAssignment = async (req, res) => {
    try {
        const assignmentId = req.params.assId;
        const result = await sql.query`
            SELECT U.id as SubmissionID, U.fileName, U.filePath, U.createdAt as SubmittedAt, P.fullName, P.universityId,
            MAX(CASE WHEN UA.attributeName = 'Grade' THEN UAV.attr_value END) as Grade,
            MAX(CASE WHEN UA.attributeName = 'Feedback' THEN UAV.attr_value END) as Feedback
            FROM Uploads U
            JOIN People P ON U.uploaderId = P.id
            JOIN UploadAttributeValues Ref ON U.id = Ref.upload_id
            JOIN UploadAttributes UA_Ref ON Ref.attr_id = UA_Ref.attr_id
            LEFT JOIN UploadAttributeValues UAV ON U.id = UAV.upload_id
            LEFT JOIN UploadAttributes UA ON UAV.attr_id = UA.attr_id
            WHERE UA_Ref.attributeName = 'ReferenceId' AND Ref.attr_value = CAST(${assignmentId} AS NVARCHAR)
            GROUP BY U.id, U.fileName, U.filePath, U.createdAt, P.fullName, P.universityId
            ORDER BY U.createdAt DESC
        `;
        res.status(200).json({ status: "success", data: result.recordset });
    } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

const gradeSubmission = async (req, res) => {
    try {
        const { grade, feedback } = req.body;
        await sql.query`
            MERGE INTO UploadAttributeValues AS target
            USING (SELECT attr_id FROM UploadAttributes WHERE attributeName = 'Grade') AS source
            ON (target.upload_id = ${req.params.subId} AND target.attr_id = source.attr_id)
            WHEN MATCHED THEN UPDATE SET attr_value = ${grade}
            WHEN NOT MATCHED THEN INSERT (upload_id, attr_id, attr_value) VALUES (${req.params.subId}, source.attr_id, ${grade});
        `;
        await sql.query`
            MERGE INTO UploadAttributeValues AS target
            USING (SELECT attr_id FROM UploadAttributes WHERE attributeName = 'Feedback') AS source
            ON (target.upload_id = ${req.params.subId} AND target.attr_id = source.attr_id)
            WHEN MATCHED THEN UPDATE SET attr_value = ${feedback}
            WHEN NOT MATCHED THEN INSERT (upload_id, attr_id, attr_value) VALUES (${req.params.subId}, source.attr_id, ${feedback});
        `;
        res.status(200).json({ status: "success", message: "Graded" });
    } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

const getStudentAssignments = async (req, res) => {
    try {
        const studentId = req.user.id;
        const result = await sql.query`
            SELECT 
                U.id, U.title as Title, C.name as CourseName, C.code as CourseCode,
                MAX(CASE WHEN UA.attributeName = 'Deadline' THEN UAV.attr_value END) as Deadline,
                MAX(Sub.Grade) as Grade, 
                MAX(Sub.SubmittedAt) as SubmittedAt
            FROM Uploads U
            JOIN Courses C ON U.courseId = C.id
            JOIN Enrollments E ON E.courseId = C.id
            LEFT JOIN UploadAttributes UA ON 1=1
            LEFT JOIN UploadAttributeValues UAV ON U.id = UAV.upload_id AND UA.attr_id = UAV.attr_id
            LEFT JOIN (
                SELECT Ref.attr_value as assId, U2.createdAt as SubmittedAt, G.attr_value as Grade
                FROM Uploads U2
                JOIN UploadAttributeValues Ref ON U2.id = Ref.upload_id
                JOIN UploadAttributes UA_Ref ON Ref.attr_id = UA_Ref.attr_id
                LEFT JOIN UploadAttributeValues G ON U2.id = G.upload_id
                LEFT JOIN UploadAttributes UA_G ON G.attr_id = UA_G.attr_id AND UA_G.attributeName = 'Grade'
                WHERE U2.uploadType = 'student_submission' AND U2.uploaderId = ${studentId} AND UA_Ref.attributeName = 'ReferenceId'
            ) Sub ON CAST(U.id AS NVARCHAR) = Sub.assId
            WHERE E.studentId = ${studentId} AND E.status = 'enrolled' AND U.uploadType = 'assignment_item' AND UA.attributeName = 'Deadline'
            GROUP BY U.id, U.title, C.name, C.code
            ORDER BY Deadline ASC
        `;
        res.status(200).json({ status: "success", data: result.recordset });
    } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

const getMyCourseSubmissions = async (req, res) => {
    try {
        const studentId = req.user.id;
        const courseId = req.params.id;
        const result = await sql.query`
            SELECT U.id as SubmissionID, Ref.attr_value as AssignmentID, U.createdAt as SubmittedAt, U.fileName,
            MAX(CASE WHEN UA.attributeName = 'Grade' THEN UAV.attr_value END) as Grade,
            MAX(CASE WHEN UA.attributeName = 'Feedback' THEN UAV.attr_value END) as Feedback
            FROM Uploads U
            JOIN UploadAttributeValues Ref ON U.id = Ref.upload_id
            JOIN UploadAttributes UA_Ref ON Ref.attr_id = UA_Ref.attr_id
            LEFT JOIN UploadAttributeValues UAV ON U.id = UAV.upload_id
            LEFT JOIN UploadAttributes UA ON UAV.attr_id = UA.attr_id
            WHERE U.uploaderId = ${studentId} AND U.uploadType = 'student_submission' AND UA_Ref.attributeName = 'ReferenceId'
            AND Ref.attr_value IN (SELECT CAST(id AS NVARCHAR) FROM Uploads WHERE courseId = ${courseId})
            GROUP BY U.id, Ref.attr_value, U.createdAt, U.fileName
        `;
        res.status(200).json({ status: "success", data: result.recordset });
    } catch (error) { res.status(500).json({ status: "fail", message: error.message }); }
};

module.exports = { 
    createCourse, getAllCourses, requestEnrollment, manageEnrollment, getMyCourses,
    getCourseDetails, addAnnouncement, addLecture, addAssignment, submitAssignment, 
    getSubmissionsForAssignment, gradeSubmission, getStudentAssignments, getMyCourseSubmissions
};