import { getDbPool } from './src/shared/db/pool';

(async () => {
  try {
    const pool = await getDbPool();

    const tablesRes = await pool.request().query(`
      SELECT TABLE_SCHEMA AS esquema, TABLE_NAME AS tabla
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME;
    `);

    for (const row of tablesRes.recordset as any[]) {
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

      console.log(`\n============================================================`);
      console.log(`  [dbo].[${row.tabla}] — ~${Number(n).toLocaleString()} fila(s)`);
      console.log(`============================================================`);
      colRes.recordset.forEach((c: any) => {
        const len = c.longitud != null
          ? `(${c.longitud === -1 ? 'MAX' : c.longitud})`
          : '';
        const nul = c.admite_nulo === 'YES' ? 'NULL' : 'NOT NULL';
        const def = c.valor_defecto != null
          ? `  DEFAULT ${String(c.valor_defecto).trim()}`
          : '';
        const pos = String(c.pos).padStart(2);
        console.log(`  ${pos}. ${c.columna.padEnd(28)} ${String(c.tipo).padEnd(14)}${len.padEnd(11)} ${nul}${def}`);
      });
    }

    await pool.close();
    process.exit(0);
  } catch (err: any) {
    console.error('ERROR:', err?.message ?? err);
    process.exit(1);
  }
})();
