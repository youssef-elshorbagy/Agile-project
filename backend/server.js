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

async function createDefaultAdmin() {
    try {
        const adminEmail = "admin@eng.asu.edu.eg";
        const request = new sql.Request();
        request.input("email", sql.NVarChar, adminEmail);

        // 1. Check if person exists in the People table
        const checkResult = await request.query(`SELECT * FROM People WHERE email = @email`);

        if (checkResult.recordset.length === 0) {
            const hashedPassword = await bcrypt.hash("admin123", 10);
            
            // Start a transaction to ensure all EAV parts are created together
            const transaction = new sql.Transaction();
            await transaction.begin();

            try {
                // 2. Insert into People table
                const insertPerson = new sql.Request(transaction);
                insertPerson.input("universityId", sql.NVarChar, "1");
                insertPerson.input("fullName", sql.NVarChar, "System Admin");
                insertPerson.input("email", sql.NVarChar, adminEmail);
                insertPerson.input("password", sql.NVarChar, hashedPassword);

                const personRes = await insertPerson.query(`
                    INSERT INTO People (universityId, fullName, email, password)
                    OUTPUT INSERTED.id
                    VALUES (@universityId, @fullName, @email, @password)
                `);
                
                const personId = personRes.recordset[0].id;

                // 3. Assign 'Admin' Role in PersonRoles
                const insertRole = new sql.Request(transaction);
                insertRole.input("pid", sql.Int, personId);
                await insertRole.query(`
                    INSERT INTO PersonRoles (person_id, role_id)
                    SELECT @pid, role_id FROM Roles WHERE role_name = 'Admin'
                `);

                await transaction.commit();
                console.log("✅ Default Admin Created in EAV: admin@eng.asu.edu.eg / admin123");
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } else {
            console.log("ℹ Admin account already exists.");
        }
    } catch (error) {
        console.error("❌ Error creating default admin:", error);
    }
}

module.exports = app;