const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db");

// ==========================================
// 1. SIGNUP (Fixed to use Users table only)
// ==========================================
const signup = async (req, res) => {
  try {
    const { universityId, fullName, email, password, role, isAdvisor, advisorCapacity } = req.body;

    // Validation
    if (password.length < 8) return res.status(400).json({ status: "fail", message: "Password must be at least 8 characters" });
    if (!/^[A-Z]/.test(password)) return res.status(400).json({ status: "fail", message: "Password must start with a Capital Letter" });
    if (!role || !['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ status: "fail", message: "Invalid Role" });
    }

    // Check existing
    const checkResult = await sql.query`SELECT * FROM Users WHERE email = ${email} OR universityId = ${universityId}`;
    if (checkResult.recordset.length > 0) {
        return res.status(400).json({ status: "fail", message: "User or ID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const gpa = role === 'student' ? 0.0 : null;
    const level = role === 'student' ? 1 : null;
    
    // Convert isAdvisor to 1 or 0
    const isAdvisorBit = (role === 'teacher' && isAdvisor) ? 1 : 0;
    const capacity = (role === 'teacher' && isAdvisor) ? (advisorCapacity || 50) : null;

    // Insert
    await sql.query`
        INSERT INTO Users (universityId, fullName, email, password, role, gpa, level, isAdvisor, advisorCapacity)
        VALUES (${universityId}, ${fullName}, ${email}, ${hashedPassword}, ${role}, ${gpa}, ${level}, ${isAdvisorBit}, ${capacity})
    `;

    // Return new user
    const newUserResult = await sql.query`SELECT * FROM Users WHERE email = ${email}`;
    const user = newUserResult.recordset[0];
    
    // Normalize ID
    user.id = user.ID || user.id;

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '90d' });

    user.password = undefined;
    res.status(201).json({ status: "success", token, data: { user } });

  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ==========================================
// 2. LOGIN (Hybrid + Capitalization Fix)
// ==========================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("🔍 Login Attempt:", email);

    if (!email || !password) return res.status(400).json({ status: "fail", message: "Missing email or password" });

    const result = await sql.query(`SELECT * FROM Users WHERE email = '${email}'`);
    const user = result.recordset[0];

    if (!user) return res.status(404).json({ status: "fail", message: "User not found" });

    // Hybrid Check
    let isMatch = (user.password == password);
    if (!isMatch) {
        try { isMatch = await bcrypt.compare(password, user.password); } 
        catch (err) { isMatch = false; }
    }

    if (!isMatch) return res.status(401).json({ status: "fail", message: "Incorrect email or password" });
  
    // CRITICAL FIX: Handle 'id' vs 'ID'
    const userId = user.id || user.ID; 
    const isAdvisorBool = (user.isAdvisor === true || user.isAdvisor === 1);

    const token = jwt.sign(
        { id: userId, role: user.role, isAdvisor: isAdvisorBool }, 
        process.env.JWT_SECRET || 'secret', 
        { expiresIn: '90d' }
    );

    user.password = undefined;
    user.id = userId; // Force lowercase for frontend
    user.isAdvisor = isAdvisorBool;

    console.log("✅ Login Success:", user.fullName);
    return res.status(200).json({ status: "success", token, data: { user } });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ status: "fail", message: error.message });
  }
};

// ==========================================
// 3. PROTECT ROUTES (The Missing Link!)
// ==========================================
const protectRoutes = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (token && token.startsWith("Bearer")) token = token.split(" ")[1];
    if (!token) return res.status(401).json({ status: "fail", message: "You are not logged in" });
    
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // Query User
    const result = await sql.query(`SELECT * FROM Users WHERE id = ${decodedToken.id}`);
    const currentUser = result.recordset[0];

    if (!currentUser) return res.status(401).json({ status: "fail", message: "User no longer exists" });
    
    // CRITICAL FIX: Ensure 'req.user.id' exists so other files can find courses
    currentUser.id = currentUser.ID || currentUser.id;
    currentUser.isAdvisor = (currentUser.isAdvisor === true || currentUser.isAdvisor === 1);
    
    req.user = currentUser;
    req.userId = currentUser.id; // Double backup
    
    next();
  } catch (error) {
    console.error("Auth Error:", error.message);
    res.status(401).json({ status: "fail", message: "Invalid Token" });
  }
};

// ==========================================
// 4. GET ALL USERS (Fixed)
// ==========================================
const getAllUsers = async (req, res) => {
  try {
    // Select directly from Users table
    const result = await sql.query`SELECT id, universityId, fullName, email, role, gpa, level, isAdvisor FROM Users`;
    const users = result.recordset.map(u => ({ 
        ...u, 
        id: u.ID || u.id,
        isAdvisor: (u.isAdvisor === true || u.isAdvisor === 1) 
    }));
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

module.exports = { signup, getAllUsers, login, protectRoutes, getProfile, updateProfile };