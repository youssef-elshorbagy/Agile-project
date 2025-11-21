const User = require("../models/user");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const signup = async (req, res) => {
  try {
    let { password, fullName, email, role, universityId, gpa, level } = req.body;

    if (password.length < 8) return res.status(400).json({ status: "fail", message: "Password must be at least 8 characters" });
    if (!/^[A-Z]/.test(password)) return res.status(400).json({ status: "fail", message: "Password must start with a Capital Letter" });
    if (!role || (role !== "student" && role !== "teacher" && role !== "admin")) return res.status(400).json({ status: "fail", message: "Invalid Role" });

    const existingUser = await User.findOne({ email: email });
    if (existingUser) return res.status(400).json({ status: "fail", message: "Email already exists" });
    
    const existingId = await User.findOne({ universityId: universityId });
    if (existingId) return res.status(400).json({ status: "fail", message: "University ID already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = { 
      fullName, 
      email, 
      password: hashedPassword, 
      role,
      universityId,
      gpa,
      level 
    };

   
    if (role === 'student') {
        userData.gpa = 0.00;
        userData.level = 1;
    }

    const user = await User.create(userData);

    const token = jwt.sign(
      { id: user._id, name: fullName, role: role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({ status: "success", token: token, data: { user: user } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res
      .status(400)
      .json({ status: "fail", message: "Email or Password is missing" });
  }

  const existingUser = await User.findOne({ email: email });
  if (!existingUser) {
    return res.status(404).json({
      status: "fail",
      message: "User not exists",
    });
  }

  const matchedPassword = await bcrypt.compare(password, existingUser.password);
  if (!matchedPassword) {
    return res.status(404).json({
      status: "fail",
      message: "User not exists",
    });
  }
  
  const token = jwt.sign(
    { id: existingUser._id, name: existingUser.fullName }, 
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
  
  return res.status(200).json({
    status: "success",
    token: token,
    data: { user: { fullName: existingUser.fullName, universityId: existingUser.universityId, email, role: existingUser.role, gpa: existingUser.gpa, level: existingUser.level } },
  });
};

const protectRoutes = async (req, res, next) => {
  try {
    let token = req.headers.authorization;
    if (token && token.startsWith("Bearer")) {
      token = token.split(" ")[1];
    }
    if (!token) {
      return res
        .status(400)
        .json({ status: "fail", message: "You are not logged in" });
    }
    
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decodedToken.id;
    
    const currentUser = await User.findById(decodedToken.id);
    if (!currentUser) {
      return res.status(401).json({
        status: "fail",
        message: "User no longer exists"
      });
    }
    
    req.user = currentUser;
    next();
  } catch (error) {
    res.status(401).json({ status: "fail", message: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 5;
    const skip = (page - 1) * limit;
    const users = await User.find({}, { password: false, __v: false }).skip(skip).limit(limit);
    res
      .status(200)
      .json({ status: "success", length: users.length, data: { users } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId, { password: false, __v: false });
    res.status(200).json({ status: "success", data: { user: user } });
  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName } = req.body;
    
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { fullName }, 
      { new: true, runValidators: true }
    );

    res.status(200).json({ status: "success", data: { user: updatedUser } });
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