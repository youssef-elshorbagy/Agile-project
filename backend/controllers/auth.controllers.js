const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db");

// ... (signup, login, protectRoutes, getAllUsers, getProfile, updateProfile STAY THE SAME)
// Copy them from your existing file, they are correct.

const signup = async (req, res) => {
  try {
    const { universityId, fullName, email, password, role, isAdvisor } = req.body;

    if (password.length < 8) return res.status(400).json({ status: "fail", message: "Password must be at least 8 characters" });
    if (!/^[A-Z]/.test(password)) return res.status(400).json({ status: "fail", message: "Password must start with a Capital Letter" });
    
    // Validate role (Case Insensitive)
    const normalizedRole = (role || '').toLowerCase();
    if (!['student', 'teacher', 'admin', 'parent'].includes(normalizedRole)) {
      return res.status(400).json({ status: "fail", message: "Invalid Role" });
    }

    const checkResult = await sql.query`SELECT id FROM People WHERE email = ${email} OR universityId = ${universityId}`;
    if (checkResult.recordset.length > 0) {
        return res.status(400).json({ status: "fail", message: "User or ID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await sql.query`
        INSERT INTO People (universityId, fullName, email, password)
        OUTPUT INSERTED.id, INSERTED.universityId, INSERTED.fullName, INSERTED.email
        VALUES (${universityId}, ${fullName}, ${email}, ${hashedPassword})
    `;
    const newPerson = result.recordset[0];

    await sql.query`
        INSERT INTO PersonRoles (person_id, role_id)
        SELECT ${newPerson.id}, role_id FROM Roles WHERE LOWER(role_name) = ${normalizedRole}
    `;

    if (normalizedRole === 'student') {
        await sql.query`INSERT INTO PersonAttributeValues (person_id, attr_id, attr_value) SELECT ${newPerson.id}, attr_id, '0.00' FROM PersonAttributes WHERE attributeName = 'GPA'`;
        await sql.query`INSERT INTO PersonAttributeValues (person_id, attr_id, attr_value) SELECT ${newPerson.id}, attr_id, '1' FROM PersonAttributes WHERE attributeName = 'Level'`;

        try {
            const emailParts = email.split('@');
            const parentEmail = `${emailParts[0]}_parent@${emailParts[1]}`; 
            const parentUnivId = `${universityId}_P`; 
            const parentName = `Parent of ${fullName}`;

            const parentRes = await sql.query`
                INSERT INTO People (universityId, fullName, email, password)
                OUTPUT INSERTED.id VALUES (${parentUnivId}, ${parentName}, ${parentEmail}, ${hashedPassword})`;
            const parentId = parentRes.recordset[0].id;

            await sql.query`INSERT INTO PersonRoles (person_id, role_id) SELECT ${parentId}, role_id FROM Roles WHERE role_name = 'Parent'`;
            await sql.query`INSERT INTO parent_student (parent_id, student_id) VALUES (${parentId}, ${newPerson.id})`;
        } catch (parentErr) { console.error("Auto-parent skipped:", parentErr); }
    }

    if (normalizedRole === 'teacher' && isAdvisor) {
        await sql.query`INSERT INTO PersonRoles (person_id, role_id) SELECT ${newPerson.id}, role_id FROM Roles WHERE role_name = 'Advisor'`;
    }

    const token = jwt.sign({ id: newPerson.id, role: normalizedRole }, process.env.JWT_SECRET || 'secret', { expiresIn: '90d' });
    res.status(201).json({ status: "success", token, data: { user: { ...newPerson, role: normalizedRole, isAdvisor: isAdvisor || false } } });

  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ status: "fail", message: "Missing email or password" });

    const result = await sql.query`
      SELECT 
        P.*, 
        R.role_name as role,
        MAX(CASE WHEN PA.attributeName = 'GPA' THEN PAV.attr_value END) as gpa,
        MAX(CASE WHEN PA.attributeName = 'Level' THEN PAV.attr_value END) as level,
        CASE WHEN EXISTS(
            SELECT 1 FROM PersonRoles PR2 
            JOIN Roles R2 ON PR2.role_id = R2.role_id 
            WHERE PR2.person_id = P.id AND R2.role_name = 'Advisor'
        ) THEN 1 ELSE 0 END AS isAdvisor
      FROM People P
      LEFT JOIN PersonRoles PR ON P.id = PR.person_id
      LEFT JOIN Roles R ON PR.role_id = R.role_id
      LEFT JOIN PersonAttributeValues PAV ON P.id = PAV.person_id
      LEFT JOIN PersonAttributes PA ON PAV.attr_id = PA.attr_id
      WHERE P.email = ${email}
      GROUP BY P.id, P.universityId, P.fullName, P.email, P.password, P.createdAt, R.role_name
    `;

    const user = result.recordset[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(404).json({ status: "fail", message: "Incorrect email or password" });
    }
  
    user.isAdvisor = user.isAdvisor === 1;
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
    
    const result = await sql.query`
      SELECT P.*, R.role_name as role,
        CASE WHEN EXISTS(
            SELECT 1 FROM PersonRoles PR2 
            JOIN Roles R2 ON PR2.role_id = R2.role_id 
            WHERE PR2.person_id = P.id AND R2.role_name = 'Advisor'
        ) THEN 1 ELSE 0 END AS isAdvisor
      FROM People P
      LEFT JOIN PersonRoles PR ON P.id = PR.person_id
      LEFT JOIN Roles R ON PR.role_id = R.role_id
      WHERE P.id = ${decodedToken.id}
    `;
      
    const currentUser = result.recordset[0];
    if (!currentUser) return res.status(401).json({ status: "fail", message: "User no longer exists" });
    
    currentUser.isAdvisor = currentUser.isAdvisor === 1;
    req.user = currentUser;
    req.userId = currentUser.id;
    next();
  } catch (error) {
    res.status(401).json({ status: "fail", message: "Invalid Token" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT 
        P.id, P.universityId, P.fullName, P.email, R.role_name as role,
        MAX(CASE WHEN PA.attributeName = 'GPA' THEN PAV.attr_value END) as gpa,
        MAX(CASE WHEN PA.attributeName = 'Level' THEN PAV.attr_value END) as level,
        CASE WHEN EXISTS(
            SELECT 1 FROM PersonRoles PR2 
            JOIN Roles R2 ON PR2.role_id = R2.role_id 
            WHERE PR2.person_id = P.id AND R2.role_name = 'Advisor'
        ) THEN 1 ELSE 0 END AS isAdvisor
      FROM People P
      LEFT JOIN PersonRoles PR ON P.id = PR.person_id
      LEFT JOIN Roles R ON PR.role_id = R.role_id
      LEFT JOIN PersonAttributeValues PAV ON P.id = PAV.person_id
      LEFT JOIN PersonAttributes PA ON PAV.attr_id = PA.attr_id
      GROUP BY P.id, P.universityId, P.fullName, P.email, R.role_name
    `;
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
    await sql.query`UPDATE People SET fullName = ${fullName} WHERE id = ${req.user.id}`;
    res.status(200).json({ status: "success", message: "Profile Updated" });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

// UPDATED: EAV Fetch
const getStudentPerformance = async (req, res) => {
  try {
    const studentId = req.user.id; 
    const result = await sql.query`
      SELECT 
        C.id, C.name, C.code, 
        MAX(CASE WHEN CA.attributeName = 'CreditHours' THEN CAV.attr_value END) as creditHours
      FROM Courses C
      JOIN Enrollments E ON C.id = E.courseId
      LEFT JOIN CourseAttributeValues CAV ON C.id = CAV.course_id
      LEFT JOIN CourseAttributes CA ON CAV.attr_id = CA.attr_id
      WHERE E.studentId = ${studentId} AND E.status = 'enrolled'
      GROUP BY C.id, C.name, C.code
    `;
    res.status(200).json({ status: 'success', data: { courses: result.recordset } });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

// UPDATED: EAV Fetch
const getStudentCourses = async (req, res) => {
  try {
    const studentId = req.params.id || req.user.id;
    const result = await sql.query`
      SELECT 
        C.id, C.name, C.code, 
        MAX(CASE WHEN CA.attributeName = 'CreditHours' THEN CAV.attr_value END) as creditHours,
        E.status as enrollmentStatus,
        E.enrolledAt
      FROM Courses C
      JOIN Enrollments E ON C.id = E.courseId
      LEFT JOIN CourseAttributeValues CAV ON C.id = CAV.course_id
      LEFT JOIN CourseAttributes CA ON CAV.attr_id = CA.attr_id
      WHERE E.studentId = ${studentId} AND E.status = 'enrolled'
      GROUP BY C.id, C.name, C.code, E.status, E.enrolledAt
      ORDER BY C.code
    `;
    res.status(200).json({ status: 'success', data: { courses: result.recordset } });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

const getStudentGrades = async (req, res) => {
  try {
    const { studentId, courseId } = req.params;
    
    // CASE INSENSITIVE CHECK
    if ((req.user.role || '').toLowerCase() === 'parent') {
      const accessCheck = await sql.query`
        SELECT * FROM parent_student 
        WHERE parent_id = ${req.user.id} AND student_id = ${studentId}
      `;
      if (accessCheck.recordset.length === 0) {
        return res.status(403).json({ status: "fail", message: "You don't have access to this student's data" });
      }
    }
    
    const result = await sql.query`
      SELECT 
        U.id as assignmentId, U.title,
        MAX(CASE WHEN UA_Score.attributeName = 'MaxScore' THEN UAV_Score.attr_value END) as maxScore,
        MAX(CASE WHEN UA_Grade.attributeName = 'Grade' THEN UAV_Grade.attr_value END) as score,
        Sub.createdAt as submittedAt
      FROM Uploads U
      LEFT JOIN UploadAttributeValues UAV_Score ON U.id = UAV_Score.upload_id
      LEFT JOIN UploadAttributes UA_Score ON UAV_Score.attr_id = UA_Score.attr_id
      LEFT JOIN Uploads Sub ON Sub.uploadType = 'student_submission' AND Sub.uploaderId = ${studentId}
      LEFT JOIN UploadAttributeValues UAV_Grade ON Sub.id = UAV_Grade.upload_id
      LEFT JOIN UploadAttributes UA_Grade ON UAV_Grade.attr_id = UA_Grade.attr_id
      WHERE U.courseId = ${courseId} AND U.uploadType = 'assignment_item'
      GROUP BY U.id, U.title, Sub.createdAt
      ORDER BY Sub.createdAt DESC
    `;
    
    res.status(200).json({ status: 'success', data: { grades: result.recordset } });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

module.exports = {
  signup, login, protectRoutes, getAllUsers, getProfile, updateProfile,
  getStudentPerformance, getStudentCourses, getStudentGrades
};