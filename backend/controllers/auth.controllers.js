const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db");

const signup = async (req, res) => {
  try {
    const { universityId, fullName, email, password, role, isAdvisor, advisorCapacity } = req.body;

    // 1. Validation
    if (password.length < 8) return res.status(400).json({ status: "fail", message: "Password must be at least 8 characters" });
    if (!/^[A-Z]/.test(password)) return res.status(400).json({ status: "fail", message: "Password must start with a Capital Letter" });
    // Validate role (advisor is assigned via isAdvisor flag on teacher)
    if (!role || !['student', 'teacher', 'admin', 'parent'].includes(role)) {
      return res.status(400).json({ status: "fail", message: "Invalid Role" });
    }

    // 2. Check for existing user (Using 'Users' table)
    const checkResult = await sql.query`SELECT * FROM Users WHERE email = ${email} OR universityId = ${universityId}`;
    
    if (checkResult.recordset.length > 0) {
        return res.status(400).json({ status: "fail", message: "User or ID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Set GPA/Level only for students
    const gpa = role === 'student' ? 0.0 : null;
    const level = role === 'student' ? 1 : null;

    // 4. Insert into 'Users'
    await sql.query`
        INSERT INTO Users (universityId, fullName, email, password, role, gpa, level)
        VALUES (${universityId}, ${fullName}, ${email}, ${hashedPassword}, ${role}, ${gpa}, ${level})
    `;
  

    // 5. Get the new user to return
    const newUserResult = await sql.query`SELECT * FROM Users WHERE email = ${email}`;
    const user = newUserResult.recordset[0];

    // If admin requested this teacher to be an advisor, add to Advisors table
    if (isAdvisor && role === 'teacher') {
      try {
        await sql.query`INSERT INTO Advisors (userId, capacity) VALUES (${user.id}, ${advisorCapacity || null})`;
      } catch (e) {
        // ignore insert errors (e.g., table doesn't exist) to keep compatibility
      }
    }

    // Attach isAdvisor flag when returning
    try {
      const advRes = await sql.query`SELECT CASE WHEN EXISTS(SELECT 1 FROM Advisors A WHERE A.userId = ${user.id}) THEN 1 ELSE 0 END AS isAdvisor`;
      user.isAdvisor = advRes.recordset[0].isAdvisor === 1;
    } catch (e) {
      user.isAdvisor = false;
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '90d' });

    user.password = undefined; // Hide password
    res.status(201).json({ status: "success", token, data: { user } });

  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status: "fail", message: "Missing email or password" });

    // Select user and include isAdvisor flag
    const result = await sql.query`SELECT U.*, CASE WHEN EXISTS(SELECT 1 FROM Advisors A WHERE A.userId = U.id) THEN 1 ELSE 0 END AS isAdvisor FROM Users U WHERE email = ${email}`;
    const user = result.recordset[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(404).json({ status: "fail", message: "Incorrect email or password" });
    }
  
    // normalize isAdvisor
    user.isAdvisor = user.isAdvisor === 1 || user.isAdvisor === true;

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '90d' });
    user.password = undefined;

    return res.status(200).json({ status: "success", token, data: { user } });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const protectRoutes = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (token && token.startsWith("Bearer")) token = token.split(" ")[1];
    if (!token) return res.status(401).json({ status: "fail", message: "You are not logged in" });
    
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    const result = await sql.query`SELECT U.*, CASE WHEN EXISTS(SELECT 1 FROM Advisors A WHERE A.userId = U.id) THEN 1 ELSE 0 END AS isAdvisor FROM Users U WHERE id = ${decodedToken.id}`;
    const currentUser = result.recordset[0];

    if (!currentUser) return res.status(401).json({ status: "fail", message: "User no longer exists" });
    
    // normalize
    currentUser.isAdvisor = currentUser.isAdvisor === 1 || currentUser.isAdvisor === true;
    req.user = currentUser;
    req.userId = currentUser.id;
    next();
  } catch (error) {
    res.status(401).json({ status: "fail", message: "Invalid Token" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const result = await sql.query`SELECT U.id, U.universityId, U.fullName, U.email, U.role, U.gpa, U.level, CASE WHEN EXISTS(SELECT 1 FROM Advisors A WHERE A.userId = U.id) THEN 1 ELSE 0 END AS isAdvisor FROM Users U`;
    const users = result.recordset.map(u => ({ ...u, isAdvisor: u.isAdvisor === 1 }));
    res.status(200).json({ status: "success", length: users.length, data: { users } });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const getProfile = async (req, res) => {
  req.user.password = undefined; 
  res.status(200).json({ status: "success", data: { user: req.user } });
};

const updateProfile = async (req, res) => {
  try {
    const { fullName } = req.body;
    await sql.query`UPDATE Users SET fullName = ${fullName} WHERE id = ${req.user.id}`;
    
    const result = await sql.query`SELECT id, fullName, email, role FROM Users WHERE id = ${req.user.id}`;
    res.status(200).json({ status: "success", data: { user: result.recordset[0] } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const getStudentPerformance = async (req, res) => {
  try {
    const studentId = req.user.id; // Use authenticated user's ID
    const result = await sql.query`
      SELECT C.id, C.name, C.code, C.creditHours
      FROM Courses C
      JOIN Enrollments E ON C.id = E.courseId
      WHERE E.studentId = ${studentId} AND E.status = 'enrolled'
    `;
    res.status(200).json({ status: 'success', data: { courses: result.recordset } });
  } catch (error) {
    console.error('Error fetching student performance:', error);
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

const getStudentCourses = async (req, res) => {
  try {
    const studentId = req.params.id || req.user.id;
    const result = await sql.query`
      SELECT 
        C.id, C.name, C.code, C.creditHours,
        E.status as enrollmentStatus,
        E.enrolledAt
      FROM Courses C
      JOIN Enrollments E ON C.id = E.courseId
      WHERE E.studentId = ${studentId} AND E.status = 'enrolled'
      ORDER BY C.code
    `;
    res.status(200).json({ status: 'success', data: { courses: result.recordset } });
  } catch (error) {
    console.error('Error fetching student courses:', error);
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

const getStudentGrades = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    
    // Verify access if parent
    if (req.user.role === 'parent') {
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
    }
    
    // Get grades for the student in the course
    const result = await sql.query`
      SELECT 
        A.id as assignmentId,
        A.title,
        A.maxScore,
        S.score,
        S.submittedAt,
        S.status
      FROM Assignments A
      LEFT JOIN Submissions S ON A.id = S.assignmentId AND S.studentId = ${studentId}
      WHERE A.courseId = ${courseId}
      ORDER BY A.createdAt DESC
    `;
    
    res.status(200).json({ 
      status: 'success', 
      data: { grades: result.recordset } 
    });
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ status: 'fail', message: error.message });
  }
};
module.exports = {
  signup,
  login,    
  protectRoutes,
  getAllUsers,
  getProfile,
  updateProfile,
  getStudentPerformance,
  getStudentCourses,
  getStudentGrades
};

