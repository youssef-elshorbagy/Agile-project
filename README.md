# UMS - University Management System

A full-stack web application for managing university courses, students, admissions, and teachers using the EAV (Entity-Attribute-Value) model for flexible data management.


______________________________________________________________________________________

# How to Run the Project

# 1. Prerequisites
Make sure you have these installed on your computer:
* Node.js (for the backend server)
* Microsoft SQL Server (Express or Developer edition)
* SQL Server Management Studio (SSMS) (to manage the database)

# 2. Setup the Backend
1- Open SQL Server Management Studio (SSMS) and connect to your local server instance.

2- Open the provided database script file (e.g., db_script.sql) in SSMS.

3- Run the script (Press F5 or click Execute) to create the UMS_DB database and all required tables.

4- Ensure the database UMS_DB is visible in the Object Explorer.
 
5.  Start the Server:

    npm start
    
    You should see: "Server running on port 3000".

# 3. Run the Frontend
1.  Go to your main folder.
2.  Simply double-click `login.html` to open it in your browser.

__________________________________________________________________________________________

# Login Credentials

Default Admin:
Email: `admin@eng.asu.edu.eg`
Password: `admin123`

# Note: When creating new users as an Admin, remember:
* Student Emails must end with: `@eng.asu.edu.eg`
* Passwords must start with a Capital Letter and be at least 8 characters.
* New students do not log in. Click "Apply for Admission" on the login page to submit documents.
