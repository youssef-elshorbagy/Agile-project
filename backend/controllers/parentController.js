const { sql } = require("../config/db");

// Get all children linked to the parent
const getChildren = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        p.id as studentId,
        p.universityId,
        p.fullName as name,
        p.email,
        MAX(CASE WHEN attr.attributeName = 'GPA' THEN val.attr_value END) as gpa,
        MAX(CASE WHEN attr.attributeName = 'Level' THEN val.attr_value END) as level
      FROM parent_student ps
      JOIN People p ON ps.student_id = p.id
      LEFT JOIN PersonAttributeValues val ON p.id = val.person_id
      LEFT JOIN PersonAttributes attr ON val.attr_id = attr.attr_id
      WHERE ps.parent_id = ${req.user.id}
      GROUP BY p.id, p.universityId, p.fullName, p.email
      ORDER BY p.fullName
    `;
    
    const children = result.recordset.map(c => ({
        ...c,
        gpa: parseFloat(c.gpa || 0),
        level: parseInt(c.level || 1)
    }));

    res.status(200).json({
      status: "success",
      data: { children }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// Get progress (Courses + Calculated Grades)
const getChildProgress = async (req, res) => {
  try {
    const { studentId } = req.params;

    // 1. Verify Parent Link
    const linkCheck = await sql.query`
        SELECT * FROM parent_student WHERE parent_id = ${req.user.id} AND student_id = ${studentId}
    `;
    if (linkCheck.recordset.length === 0) {
        return res.status(403).json({ status: "fail", message: "Not authorized for this student" });
    }

    // 2. Get Enrolled Courses
    const coursesRes = await sql.query`
        SELECT C.id, C.name, C.code 
        FROM Enrollments E
        JOIN Courses C ON E.courseId = C.id
        WHERE E.studentId = ${studentId} AND (E.status = 'approved' OR E.status = 'enrolled')
    `;
    const courses = coursesRes.recordset;

    // 3. Calculate Grades per Course
    for (let course of courses) {
        // A. Total Assignments
        const assignRes = await sql.query`
            SELECT COUNT(*) as total 
            FROM Uploads 
            WHERE courseId = ${course.id} AND uploadType = 'assignment_item'
        `;
        const totalAssignments = assignRes.recordset[0].total;

        // B. Student Stats (Fixed duplicates logic)
        const statsRes = await sql.query`
            SELECT 
                COUNT(DISTINCT Sub.id) as submittedCount,
                AVG(TRY_CAST(GradeVal.attr_value AS FLOAT)) as averageGrade
            FROM Uploads Sub
            JOIN UploadAttributeValues RefVal ON Sub.id = RefVal.upload_id
            JOIN UploadAttributes RefAttr ON RefVal.attr_id = RefAttr.attr_id AND RefAttr.attributeName = 'ReferenceId'
            JOIN Uploads Assignment ON TRY_CAST(RefVal.attr_value AS INT) = Assignment.id
            LEFT JOIN UploadAttributeValues GradeVal ON Sub.id = GradeVal.upload_id 
                AND GradeVal.attr_id = (SELECT TOP 1 attr_id FROM UploadAttributes WHERE attributeName = 'Grade')
            WHERE Sub.uploaderId = ${studentId} 
              AND Sub.uploadType = 'student_submission'
              AND Assignment.courseId = ${course.id}
        `;

        const stats = statsRes.recordset[0];

        course.statistics = {
            totalAssignments: totalAssignments,
            submittedAssignments: stats.submittedCount || 0,
            averageScore: stats.averageGrade || 0
        };
    }

    res.status(200).json({ status: "success", data: { courses } });

  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// UPDATED: EAV Fetch for child courses
const getChildCourses = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    const accessCheck = await sql.query`
      SELECT id FROM parent_student 
      WHERE parent_id = ${req.user.id} AND student_id = ${studentId}
    `;
    
    if (accessCheck.recordset.length === 0) {
      return res.status(403).json({ status: "fail", message: "Access Denied" });
    }
    
    const result = await sql.query`
      SELECT 
        c.id, c.name, c.code, 
        MAX(CASE WHEN CA.attributeName = 'CreditHours' THEN CAV.attr_value END) as creditHours,
        u.fullName as instructorName,
        e.status as enrollmentStatus, e.enrolledAt
      FROM Enrollments e
      JOIN Courses c ON e.courseId = c.id
      LEFT JOIN People u ON c.instructorId = u.id
      LEFT JOIN CourseAttributeValues CAV ON c.id = CAV.course_id
      LEFT JOIN CourseAttributes CA ON CAV.attr_id = CA.attr_id
      WHERE e.studentId = ${studentId} AND e.status = 'enrolled'
      GROUP BY c.id, c.name, c.code, u.fullName, e.status, e.enrolledAt
      ORDER BY c.code
    `;
    
    res.status(200).json({ status: "success", data: { courses: result.recordset } });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

module.exports = {
  getChildren,
  getChildCourses,
  getChildProgress,
  getParentMessages: require('./message.controller').getParentMessages, 
  sendParentMessage: require('./message.controller').sendParentMessage
};