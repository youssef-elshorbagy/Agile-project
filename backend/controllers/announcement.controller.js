const { sql } = require("../config/db");

// Get announcements for parents - shows global announcements and course-specific ones for their children
const getAnnouncementsForParent = async (req, res) => {
  try {
    if (req.user.role !== 'parent') {
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

    // Get global announcements (isGlobal = 1)
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

    // Get course-specific announcements for children's courses
    if (courseIds.length > 0) {
      // Use a loop to get announcements for each course (safer than IN clause with array)
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
      // Remove duplicates in case of any overlap
      const uniqueAnnouncements = announcements.filter((a, index, self) => 
        index === self.findIndex((b) => b.id === a.id)
      );
      announcements = uniqueAnnouncements;
    }

    // Sort by date descending
    announcements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ 
      status: "success", 
      data: { announcements } 
    });

  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// Get all announcements (for students/teachers)
const getAllAnnouncements = async (req, res) => {
  try {
    let announcements = [];

    if (req.user.role === 'student') {
      // Students see global announcements + their enrolled courses
      const coursesResult = await sql.query`
        SELECT DISTINCT courseId FROM Enrollments 
        WHERE studentId = ${req.user.id} AND status = 'enrolled'
      `;
      
      const courseIds = coursesResult.recordset.map(c => c.courseId);
      
      if (courseIds.length > 0) {
        // Get global announcements
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
        
        // Get course-specific announcements
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
        
        // Remove duplicates and sort
        const uniqueAnnouncements = announcements.filter((a, index, self) => 
          index === self.findIndex((b) => b.id === a.id)
        );
        announcements = uniqueAnnouncements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else {
        // Only global announcements
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

    } else if (req.user.role === 'teacher' || req.user.role === 'ta') {
      // Teachers/TAs see all announcements
      const result = await sql.query`
        SELECT 
          A.id, A.courseId, A.teacherName, A.content, A.createdAt, A.isGlobal,
          C.name as courseName, C.code as courseCode
        FROM Announcements A
        LEFT JOIN Courses C ON A.courseId = C.id
        ORDER BY A.createdAt DESC
      `;
      announcements = result.recordset;

    } else if (req.user.role === 'parent') {
      // Redirect to parent-specific handler
      return getAnnouncementsForParent(req, res);
    }

    res.status(200).json({ 
      status: "success", 
      data: { announcements } 
    });

  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

module.exports = {
  getAllAnnouncements,
  getAnnouncementsForParent
};