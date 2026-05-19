#!/usr/bin/env node
/**
 * Datenbank-Export-Skript für TrackYourLift
 *
 * Erstellt zwei Dateien:
 *   1. db_export.sql  — vollständiges SQL-Dump (Import in jede SQLite-Datenbank)
 *   2. db_export.json — alle Tabellen als JSON (leicht lesbar, für Backups)
 *
 * Verwendung:
 *   node export_database.js
 *
 * Ergebnis-Dateien werden im Projekt-Root erstellt.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'workout.db');
const SQL_OUT = path.join(__dirname, 'db_export.sql');
const JSON_OUT = path.join(__dirname, 'db_export.json');

if (!fs.existsSync(DB_PATH)) {
  console.error('Fehler: workout.db nicht gefunden im Verzeichnis:', __dirname);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });

console.log('Öffne workout.db...');

// ─── Alle Tabellennamen holen ───────────────────────────────────────────────
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map(r => r.name);

console.log(`Gefundene Tabellen (${tables.length}): ${tables.join(', ')}`);

// ─── SQL-Export ─────────────────────────────────────────────────────────────
const sqlLines = [];
sqlLines.push('-- TrackYourLift Datenbank-Export');
sqlLines.push('-- Erstellt: ' + new Date().toISOString());
sqlLines.push('-- SQLite-Dump: kompatibel mit SQLite 3.x');
sqlLines.push('');
sqlLines.push('PRAGMA foreign_keys = OFF;');
sqlLines.push('BEGIN TRANSACTION;');
sqlLines.push('');

for (const tableName of tables) {
  // CREATE TABLE Statement holen
  const ddl = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName);

  if (ddl && ddl.sql) {
    sqlLines.push(`-- Tabelle: ${tableName}`);
    sqlLines.push('DROP TABLE IF EXISTS ' + tableName + ';');
    sqlLines.push(ddl.sql + ';');
    sqlLines.push('');
  }

  // Daten exportieren
  const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
  if (rows.length > 0) {
    sqlLines.push(`-- Daten für: ${tableName} (${rows.length} Zeilen)`);
    for (const row of rows) {
      const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
      const vals = Object.values(row).map(v => {
        if (v === null) return 'NULL';
        if (typeof v === 'number') return String(v);
        return "'" + String(v).replace(/'/g, "''") + "'";
      }).join(', ');
      sqlLines.push(`INSERT INTO "${tableName}" (${cols}) VALUES (${vals});`);
    }
    sqlLines.push('');
  }
}

sqlLines.push('COMMIT;');
sqlLines.push('PRAGMA foreign_keys = ON;');

fs.writeFileSync(SQL_OUT, sqlLines.join('\n'), 'utf-8');
console.log(`SQL-Export gespeichert: ${SQL_OUT}`);

// ─── JSON-Export ─────────────────────────────────────────────────────────────
const jsonExport = {
  exportedAt: new Date().toISOString(),
  source: DB_PATH,
  tables: {}
};

for (const tableName of tables) {
  const rows = db.prepare(`SELECT * FROM "${tableName}"`).all();
  jsonExport.tables[tableName] = {
    rowCount: rows.length,
    rows: rows
  };
}

fs.writeFileSync(JSON_OUT, JSON.stringify(jsonExport, null, 2), 'utf-8');
console.log(`JSON-Export gespeichert: ${JSON_OUT}`);

// ─── Zusammenfassung ─────────────────────────────────────────────────────────
console.log('\n─── Export-Zusammenfassung ───');
for (const tableName of tables) {
  const count = jsonExport.tables[tableName].rowCount;
  if (count > 0) {
    console.log(`  ${tableName.padEnd(30)} ${count} Zeilen`);
  }
}

console.log('\nFertig! Dateien:');
console.log('  ' + SQL_OUT);
console.log('  ' + JSON_OUT);
console.log('\nWiederherstellen mit:');
console.log('  node -e "require(\'better-sqlite3\')(\'neue.db\').exec(require(\'fs\').readFileSync(\'db_export.sql\',\'utf-8\'))"');

db.close();
