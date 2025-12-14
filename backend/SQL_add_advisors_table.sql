-- Create Advisors table to mark which users are advisors
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.Advisors') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.Advisors (
        userId INT PRIMARY KEY CONSTRAINT FK_Advisors_Users REFERENCES dbo.Users(id),
        capacity INT NULL
    );
END
GO
