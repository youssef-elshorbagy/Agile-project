const { sql } = require("../config/db");

const createCourse = async (req, res) => {
  try {
    const { name, code, creditHours, instructor } = req.body;

    const check = await sql.query(`SELECT * FROM Courses WHERE code = '${code}'`);
    if (check.recordset.length > 0) {
        return res.status(400).json({ status: "fail", message: "Course Code already exists" });
    }

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
        const request = new sql.Request(transaction);

        const courseRes = await request.query(`
            INSERT INTO Courses (name, code, creditHours)
            OUTPUT INSERTED.*
            VALUES ('${name}', '${code}', ${creditHours})
        `);
        const newCourse = courseRes.recordset[0];

        await request.query(`
            INSERT INTO CourseInstructors (courseId, personId, instructorType)
            VALUES (${newCourse.id}, ${instructor}, 'Main')
        `);

        await transaction.commit();
        res.status(201).json({ status: "success", data: { course: newCourse } });

    } catch (err) {
        await transaction.rollback();
        throw err;
    }

  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const getAllCourses = async (req, res) => {
  try {
    const result = await sql.query(`
        SELECT C.*, P.fullName as instructorName, P.person_id as instructorId 
        FROM Courses C 
        LEFT JOIN CourseInstructors CI ON C.id = CI.courseId AND CI.instructorType = 'Main'
        LEFT JOIN People P ON CI.personId = P.person_id
    `);
    
    let courses = result.recordset;

    for (let course of courses) {
        const pendingRes = await sql.query(`
            SELECT P.person_id as id, P.fullName, P.email 
            FROM Enrollments E
            JOIN People P ON E.studentId = P.person_id
            WHERE E.courseId = ${course.id} AND E.status = 'pending'
        `);
        course.studentsPending = pendingRes.recordset;

        const enrolledRes = await sql.query(`
            SELECT P.person_id as id, P.fullName, P.email 
            FROM Enrollments E
            JOIN People P ON E.studentId = P.person_id
            WHERE E.courseId = ${course.id} AND E.status = 'enrolled'
        `);
        course.studentsEnrolled = enrolledRes.recordset;

        course.instructor = { fullName: course.instructorName || 'TBD', id: course.instructorId };
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

        const courseCheck = await sql.query(`SELECT * FROM Courses WHERE id = ${courseId}`);
        if(courseCheck.recordset.length === 0) return res.status(404).json({ status: "fail", message: "Course not found" });

        const enrollCheck = await sql.query(`SELECT * FROM Enrollments WHERE studentId = ${studentId} AND courseId = ${courseId}`);
        
        if (enrollCheck.recordset.length > 0) {
            const status = enrollCheck.recordset[0].status;
            if (status === 'enrolled') return res.status(400).json({ status: "fail", message: "You are already enrolled" });
            if (status === 'pending') return res.status(400).json({ status: "fail", message: "Request already pending" });
        }

        await sql.query(`
            INSERT INTO Enrollments (studentId, courseId, status)
            VALUES (${studentId}, ${courseId}, 'pending')
        `);

        res.status(200).json({ status: "success", message: "Request sent successfully" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const manageEnrollment = async (req, res) => {
    try {
        const { courseId, studentId, action } = req.body; 
        
        if (action === 'approve') {
            await sql.query(`
                UPDATE Enrollments 
                SET status = 'enrolled' 
                WHERE studentId = ${studentId} AND courseId = ${courseId}
            `);
        } else {
            await sql.query(`
                DELETE FROM Enrollments 
                WHERE studentId = ${studentId} AND courseId = ${courseId}
            `);
        }

        res.status(200).json({ status: "success", message: `Request ${action}d successfully` });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const getMyCourses = async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role; 

        let query = "";

        if (userRole === 'teacher') {
            query = `
                SELECT C.*, P.fullName as instructorName 
                FROM Courses C
                JOIN CourseInstructors CI ON C.id = CI.courseId
                JOIN People P ON CI.personId = P.person_id
                WHERE CI.personId = ${userId}
            `;
        } else {
            query = `
                SELECT C.*, P.fullName as instructorName 
                FROM Courses C
                JOIN Enrollments E ON C.id = E.courseId
                LEFT JOIN CourseInstructors CI ON C.id = CI.courseId AND CI.instructorType = 'Main'
                LEFT JOIN People P ON CI.personId = P.person_id
                WHERE E.studentId = ${userId} AND E.status = 'enrolled'
            `;
        }

        const result = await sql.query(query);
        const courses = result.recordset.map(c => ({
            ...c,
            instructor: { fullName: c.instructorName || 'TBD' } 
        }));

        res.status(200).json({ 
            status: "success", 
            results: courses.length, 
            data: { courses } 
        });

    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const getCourseDetails = async (req, res) => {
    try {
        const courseId = req.params.id;

        const courseRes = await sql.query(`
            SELECT C.*, P.fullName as instructorName 
            FROM Courses C
            LEFT JOIN CourseInstructors CI ON C.id = CI.courseId AND CI.instructorType = 'Main'
            LEFT JOIN People P ON CI.personId = P.person_id
            WHERE C.id = ${courseId}
        `);

        if(courseRes.recordset.length === 0) return res.status(404).json({ status: "fail", message: "Course not found" });

        const course = courseRes.recordset[0];
        course.instructor = { fullName: course.instructorName || 'TBD' };

        // Updated to use fullName directly
        const annRes = await sql.query(`
            SELECT A.id, A.content, A.createdAt, A.attachmentsJson,
                   P.fullName as teacherName 
            FROM Announcements A
            JOIN People P ON A.postedBy = P.person_id
            WHERE A.courseId = ${courseId} 
            ORDER BY A.createdAt DESC
        `);
        course.announcements = annRes.recordset;

        const lecRes = await sql.query(`SELECT * FROM Lectures WHERE courseId = ${courseId} ORDER BY createdAt DESC`);
        
        course.lectures = lecRes.recordset.map(l => ({
            title: l.title,
            link: `${req.protocol}://${req.get('host')}/uploads/${l.fileName}`
        }));

        res.status(200).json({ status: "success", data: { course } });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const addAnnouncement = async (req, res) => {
    try {
        const { text } = req.body; 
        const courseId = req.params.id;
        const teacherId = req.user.id;

        const safeContent = text.replace(/'/g, "''"); 

        await sql.query(`
            INSERT INTO Announcements (courseId, postedBy, content)
            VALUES (${courseId}, ${teacherId}, '${safeContent}')
        `);

        res.status(200).json({ status: "success", message: "Announcement added" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

const addLecture = async (req, res) => {
    try {
        const { title } = req.body;
        const courseId = req.params.id;
        
        if (!req.file) {
            return res.status(400).json({ status: "fail", message: "No PDF file uploaded" });
        }

        await sql.query(`
            INSERT INTO Lectures (courseId, title, fileName, filePath)
            VALUES (${courseId}, '${title}', '${req.file.filename}', '${req.file.path.replace(/\\/g, "\\\\")}')
        `);

        res.status(200).json({ status: "success", message: "Lecture uploaded" });
    } catch (error) {
        res.status(400).json({ status: "fail", message: error.message });
    }
};

module.exports = { 
    createCourse, getAllCourses, requestEnrollment, manageEnrollment, getMyCourses,
    getCourseDetails, addAnnouncement, addLecture
};