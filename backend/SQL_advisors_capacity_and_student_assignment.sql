USE UMS_DB;
GO

-- Add capacity column to Advisors table if missing
IF EXISTS (SELECT * FROM sysobjects WHERE name='Advisors' AND xtype='U')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE Name = N'capacity' AND Object_ID = Object_ID(N'Advisors'))
    BEGIN
        ALTER TABLE Advisors ADD capacity INT DEFAULT 100;
    END
END
ELSE
BEGIN
    CREATE TABLE Advisors (
        userId INT PRIMARY KEY FOREIGN KEY REFERENCES Users(id),
        capacity INT DEFAULT 100
    );
END

-- Create mapping table for student -> advisor assignments
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='StudentAdvisors' AND xtype='U')
BEGIN
    CREATE TABLE StudentAdvisors (
        studentId INT PRIMARY KEY FOREIGN KEY REFERENCES Users(id),
        advisorId INT FOREIGN KEY REFERENCES Advisors(userId),
        assignedAt DATETIME DEFAULT GETDATE()
    );
END

GO

-- NOTE: Run this script against your database to add capacity and student-advisor mapping.
