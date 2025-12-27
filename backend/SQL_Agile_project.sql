/*

USE UMS_DB;
GO

-- =============================================
-- 1. PEOPLE & ROLES (EAV)
-- =============================================

CREATE TABLE People (
    id INT IDENTITY(1,1) PRIMARY KEY,
    universityId NVARCHAR(50) UNIQUE NOT NULL,
    fullName NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    createdAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE Roles (
    role_id INT IDENTITY(1,1) PRIMARY KEY,
    role_name NVARCHAR(20) UNIQUE NOT NULL,
    description NVARCHAR(255) DEFAULT '' 
);

CREATE TABLE PersonRoles (
    person_id INT FOREIGN KEY REFERENCES People(id) ON DELETE CASCADE,
    role_id INT FOREIGN KEY REFERENCES Roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (person_id, role_id)
);

CREATE TABLE PersonAttributes (
    attr_id INT IDENTITY(1,1) PRIMARY KEY,
    attributeName NVARCHAR(50) UNIQUE NOT NULL,
    dataType NVARCHAR(20) DEFAULT 'string'
);

CREATE TABLE PersonAttributeValues (
    value_id INT IDENTITY(1,1) PRIMARY KEY,
    person_id INT FOREIGN KEY REFERENCES People(id) ON DELETE CASCADE,
    attr_id INT FOREIGN KEY REFERENCES PersonAttributes(attr_id) ON DELETE CASCADE,
    attr_value NVARCHAR(MAX) DEFAULT '' 
);

-- =============================================
-- 2. COURSES (EAV)
-- =============================================

CREATE TABLE Courses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    code NVARCHAR(20) UNIQUE NOT NULL,
    instructorId INT FOREIGN KEY REFERENCES People(id)
);

CREATE TABLE CourseAttributes (
    attr_id INT IDENTITY(1,1) PRIMARY KEY,
    attributeName NVARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE CourseAttributeValues (
    value_id INT IDENTITY(1,1) PRIMARY KEY,
    course_id INT FOREIGN KEY REFERENCES Courses(id) ON DELETE CASCADE,
    attr_id INT FOREIGN KEY REFERENCES CourseAttributes(attr_id) ON DELETE CASCADE,
    attr_value NVARCHAR(MAX) DEFAULT '' 
);

CREATE TABLE Enrollments (
    EnrollmentID INT IDENTITY(1,1) PRIMARY KEY,
    studentId INT FOREIGN KEY REFERENCES People(id),
    courseId INT FOREIGN KEY REFERENCES Courses(id),
    status NVARCHAR(20) DEFAULT 'pending',
    enrolledAt DATETIME DEFAULT GETDATE(),
    UNIQUE(studentId, courseId)
);

-- =============================================
-- 4. UNIFIED UPLOADS (EAV)
-- =============================================
-- This table replaces Lectures, Assignments, and Submissions

CREATE TABLE Uploads (
    id INT IDENTITY(1,1) PRIMARY KEY,
    courseId INT NULL FOREIGN KEY REFERENCES Courses(id) ON DELETE CASCADE DEFAULT '',
    uploaderId INT FOREIGN KEY REFERENCES People(id),
    uploadType NVARCHAR(20) NOT NULL, 
    title NVARCHAR(255) DEFAULT 'Untitled',
    fileName NVARCHAR(255) DEFAULT 'Untitled',
    filePath NVARCHAR(255) DEFAULT './Untitled',
    createdAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE UploadAttributes (
    attr_id INT IDENTITY(1,1) PRIMARY KEY,
    attributeName NVARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE UploadAttributeValues (
    upload_id INT FOREIGN KEY REFERENCES Uploads(id) ON DELETE CASCADE,
    attr_id INT FOREIGN KEY REFERENCES UploadAttributes(attr_id) ON DELETE CASCADE,
    attr_value NVARCHAR(MAX) DEFAULT '',
    PRIMARY KEY (upload_id, attr_id)
);

-- =============================================
-- 5. COMMUNICATION & LINKS
-- =============================================

CREATE TABLE Announcements (
    id INT IDENTITY(1,1) PRIMARY KEY,
    courseId INT NULL FOREIGN KEY REFERENCES Courses(id),
    teacherName NVARCHAR(100) DEFAULT 'Instructor',
    content NVARCHAR(MAX) DEFAULT '',
    isGlobal BIT DEFAULT 0,
    createdAt DATETIME DEFAULT GETDATE()
);

CREATE TABLE parent_student (
    id INT IDENTITY(1,1) PRIMARY KEY,
    parent_id INT FOREIGN KEY REFERENCES People(id),
    student_id INT FOREIGN KEY REFERENCES People(id),
    UNIQUE(parent_id, student_id)
);

CREATE TABLE Messages (
    id INT IDENTITY(1,1) PRIMARY KEY,
    senderId INT FOREIGN KEY REFERENCES People(id),
    receiverId INT FOREIGN KEY REFERENCES People(id),
    message NVARCHAR(MAX) DEFAULT '',
    isRead BIT DEFAULT 0,
    createdAt DATETIME DEFAULT GETDATE()
);
GO


CREATE TRIGGER trg_EnforceAdvisorDependency
ON PersonRoles
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT i.person_id FROM inserted i
        JOIN Roles r ON i.role_id = r.role_id
        WHERE r.role_name = 'Advisor'
        AND NOT EXISTS (
            SELECT 1 FROM PersonRoles pr
            JOIN Roles r2 ON pr.role_id = r2.role_id
            WHERE pr.person_id = i.person_id AND r2.role_name = 'Teacher'
        )
    )
    BEGIN
        RAISERROR ('Dependency Error: User must be a Teacher to be an Advisor.', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

-- Roles
INSERT INTO Roles (role_name) VALUES ('Student'), ('Teacher'), ('Advisor'), ('Admin'), ('Parent');
INSERT INTO Roles (role_name, description) VALUES ('NewComer', 'Applicant waiting for admission approval');

-- People Attributes
INSERT INTO PersonAttributes (attributeName, dataType) VALUES 
('GPA', 'number'), ('Level', 'number'), ('OfficeHours', 'string');

INSERT INTO PersonAttributes (attributeName, dataType) VALUES ('NationalID', 'string');

-- Upload Attributes (Handling Assignment & Submission specific data)
INSERT INTO UploadAttributes (attributeName) VALUES 
('Deadline'),        -- For assignments
('MaxScore'),        -- For assignments
('Grade'),           -- For student submissions
('Feedback'),        -- For student submissions
('ReferenceId');     -- To link a submission back to an assignment ID

INSERT INTO CourseAttributes (attributeName) VALUES 
('CreditHours'), 
('Level'),        -- The year/level (e.g., 1, 2, 3)
('Prerequisite'); -- Stores the ID of the required course
GO


*/





USE UMS_DB;
GO
-- ==========================================================
-- 1. IDENTITY & ROLES
-- ==========================================================
SELECT * FROM People;
SELECT * FROM Roles;
SELECT * FROM PersonRoles;

-- ==========================================================
-- 2. PERSON EAV (GPA, Level, etc.)
-- ==========================================================
SELECT * FROM PersonAttributes;
SELECT * FROM PersonAttributeValues;

-- ==========================================================
-- 3. COURSE EAV (New Structure)
-- ==========================================================
-- The main course list (Name, Code, Instructor)
SELECT * FROM Courses;

-- The dictionary of course attributes (CreditHours, Level, Prerequisite)
SELECT * FROM CourseAttributes;

-- The actual values linked to courses (e.g., Course 50 -> CreditHours = 3)
SELECT * FROM CourseAttributeValues;

-- ==========================================================
-- 4. UPLOAD EAV (Assignments, Lectures, Submissions)
-- ==========================================================
SELECT * FROM Uploads;
SELECT * FROM UploadAttributes;
SELECT * FROM UploadAttributeValues;

-- ==========================================================
-- 5. ACADEMIC & RELATIONSHIPS
-- ==========================================================
SELECT * FROM Enrollments;
SELECT * FROM parent_student;
SELECT * FROM Announcements;
SELECT * FROM Messages;
GO