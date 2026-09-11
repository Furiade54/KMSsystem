SET NOCOUNT ON;
GO

DECLARE @DbName sysname = N'$(DB_NAME)';
IF @DbName IS NULL OR LEN(@DbName) = 0
    SET @DbName = N'KMS';

DECLARE @Sql nvarchar(max);

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = @DbName)
BEGIN
    SET @Sql = N'CREATE DATABASE ' + QUOTENAME(@DbName) + N' COLLATE SQL_Latin1_General_CP1_CI_AS;';
    EXEC sp_executesql @Sql;
    PRINT 'Database ' + @DbName + ' created successfully.';
END
ELSE
BEGIN
    PRINT 'Database ' + @DbName + ' already exists.';
END
GO

DECLARE @DbName2 sysname = N'$(DB_NAME)';
IF @DbName2 IS NULL OR LEN(@DbName2) = 0
    SET @DbName2 = N'KMS';

DECLARE @RcsSql nvarchar(max) = N'ALTER DATABASE ' + QUOTENAME(@DbName2) + N' SET READ_COMMITTED_SNAPSHOT ON;';
EXEC sp_executesql @RcsSql;
GO
