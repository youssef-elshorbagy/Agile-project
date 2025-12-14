const express = require("express");
require("dotenv").config();
const path = require("path");
const cors = require("cors"); 
const bcrypt = require("bcryptjs");

const { connectToDB, sql } = require("./config/db");

const userRoutes = require("./routes/auth");
const courseRoutes = require("./routes/courses");
const advisorRoutes = require("./routes/advisors");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/users", userRoutes);
app.use("/courses", courseRoutes);
app.use("/advisors", advisorRoutes);

const PORT = 3000;

connectToDB().then(() => {
  createDefaultAdmin().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
});

async function createDefaultAdmin() {
  try {
    const adminEmail = "admin@eng.asu.edu.eg";
    
    const checkResult = await sql.query(`SELECT * FROM Users WHERE email = '${adminEmail}'`);
    
    if (checkResult.recordset.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      
      await sql.query(`
        INSERT INTO Users (universityId, fullName, email, password, role) 
        VALUES ('1', 'System Admin', '${adminEmail}', '${hashedPassword}', 'admin')
      `);
      
      console.log("✅ Default Admin Account Created: admin@eng.asu.edu.eg / admin123");
    } else {
      console.log("ℹ️ Admin account already exists.");
    }
  } catch (error) {
    console.error("❌ Error creating default admin:", error.message);
  }
}

module.exports = app;