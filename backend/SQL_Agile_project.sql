/*USE UMS_DB;

-- 1. Users Table
CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    universityId NVARCHAR(50) UNIQUE NOT NULL,
    fullName NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL, -- 'student', 'teacher', 'admin'
    gpa FLOAT DEFAULT 0.0,
    level INT DEFAULT 1
);

-- 2. Courses Table
CREATE TABLE Courses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    code NVARCHAR(20) UNIQUE NOT NULL,
    creditHours INT NOT NULL,
    instructorId INT FOREIGN KEY REFERENCES Users(id)
);

-- 3. Enrollments (Linking Students to Courses)
CREATE TABLE Enrollments (
    studentId INT FOREIGN KEY REFERENCES Users(id),
    courseId INT FOREIGN KEY REFERENCES Courses(id),
    status NVARCHAR(20) DEFAULT 'pending', 
    PRIMARY KEY (studentId, courseId)
);

USE UMS_DB;

-- 4. Announcements Table
CREATE TABLE Announcements (
    id INT IDENTITY(1,1) PRIMARY KEY,
    courseId INT FOREIGN KEY REFERENCES Courses(id) ON DELETE CASCADE,
    teacherName NVARCHAR(100),
    content NVARCHAR(MAX),
    createdAt DATETIME DEFAULT GETDATE()
);

-- 5. Lectures Table (For PDF Uploads)
CREATE TABLE Lectures (
    id INT IDENTITY(1,1) PRIMARY KEY,
    courseId INT FOREIGN KEY REFERENCES Courses(id) ON DELETE CASCADE,
    title NVARCHAR(100),
    fileName NVARCHAR(255), -- Storing the file path/name
    filePath NVARCHAR(255),
    createdAt DATETIME DEFAULT GETDATE()
);
*/

USE UMS_DB;
GO

-- 1. Check All Users (Students, Teachers, Admins)
SELECT * FROM Users;

-- 2. Check All Courses created
SELECT * FROM Courses;

-- 3. Check Enrollments (Who is in which course & status)
SELECT * FROM Enrollments;

-- 4. Check Announcements posted by teachers
SELECT * FROM Announcements;

-- 5. Check Uploaded Lecture Files (PDFs)
SELECT * FROM Lectures;