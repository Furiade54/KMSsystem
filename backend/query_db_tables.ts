import { getDbPool } from './src/shared/db/pool';

(async () => {
  try {
    const pool = await getDbPool();

    const tablesRes = await pool.request().query(`
      SELECT
        TABLE_SCHEMA AS esquema,
        TABLE_NAME   AS tabla,
        TABLE_TYPE   AS tipo
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_SCHEMA, TABLE_NAME;
    `);

    console.log('\n==============================');
    console.log('  TABLAS EN LA BASE DE DATOS  ');
    console.log('==============================\n');
    tablesRes.recordset.forEach((row: any) => {
      console.log(`  [${row.esquema}] ${row.tabla}`);
    });
    console.log(`\nTotal: ${tablesRes.recordset.length} tablas\n`);

    for (const row of tablesRes.recordset as any[]) {
      const cols = await pool.request().query(`
        SELECT
          ORDINAL_POSITION        AS pos,
          COLUMN_NAME             AS columna,
          DATA_TYPE               AS tipo,
          CHARACTER_MAXIMUM_LENGTH AS longitud,
          IS_NULLABLE             AS admite_nulo,
          COLUMN_DEFAULT          AS valor_defecto
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @p1 AND TABLE_NAME = @p2
        ORDER BY ORDINAL_POSITION;
      `, {
        p1: row.esquema,
        p2: row.tabla,
      } as any);

      // mssql no acepta objetos como input; repetimos usando input():
      const colReq = pool.request();
      colReq.input('p1', row.esquema);
      colReq.input('p2', row.tabla);
      const colRes = await colReq.query(`
        SELECT
          ORDINAL_POSITION        AS pos,
          COLUMN_NAME             AS columna,
          DATA_TYPE               AS tipo,
          CHARACTER_MAXIMUM_LENGTH AS longitud,
          IS_NULLABLE             AS admite_nulo,
          COLUMN_DEFAULT          AS valor_defecto
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @p1 AND TABLE_NAME = @p2
        ORDER BY ORDINAL_POSITION;
      `);

      console.log(`\n--- [${row.esquema}].${row.tabla} ---`);
      colRes.recordset.forEach((c: any) => {
        const len = c.longitud != null ? `(${c.longitud === -1 ? 'MAX' : c.longitud})` : '';
        const nul = c.admite_nulo === 'YES' ? 'NULL' : 'NOT NULL';
        const def = c.valor_defecto != null ? `  DEFAULT ${c.valor_defecto.trim()}` : '';
        console.log(`  ${String(c.pos).padStart(2)}. ${c.columna.padEnd(25)} ${c.tipo}${len.padEnd(10)} ${nul}${def}`);
      });

      // Conteo rápido de filas (estimado)
      const countReq = pool.request();
      countReq.input('t', row.tabla);
      const countRes = await countReq.query(`
        SELECT SUM(p.rows) AS filas
        FROM sys.tables t
        INNER JOIN sys.indexes i ON t.OBJECT_ID = i.object_id
        INNER JOIN sys.partitions p ON i.object_id = p.OBJECT_ID AND i.index_id = p.index_id
        WHERE t.name = @t AND i.index_id <= 1
        GROUP BY t.name;
      `);
      const n = (countRes.recordset?.[0] as any)?.filas ?? 0;
      console.log(`  → ~${Number(n).toLocaleString()} filas`);
    }

    await pool.close();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR:', err?.message ?? err);
    process.exit(1);
  }
})();
