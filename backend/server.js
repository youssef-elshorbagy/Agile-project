const express = require("express");
require("dotenv").config();
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const { connectToDB, sql } = require("./config/db");

// Import Route Handlers
const userRoutes = require("./routes/auth");
const courseRoutes = require("./routes/courses");
const announcementRoutes = require("./routes/announcement");
const messageRoutes = require("./routes/message");
// Ensure this file exists and exports correctly too
const parentRoutes = require('./routes/parent'); 

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes - Using the variables imported above
app.use("/users", userRoutes);
app.use("/courses", courseRoutes);
app.use("/messages", messageRoutes);
app.use("/announcements", announcementRoutes); // This was Line 30
app.use('/parent', parentRoutes);

// Default port
const PORT = process.env.PORT || 3000;

// Start server AFTER DB connects
connectToDB().then(async () => {
    console.log("📡 Connected to SQL Server");
    await createDefaultAdmin();
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
}).catch((err) => {
    console.error("❌ Failed to connect to DB:", err);
});

// Create initial admin if not found
async function createDefaultAdmin() {
    try {
        const adminEmail = "admin@eng.asu.edu.eg";
        const request = new sql.Request();
        request.input("email", sql.VarChar, adminEmail);

        const checkResult = await request.query(`SELECT * FROM Users WHERE email = @email`);

        if (checkResult.recordset.length === 0) {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            const insertRequest = new sql.Request();
            insertRequest.input("universityId", sql.VarChar, "1");
            insertRequest.input("fullName", sql.VarChar, "System Admin");
            insertRequest.input("email", sql.VarChar, adminEmail);
            insertRequest.input("password", sql.VarChar, hashedPassword);
            insertRequest.input("role", sql.VarChar, "admin");

            await insertRequest.query(`
                INSERT INTO Users (universityId, fullName, email, password, role)
                VALUES (@universityId, @fullName, @email, @password, @role)
            `);
            console.log("✅ Default Admin Created: admin@eng.asu.edu.eg / admin123");
        } else {
            console.log("ℹ Admin account already exists.");
        }
    } catch (error) {
        console.error("❌ Error creating default admin:", error);
    }
}

module.exports = app;