const express = require("express");
require("dotenv").config();
const path = require("path");
const cors = require("cors"); 
const bcrypt = require("bcryptjs");

const { connectToDB, sql } = require("./config/db");

const userRoutes = require("./routes/auth");
const courseRoutes = require("./routes/courses");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/users", userRoutes);
app.use("/courses", courseRoutes);

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
    
    const checkResult = await sql.query(`SELECT * FROM People WHERE email = '${adminEmail}'`);
    
    if (checkResult.recordset.length === 0) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      
      const transaction = new sql.Transaction();
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);

        const personResult = await request.query(`
            INSERT INTO People (universityId, fullName, email, password) 
            OUTPUT INSERTED.person_id
            VALUES ('ADMIN-001', 'System Admin', '${adminEmail}', '${hashedPassword}')
        `);
        
        const newPersonId = personResult.recordset[0].person_id;

        const roleResult = await request.query(`SELECT role_id FROM Roles WHERE role_name = 'Admin'`);
        
        if (roleResult.recordset.length === 0) {
            throw new Error("Admin role does not exist in Roles table! Please run database seeds.");
        }
        
        const adminRoleId = roleResult.recordset[0].role_id;

        await request.query(`
            INSERT INTO PersonRoles (person_id, role_id)
            VALUES (${newPersonId}, ${adminRoleId})
        `);

        await transaction.commit();
        console.log("✅ Default Admin Account Created: admin@eng.asu.edu.eg / admin123");

      } catch (tranError) {
        await transaction.rollback();
        throw tranError; 
      }

    } else {
      console.log("ℹ️ Admin account already exists.");
    }
  } catch (error) {
    console.error("❌ Error creating default admin:", error.message);
  }
}

module.exports = app;