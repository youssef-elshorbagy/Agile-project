const { sql } = require("../config/db");

// Get all children linked to the parent
const getChildren = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        u.id as studentId,
        u.universityId,
        u.fullName as name,
        u.email,
        u.gpa,
        u.level
      FROM parent_student ps
      JOIN Users u ON ps.student_id = u.id
      WHERE ps.parent_id = ${req.user.id}
      ORDER BY u.fullName
    `;
    
    res.status(200).json({
      status: "success",
      data: { children: result.recordset }
    });
  } catch (error) {
    console.error('Error fetching children:', error);
    res.status(500).json({ 
      status: "fail", 
      message: error.message 
    });
  }
};

// Get courses for a specific child
const getChildCourses = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Verify parent has access to this student
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
    
    const result = await sql.query`
      SELECT 
        c.id,
        c.name,
        c.code,
        c.creditHours,
        c.description,
        u.fullName as instructorName,
        e.status as enrollmentStatus,
        e.enrolledAt
      FROM Enrollments e
      JOIN Courses c ON e.courseId = c.id
      LEFT JOIN Users u ON c.instructorId = u.id
      WHERE e.studentId = ${studentId} AND e.status = 'enrolled'
      ORDER BY c.code
    `;
    
    res.status(200).json({
      status: "success",
      data: { courses: result.recordset }
    });
  } catch (error) {
    console.error('Error fetching child courses:', error);
    res.status(500).json({ 
      status: "fail", 
      message: error.message 
    });
  }
};

// Get child's detailed progress with grades and assignments
const getChildProgress = async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Verify parent has access to this student
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
    
    // Get student info
    const studentResult = await sql.query`
      SELECT id, universityId, fullName, email, gpa, level
      FROM Users
      WHERE id = ${studentId} AND role = 'student'
    `;
    
    if (studentResult.recordset.length === 0) {
      return res.status(404).json({ 
        status: "fail", 
        message: "Student not found" 
      });
    }
    
    // Get enrolled courses with assignment details
    const coursesResult = await sql.query`
      SELECT 
        c.id,
        c.name,
        c.code,
        c.creditHours,
        u.fullName as instructorName,
        e.status as enrollmentStatus,
        e.enrolledAt
      FROM Enrollments e
      JOIN Courses c ON e.courseId = c.id
      LEFT JOIN Users u ON c.instructorId = u.id
      WHERE e.studentId = ${studentId} AND e.status = 'enrolled'
      ORDER BY c.code
    `;
    
    const courses = coursesResult.recordset;
    
    // For each course, get assignments and submissions
    for (let course of courses) {
      const assignmentsResult = await sql.query`
        SELECT 
          a.id,
          a.title,
          a.description,
          a.deadline,
          a.maxScore,
          s.id as submissionId,
          s.score,
          s.submittedAt,
          s.status as submissionStatus,
          s.feedback
        FROM Assignments a
        LEFT JOIN Submissions s ON a.id = s.assignmentId AND s.studentId = ${studentId}
        WHERE a.courseId = ${course.id}
        ORDER BY a.deadline DESC
      `;
      
      course.assignments = assignmentsResult.recordset.map(a => ({
        id: a.id,
        title: a.title,
        description: a.description,
        deadline: a.deadline,
        maxScore: a.maxScore,
        submissionId: a.submissionId,
        score: a.score,
        submittedAt: a.submittedAt,
        submissionStatus: a.submissionStatus,
        feedback: a.feedback,
        isSubmitted: !!a.submissionId,
        isGraded: a.score !== null
      }));
      
      // Calculate course statistics
      const totalAssignments = course.assignments.length;
      const submittedAssignments = course.assignments.filter(a => a.isSubmitted).length;
      const gradedAssignments = course.assignments.filter(a => a.isGraded).length;
      
      let averageScore = 0;
      if (gradedAssignments > 0) {
        const totalScore = course.assignments
          .filter(a => a.isGraded)
          .reduce((sum, a) => sum + (a.score / a.maxScore * 100), 0);
        averageScore = totalScore / gradedAssignments;
      }
      
      course.statistics = {
        totalAssignments,
        submittedAssignments,
        gradedAssignments,
        averageScore: averageScore.toFixed(2)
      };
    }
    
    res.status(200).json({
      status: "success",
      data: {
        student: studentResult.recordset[0],
        courses: courses
      }
    });
  } catch (error) {
    console.error('Error fetching child progress:', error);
    res.status(500).json({ 
      status: "fail", 
      message: error.message 
    });
  }
};

// Get grades for a specific course
const getChildGrades = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    
    // Verify parent has access to this student
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
    
    // Get course info
    const courseResult = await sql.query`
      SELECT c.name, c.code, u.fullName as instructorName
      FROM Courses c
      LEFT JOIN Users u ON c.instructorId = u.id
      WHERE c.id = ${courseId}
    `;
    
    // Get all assignments and submissions for this course
    const gradesResult = await sql.query`
      SELECT 
        a.id as assignmentId,
        a.title,
        a.description,
        a.maxScore,
        a.deadline,
        s.score,
        s.submittedAt,
        s.status,
        s.feedback
      FROM Assignments a
      LEFT JOIN Submissions s ON a.id = s.assignmentId AND s.studentId = ${studentId}
      WHERE a.courseId = ${courseId}
      ORDER BY a.deadline DESC
    `;
    
    res.status(200).json({ 
      status: 'success', 
      data: { 
        course: courseResult.recordset[0],
        grades: gradesResult.recordset 
      } 
    });
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ 
      status: 'fail', 
      message: error.message 
    });
  }
};

// Get all parents and students for linking
const getParentsAndStudents = async (req, res) => {
  try {
    // Get all parents
    const parentsResult = await sql.query`
      SELECT id, universityId, fullName, email 
      FROM Users 
      WHERE role = 'parent'
      ORDER BY fullName
    `;

    // Get all students
    const studentsResult = await sql.query`
      SELECT id, universityId, fullName, email, gpa, level
      FROM Users 
      WHERE role = 'student'
      ORDER BY fullName
    `;

    // Get existing links
    const linksResult = await sql.query`
      SELECT 
        ps.id as linkId,
        ps.parent_id,
        ps.student_id,
        p.fullName as parentName,
        s.fullName as studentName,
        s.universityId as studentUniversityId
      FROM parent_student ps
      JOIN Users p ON ps.parent_id = p.id
      JOIN Users s ON ps.student_id = s.id
    `;

    res.status(200).json({
      status: 'success',
      data: {
        parents: parentsResult.recordset,
        students: studentsResult.recordset,
        links: linksResult.recordset
      }
    });
  } catch (error) {
    console.error('Error fetching parents and students:', error);
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

// Link parent to student
const linkParentToStudent = async (req, res) => {
  try {
    const { parentId, studentId } = req.body;

    // Validate inputs
    if (!parentId || !studentId) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'Parent ID and Student ID are required' 
      });
    }

    // Check if parent exists
    const parentCheck = await sql.query`
      SELECT id FROM Users WHERE id = ${parentId} AND role = 'parent'
    `;
    if (parentCheck.recordset.length === 0) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Parent not found' 
      });
    }

    // Check if student exists
    const studentCheck = await sql.query`
      SELECT id FROM Users WHERE id = ${studentId} AND role = 'student'
    `;
    if (studentCheck.recordset.length === 0) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Student not found' 
      });
    }

    // Check if link already exists
    const linkCheck = await sql.query`
      SELECT id FROM parent_student 
      WHERE parent_id = ${parentId} AND student_id = ${studentId}
    `;
    if (linkCheck.recordset.length > 0) {
      return res.status(400).json({ 
        status: 'fail', 
        message: 'This parent is already linked to this student' 
      });
    }

    // Create the link
    await sql.query`
      INSERT INTO parent_student (parent_id, student_id)
      VALUES (${parentId}, ${studentId})
    `;

    res.status(201).json({ 
      status: 'success', 
      message: 'Parent successfully linked to student' 
    });
  } catch (error) {
    console.error('Error linking parent to student:', error);
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

// Unlink parent from student
const unlinkParentFromStudent = async (req, res) => {
  try {
    const { linkId } = req.params;

    const result = await sql.query`
      DELETE FROM parent_student WHERE id = ${linkId}
    `;

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Link not found' 
      });
    }

    res.status(200).json({ 
      status: 'success', 
      message: 'Parent unlinked from student successfully' 
    });
  } catch (error) {
    console.error('Error unlinking parent from student:', error);
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

module.exports = {
  getChildren,
  getChildCourses,
  getChildProgress,
  getChildGrades,
  getParentsAndStudents,
  linkParentToStudent,
  unlinkParentFromStudent
};