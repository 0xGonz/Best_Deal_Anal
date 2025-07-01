import { Router } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireAuth } from '../utils/auth';

const router = Router();

/**
 * Database Export API
 * Provides complete database schema and data export for app cloning
 */

// Get complete database schema information
router.get('/schema', requireAuth, async (req, res) => {
  try {
    const schemaInfo = await db.execute(sql`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    const constraints = await db.execute(sql`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public'
    `);

    const indexes = await db.execute(sql`
      SELECT 
        indexname,
        tablename,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
    `);

    res.json({
      schema: schemaInfo.rows,
      constraints: constraints.rows,
      indexes: indexes.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Schema export error:', error);
    res.status(500).json({ error: 'Failed to export schema' });
  }
});

// Get complete data export for all tables
router.get('/data', requireAuth, async (req, res) => {
  try {
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const exportData: Record<string, any[]> = {};

    for (const table of tables.rows) {
      const tableName = (table as any).table_name;
      try {
        const data = await db.execute(sql.raw(`SELECT * FROM "${tableName}" ORDER BY id`));
        exportData[tableName] = data.rows;
      } catch (error) {
        console.warn(`Could not export table ${tableName}:`, error);
        exportData[tableName] = [];
      }
    }

    res.json({
      data: exportData,
      tables: tables.rows.map((t: any) => t.table_name),
      timestamp: new Date().toISOString(),
      recordCounts: Object.keys(exportData).reduce((acc, table) => {
        acc[table] = exportData[table].length;
        return acc;
      }, {} as Record<string, number>)
    });
  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Get specific table data
router.get('/table/:tableName', requireAuth, async (req, res) => {
  try {
    const { tableName } = req.params;
    
    // Validate table exists
    const tableExists = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ${tableName}
    `);

    if (tableExists.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const data = await db.execute(sql.raw(`SELECT * FROM "${tableName}" ORDER BY id`));
    
    res.json({
      tableName,
      data: data.rows,
      count: data.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Table export error for ${req.params.tableName}:`, error);
    res.status(500).json({ error: 'Failed to export table data' });
  }
});

// Generate SQL dump for complete database recreation
router.get('/sql-dump', requireAuth, async (req, res) => {
  try {
    const tables = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    let sqlDump = `-- Database Export for App Cloning\n-- Generated: ${new Date().toISOString()}\n\n`;

    // Add schema creation statements
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      // Get table structure
      const columns = await db.execute(sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
        ORDER BY ordinal_position
      `);

      sqlDump += `-- Table: ${tableName}\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
      
      const columnDefs = columns.rows.map(col => {
        let def = `  "${col.column_name}" ${col.data_type}`;
        if (col.character_maximum_length) {
          def += `(${col.character_maximum_length})`;
        }
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        return def;
      });

      sqlDump += columnDefs.join(',\n');
      sqlDump += '\n);\n\n';

      // Get data
      const data = await db.execute(sql.raw(`SELECT * FROM "${tableName}"`));
      
      if (data.rows.length > 0) {
        sqlDump += `-- Data for table: ${tableName}\n`;
        
        for (const row of data.rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            return val;
          });
          
          sqlDump += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += '\n';
      }
    }

    res.setHeader('Content-Type', 'text/sql');
    res.setHeader('Content-Disposition', 'attachment; filename="database-export.sql"');
    res.send(sqlDump);
  } catch (error) {
    console.error('SQL dump error:', error);
    res.status(500).json({ error: 'Failed to generate SQL dump' });
  }
});

// Get database statistics and overview
router.get('/overview', requireAuth, async (req, res) => {
  try {
    const tables = await db.execute(sql`
      SELECT 
        t.table_name,
        COALESCE(s.n_tup_ins, 0) as total_rows,
        pg_size_pretty(pg_total_relation_size(c.oid)) as size
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s ON t.table_name = s.relname
      LEFT JOIN pg_class c ON t.table_name = c.relname
      WHERE t.table_schema = 'public' 
      AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `);

    const totalSize = await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
    `);

    res.json({
      tables: tables.rows,
      totalTables: tables.rows.length,
      databaseSize: totalSize.rows[0]?.database_size || 'Unknown',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database overview error:', error);
    res.status(500).json({ error: 'Failed to get database overview' });
  }
});

export default router;