-- Ramp Trainee Tracker schema. Run once in the Azure SQL query editor.

CREATE TABLE dbo.Employees (
    EmployeeId   VARCHAR(20)   NOT NULL PRIMARY KEY,
    FirstName    NVARCHAR(60)  NOT NULL,
    LastName     NVARCHAR(60)  NOT NULL,
    Active       BIT           NOT NULL DEFAULT 1,
    CreatedBy    NVARCHAR(200) NULL,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- One row per task completed. A single form submission shares one EntryGroupId.
CREATE TABLE dbo.TaskLog (
    Id           INT IDENTITY(1,1) PRIMARY KEY,
    EntryGroupId UNIQUEIDENTIFIER NOT NULL,
    LogDate      DATE          NOT NULL,
    EmployeeId   VARCHAR(20)   NOT NULL REFERENCES dbo.Employees(EmployeeId),
    TaskCode     VARCHAR(40)   NOT NULL,   -- task list lives in api/src/taskList.js
    Phase        CHAR(3)       NOT NULL CHECK (Phase IN ('IN','OUT')),
    Week         TINYINT       NOT NULL CHECK (Week IN (1,2)),
    Gate         NVARCHAR(10)  NOT NULL,
    Flight       NVARCHAR(10)  NULL,
    Tail         NVARCHAR(12)  NULL,
    Notes        NVARCHAR(500) NULL,
    TrainerEmail NVARCHAR(200) NOT NULL,
    TrainerName  NVARCHAR(120) NOT NULL,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_TaskLog_Employee ON dbo.TaskLog(EmployeeId, TaskCode);
CREATE INDEX IX_TaskLog_Date     ON dbo.TaskLog(LogDate DESC);
CREATE INDEX IX_TaskLog_Trainer  ON dbo.TaskLog(TrainerEmail, LogDate);
