import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config/unifiedConfig';

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(path.dirname(config.cms.databasePath), { recursive: true });
  db = new Database(config.cms.databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
