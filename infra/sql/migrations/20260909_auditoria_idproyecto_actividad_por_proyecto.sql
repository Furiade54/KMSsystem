-- =============================================================================================
-- MIGRACIÓN: Actividad por Proyecto (Fase 1 / MSSQL)
-- Objetivo:
--   1) Agregar columna desnormalizada dbo.Auditoria.IdProyecto (para filtrar rápido la pestaña
--      "Actividad" DENTRO DE UN PROYECTO, sin necesidad de 8 LEFT JOINs por TipoRecurso).
--   2) Backfill del histórico (234+ filas) mediante UPDATE por bloques de TipoRecurso.
--   3) Índice compuesto optimizado para el patrón de acceso típico:
--      WHERE IdOrganizacion = @orgId AND IdProyecto = @pid ORDER BY FechaCreacion DESC.
--
-- Ejecución segura (idempotente):
--   - Usa IF NOT EXISTS / COL_LENGTH para no fallar en reintentos.
--   - Todo dentro de transacción para que backfill + índice + columna sean atómicos.
--
-- Restricciones respetadas:
--   - NO hay FK declarada hacia Proyectos.Id por 2 motivos:
--     a) Eventos ORG-WIDE (USER / ORGANIZATION / PERMISO_RECURSO) mantienen IdProyecto=NULL.
--     b) Evita Error 1785 MSSQL (múltiples caminos CASCADE).
--   - Columna NULLABLE.
-- =============================================================================================
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;
BEGIN TRY

    -----------------------------------------------------------------------------------------
    -- 1) AGREGAR COLUMNA IdProyecto (si no existe)
    -----------------------------------------------------------------------------------------
    IF COL_LENGTH('dbo.Auditoria', 'IdProyecto') IS NULL
    BEGIN
        PRINT '[1/3] ADD COLUMNA Auditoria.IdProyecto UNIQUEIDENTIFIER NULL';
        ALTER TABLE dbo.Auditoria ADD IdProyecto UNIQUEIDENTIFIER NULL;
    END
    ELSE
    BEGIN
        PRINT '[1/3] SKIP: Columna Auditoria.IdProyecto ya existe.';
    END

    -----------------------------------------------------------------------------------------
    -- 2) BACKFILL histórico por bloques de TipoRecurso + JOIN al destino correspondiente
    -----------------------------------------------------------------------------------------
    PRINT '[2/3] BACKFILL Auditoria.IdProyecto';

    -- TipoRecurso = 'project' / 'PROJECT' -> IdRecurso es el Proyecto mismo
    UPDATE a
       SET a.IdProyecto = a.IdRecurso
      FROM dbo.Auditoria a
     WHERE a.IdProyecto IS NULL
       AND UPPER(ISNULL(a.TipoRecurso,'')) = 'PROJECT';
    PRINT '  -> project: ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

    -- TipoRecurso = 'file' / 'FILE' / 'ARCHIVO' -> Archivos.IdProyecto
    UPDATE a
       SET a.IdProyecto = f.IdProyecto
      FROM dbo.Auditoria a
      JOIN dbo.Archivos f ON f.Id = a.IdRecurso
     WHERE a.IdProyecto IS NULL
       AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('FILE','ARCHIVO'));
    PRINT '  -> file/archivo: ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

    -- TipoRecurso = 'folder' / 'FOLDER' / 'CARPETA' -> Carpetas.IdProyecto
    UPDATE a
       SET a.IdProyecto = c.IdProyecto
      FROM dbo.Auditoria a
      JOIN dbo.Carpetas c ON c.Id = a.IdRecurso
     WHERE a.IdProyecto IS NULL
       AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('FOLDER','CARPETA'));
    PRINT '  -> folder/carpeta: ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

    -- TipoRecurso = 'meeting' / 'MEETING' / 'REUNION' -> Reuniones.IdProyecto
    UPDATE a
       SET a.IdProyecto = r.IdProyecto
      FROM dbo.Auditoria a
      JOIN dbo.Reuniones r ON r.Id = a.IdRecurso
     WHERE a.IdProyecto IS NULL
       AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('MEETING','REUNION'));
    PRINT '  -> meeting/reunion: ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

    -- TipoRecurso = 'contribution' / 'CONTRIBUTION' / 'APORTE' -> AportesProyecto.IdProyecto
    UPDATE a
       SET a.IdProyecto = ap.IdProyecto
      FROM dbo.Auditoria a
      JOIN dbo.AportesProyecto ap ON ap.Id = a.IdRecurso
     WHERE a.IdProyecto IS NULL
       AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('CONTRIBUTION','APORTE'));
    PRINT '  -> contribution/aporte: ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

    -- TipoRecurso = 'topic' / 'TOPIC' / 'TEMA' -> TemasProyecto.IdProyecto
    UPDATE a
       SET a.IdProyecto = tp.IdProyecto
      FROM dbo.Auditoria a
      JOIN dbo.TemasProyecto tp ON tp.Id = a.IdRecurso
     WHERE a.IdProyecto IS NULL
       AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('TOPIC','TEMA'));
    PRINT '  -> topic/tema: ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

    -- TipoRecurso = 'topic_item' / 'TOPIC_ITEM' / 'TEMA_ITEM' -> TemasProyectoItems -> TemasProyecto.IdProyecto
    UPDATE a
       SET a.IdProyecto = tp.IdProyecto
      FROM dbo.Auditoria a
      JOIN dbo.TemasProyectoItems tpi ON tpi.Id = a.IdRecurso
      JOIN dbo.TemasProyecto tp ON tp.Id = tpi.IdTema
     WHERE a.IdProyecto IS NULL
       AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('TOPIC_ITEM','TEMA_ITEM'));
    PRINT '  -> topic_item/tema_item: ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

    -- TipoRecurso = 'version' / 'VERSION' -> VersionesArchivo -> Archivos.IdProyecto
    -- (hay 2 eventos de file.version.creada hoy).
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='VersionesArchivo')
    BEGIN
      UPDATE a
         SET a.IdProyecto = f.IdProyecto
        FROM dbo.Auditoria a
        JOIN dbo.VersionesArchivo v ON v.Id = a.IdRecurso
        JOIN dbo.Archivos f ON f.Id = v.IdArchivo
       WHERE a.IdProyecto IS NULL
         AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('VERSION'));
      PRINT '  -> version (via VersionesArchivo->Archivos): ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';
    END

    -- Fallback: TipoRecurso = 'COMMENT' / 'COMENTARIO' -> Comentarios es POLIMORFICO.
    -- Hacemos lo más común (TipoRecurso=comment AND comentario.target=FILE/FOLDER).
    -- El resto (USER/ORG/PERMISO_RECURSO) permanecen NULL como corresponde (no son de proyecto).
    IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME='Comentarios')
    BEGIN
      UPDATE a
         SET a.IdProyecto = f.IdProyecto
        FROM dbo.Auditoria a
        JOIN dbo.Comentarios c ON c.Id = a.IdRecurso AND UPPER(ISNULL(c.TipoRecurso,'')) IN ('FILE','ARCHIVO')
        JOIN dbo.Archivos f ON f.Id = c.IdRecurso
       WHERE a.IdProyecto IS NULL
         AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('COMMENT','COMENTARIO'));
      PRINT '  -> comment (target=FILE): ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

      UPDATE a
         SET a.IdProyecto = cf.IdProyecto
        FROM dbo.Auditoria a
        JOIN dbo.Comentarios c ON c.Id = a.IdRecurso AND UPPER(ISNULL(c.TipoRecurso,'')) IN ('FOLDER','CARPETA')
        JOIN dbo.Carpetas cf ON cf.Id = c.IdRecurso
       WHERE a.IdProyecto IS NULL
         AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('COMMENT','COMENTARIO'));
      PRINT '  -> comment (target=FOLDER): ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';

      UPDATE a
         SET a.IdProyecto = p.Id
        FROM dbo.Auditoria a
        JOIN dbo.Comentarios c ON c.Id = a.IdRecurso AND UPPER(ISNULL(c.TipoRecurso,'')) IN ('PROJECT','PROYECTO')
        JOIN dbo.Proyectos p ON p.Id = c.IdRecurso
       WHERE a.IdProyecto IS NULL
         AND (UPPER(ISNULL(a.TipoRecurso,'')) IN ('COMMENT','COMENTARIO'));
      PRINT '  -> comment (target=PROJECT): ' + CAST(@@ROWCOUNT AS VARCHAR(20)) + ' fila(s)';
    END

    PRINT '';
    PRINT '  BACKFILL FINALIZADO. Totales actuales Auditoria.IdProyecto:';
    SELECT
      CASE WHEN IdProyecto IS NULL THEN '(NULL - eventos Org-wide)' ELSE 'ASIGNADO' END AS [estado],
      COUNT(*) AS n
    FROM dbo.Auditoria
    GROUP BY CASE WHEN IdProyecto IS NULL THEN '(NULL - eventos Org-wide)' ELSE 'ASIGNADO' END;

    PRINT '';
    PRINT '  Distribución por TipoRecurso / IdProyecto ASIGNADO:';
    SELECT
      ISNULL(TipoRecurso,'(NULL TR)') TipoRecurso,
      SUM(CASE WHEN IdProyecto IS NOT NULL THEN 1 ELSE 0 END) n_con_proyecto,
      SUM(CASE WHEN IdProyecto IS NULL THEN 1 ELSE 0 END)     n_sin_proyecto
    FROM dbo.Auditoria
    GROUP BY TipoRecurso
    ORDER BY 2 DESC, 1;

    -----------------------------------------------------------------------------------------
    -- 3) ÍNDICE COMPUESTO OPTIMIZADO PARA PESTAÑA ACTIVIDAD POR PROYECTO
    -----------------------------------------------------------------------------------------
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes i
        WHERE i.object_id = OBJECT_ID('dbo.Auditoria')
          AND i.name = 'IX_Auditoria_IdOrganizacion_IdProyecto_Fecha'
    )
    BEGIN
        PRINT '';
        PRINT '[3/3] CREATE NONCLUSTERED INDEX IX_Auditoria_IdOrganizacion_IdProyecto_Fecha';
        CREATE NONCLUSTERED INDEX IX_Auditoria_IdOrganizacion_IdProyecto_Fecha
            ON dbo.Auditoria (IdOrganizacion ASC, IdProyecto ASC, FechaCreacion DESC);
    END
    ELSE
    BEGIN
        PRINT '';
        PRINT '[3/3] SKIP: Indice IX_Auditoria_IdOrganizacion_IdProyecto_Fecha ya existe.';
    END

    COMMIT TRANSACTION;
    PRINT '';
    PRINT '✅ MIGRACIÓN OK (Fase 1 MSSQL).';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    DECLARE @msg NVARCHAR(2048) = ERROR_MESSAGE();
    DECLARE @ln INT = ERROR_LINE();
    RAISERROR (N'❌ MIGRACIÓN FALLÓ. Línea %d: %s', 18, 1, @ln, @msg);
END CATCH
GO
