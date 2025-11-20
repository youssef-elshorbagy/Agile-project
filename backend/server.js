const express = require("express");
require("dotenv").config();
const path = require("path");
const connectDB = require("./config/db");
const userRoutes = require("./routes/auth");
const courseRoutes = require("./routes/courses");
const cors = require("cors"); 

// --- NEW IMPORTS FOR ADMIN SEEDING ---
const User = require("./models/user");
const bcrypt = require("bcryptjs");
// -------------------------------------

const app = express();
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// app.use("/uploads", express.static(path.join(__dirname, 'uploads'))); 

// --- UPDATE DATABASE CONNECTION ---
connectDB().then(() => {
  // Run the seed function only after DB connects
  createDefaultAdmin();
});

app.use(express.json());

app.use("/users", userRoutes);
app.use("/courses", courseRoutes);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// --- ADD THIS FUNCTION AT THE BOTTOM ---
async function createDefaultAdmin() {
  try {
    const adminEmail = "admin@edu.eg";
    
    // 1. Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      // 2. If not, create one
      const hashedPassword = await bcrypt.hash("admin123", 10);
      
      await User.create({
        fullName: "System Admin",
        email: adminEmail,
        password: hashedPassword,
        role: "admin" 
      });
      
      console.log("✅ Default Admin Account Created: admin@edu.eg / admin123");
    } else {
      console.log("ℹ️ Admin account already exists.");
    }
  } catch (error) {
    console.error("Error creating default admin:", error.message);
  }
}

module.exports = app;
// localhost:3000
// 3tGaNPBxzntR6te4
