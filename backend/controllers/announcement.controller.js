const { sql } = require("../config/db");

// Get announcements for parents
const getAnnouncementsForParent = async (req, res) => {
  try {
    if ((req.user.role || '').toLowerCase() !== 'parent') {
      return res.status(403).json({ status: "fail", message: "Parents only" });
    }

    // Get all courses that parent's children are enrolled in
    const coursesResult = await sql.query`
      SELECT DISTINCT C.id
      FROM parent_student PS
      JOIN Enrollments E ON PS.student_id = E.studentId
      JOIN Courses C ON E.courseId = C.id
      WHERE PS.parent_id = ${req.user.id} AND E.status = 'enrolled'
    `;

    const courseIds = coursesResult.recordset.map(c => c.id);

    let announcements = [];

    const globalResult = await sql.query`
      SELECT 
        A.id, A.courseId, A.teacherName, A.content, A.createdAt, A.isGlobal,
        C.name as courseName, C.code as courseCode
      FROM Announcements A
      LEFT JOIN Courses C ON A.courseId = C.id
      WHERE A.isGlobal = 1
      ORDER BY A.createdAt DESC
    `;

    announcements = globalResult.recordset;

    if (courseIds.length > 0) {
      for (const courseId of courseIds) {
        const courseAnnouncementsResult = await sql.query`
          SELECT 
            A.id, A.courseId, A.teacherName, A.content, A.createdAt, A.isGlobal,
            C.name as courseName, C.code as courseCode
          FROM Announcements A
          JOIN Courses C ON A.courseId = C.id
          WHERE A.courseId = ${courseId} AND (A.isGlobal = 0 OR A.isGlobal IS NULL)
          ORDER BY A.createdAt DESC
        `;
        announcements = [...announcements, ...courseAnnouncementsResult.recordset];
      }
      const uniqueAnnouncements = announcements.filter((a, index, self) => 
        index === self.findIndex((b) => b.id === a.id)
      );
      announcements = uniqueAnnouncements;
    }

    announcements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ status: "success", data: { announcements } });

  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// Get all announcements (Generic)
const getAllAnnouncements = async (req, res) => {
  try {
    let announcements = [];
    const userRole = (req.user.role || '').toLowerCase();

    if (userRole === 'student') {
      const coursesResult = await sql.query`
        SELECT DISTINCT courseId FROM Enrollments 
        WHERE studentId = ${req.user.id} AND status = 'enrolled'
      `;
      
      const courseIds = coursesResult.recordset.map(c => c.courseId);
      
      if (courseIds.length > 0) {
        const globalResult = await sql.query`
          SELECT 
            A.id, A.courseId, A.teacherName, A.content, A.createdAt, A.isGlobal,
            C.name as courseName, C.code as courseCode
          FROM Announcements A
          LEFT JOIN Courses C ON A.courseId = C.id
          WHERE A.isGlobal = 1
          ORDER BY A.createdAt DESC
        `;
        announcements = globalResult.recordset;
        
        for (const courseId of courseIds) {
          const courseResult = await sql.query`
            SELECT 
              A.id, A.courseId, A.teacherName, A.content, A.createdAt, A.isGlobal,
              C.name as courseName, C.code as courseCode
            FROM Announcements A
            LEFT JOIN Courses C ON A.courseId = C.id
            WHERE A.courseId = ${courseId} AND (A.isGlobal = 0 OR A.isGlobal IS NULL)
            ORDER BY A.createdAt DESC
          `;
          announcements = [...announcements, ...courseResult.recordset];
        }
        
        const uniqueAnnouncements = announcements.filter((a, index, self) => 
          index === self.findIndex((b) => b.id === a.id)
        );
        announcements = uniqueAnnouncements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else {
        const result = await sql.query`
          SELECT 
            A.id, A.courseId, A.teacherName, A.content, A.createdAt, A.isGlobal,
            C.name as courseName, C.code as courseCode
          FROM Announcements A
          LEFT JOIN Courses C ON A.courseId = C.id
          WHERE A.isGlobal = 1
          ORDER BY A.createdAt DESC
        `;
        announcements = result.recordset;
      }

    } else if (userRole === 'teacher' || userRole === 'ta') {
      const result = await sql.query`
        SELECT 
          A.id, A.courseId, A.teacherName, A.content, A.createdAt, A.isGlobal,
          C.name as courseName, C.code as courseCode
        FROM Announcements A
        LEFT JOIN Courses C ON A.courseId = C.id
        ORDER BY A.createdAt DESC
      `;
      announcements = result.recordset;

    } else if (userRole === 'parent') {
      return getAnnouncementsForParent(req, res);
    }

    res.status(200).json({ status: "success", data: { announcements } });

  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

module.exports = {
  getAllAnnouncements,
  getAnnouncementsForParent
};