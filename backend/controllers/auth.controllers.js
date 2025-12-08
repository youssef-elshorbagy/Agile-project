const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sql } = require("../config/db");

const signup = async (req, res) => {
  try {
    const { universityId, fullName, email, password, role } = req.body;

    if (password.length < 8) return res.status(400).json({ status: "fail", message: "Password must be at least 8 characters" });
    if (!/^[A-Z]/.test(password)) return res.status(400).json({ status: "fail", message: "Password must start with a Capital Letter" });
    if (!role || (role !== "student" && role !== "teacher" && role !== "admin")) return res.status(400).json({ status: "fail", message: "Invalid Role" });

    const checkQuery = `SELECT * FROM Users WHERE email = '${email}' OR universityId = '${universityId}'`;
    const checkResult = await sql.query(checkQuery);
    
    if (checkResult.recordset.length > 0) {
        return res.status(400).json({ status: "fail", message: "User or ID already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const gpa = role === 'student' ? 0.0 : 'NULL';
    const level = role === 'student' ? 1 : 'NULL';

    await sql.query(`
        INSERT INTO Users (universityId, fullName, email, password, role, gpa, level)
        VALUES ('${universityId}', '${fullName}', '${email}', '${hashedPassword}', '${role}', ${gpa}, ${level})
    `);

    const newUserResult = await sql.query(`SELECT * FROM Users WHERE email = '${email}'`);
    const user = newUserResult.recordset[0];

    const token = jwt.sign(
      { id: user.id, name: user.fullName, role: user.role },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
    );

    user.password = undefined;

    res.status(201).json({ status: "success", token, data: { user } });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) return res.status(400).json({ status: "fail", message: "Email or Password is missing" });

    const result = await sql.query(`SELECT * FROM Users WHERE email = '${email}'`);
    const user = result.recordset[0];

    if (!user) return res.status(404).json({ status: "fail", message: "User not found" });

    const matchedPassword = await bcrypt.compare(password, user.password);
    if (!matchedPassword) return res.status(404).json({ status: "fail", message: "Wrong password" });
  
    const token = jwt.sign(
      { id: user.id, name: user.fullName, role: user.role }, 
      process.env.JWT_SECRET || 'secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '90d' }
    );
  
    user.password = undefined;

    return res.status(200).json({
      status: "success",
      token: token,
      data: { user },
    });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const protectRoutes = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (token && token.startsWith("Bearer")) {
      token = token.split(" ")[1];
    }
    if (!token) return res.status(401).json({ status: "fail", message: "You are not logged in" });
    
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    const result = await sql.query(`SELECT * FROM Users WHERE id = ${decodedToken.id}`);
    const currentUser = result.recordset[0];

    if (!currentUser) return res.status(401).json({ status: "fail", message: "User no longer exists" });
    
    req.user = currentUser;
    req.userId = currentUser.id; 
    next();
  } catch (error) {
    res.status(401).json({ status: "fail", message: "Invalid Token" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 5;
    const offset = (page - 1) * limit;

    const query = `
        SELECT id, universityId, fullName, email, role, gpa, level 
        FROM Users 
        ORDER BY id 
        OFFSET ${offset} ROWS 
        FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await sql.query(query);
    
    res.status(200).json({ status: "success", length: result.recordset.length, data: { users: result.recordset } });
  } catch (error) {
    res.status(500).json({ status: "fail", message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = req.user;
    user.password = undefined; 
    res.status(200).json({ status: "success", data: { user } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName } = req.body;
    const userId = req.user.id;
    
    await sql.query(`UPDATE Users SET fullName = '${fullName}' WHERE id = ${userId}`);

    const result = await sql.query(`SELECT id, fullName, email, role FROM Users WHERE id = ${userId}`);
    
    res.status(200).json({ status: "success", data: { user: result.recordset[0] } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

module.exports = { 
  signup, 
  getAllUsers, 
  login, 
  protectRoutes, 
  getProfile,
  updateProfile 
};