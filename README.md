# UMS - University Management System

A full-stack web application for managing university courses, students, and teachers.


______________________________________________________________________________________

# How to Run the Project

# 1. Prerequisites
Make sure you have these installed on your computer:
* [Node.js](https://nodejs.org/)
* [MongoDB Compass](https://www.mongodb.com/products/tools/compass) (to view your database)

# 2. Setup the Backend
1.  Open your terminal/command prompt.
2.  Navigate to the backend folder:

    cd backend
    
3.  Install the dependencies:
    
    npm install
    
4.  Create the Database Configuration:
    Create a file named `.env` inside the backend folder and add this:

    MONGO_URI=mongodb+srv://Agile-project:3tGaNPBxzntR6te4@cluster0.c7z4p.mongodb.net/
    db_Name=productivity_app
    JWT_SECRET=ed492b4d07d4fddce26a131f9566394bfa31acda8d35b49963cc7c4a1fb4dad22899e39739c1ab54b5695277fdb133943a0e9ef328048f7759795c0fb29524dd
    JWT_EXPIRES_IN=7d
    PORT=3000
    NODE_ENV=development

    
5.  Start the Server:

    npm start
    
    You should see: "Server running on port 3000" and "MongoDB Connected".

# 3. Run the Frontend
1.  Go to your main folder.
2.  Simply double-click `login.html` to open it in your browser.

__________________________________________________________________________________________

# Login Credentials

Default Admin:
Email: `admin@edu.eg`
Password: `admin123`

# Note: When creating new users as an Admin, remember:
Student Emails must end with: `@eng.asu.edu.eg`
Passwords must start with a Capital Letter and be at least 8 characters.
