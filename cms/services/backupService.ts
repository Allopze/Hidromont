import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { config } from '../config/unifiedConfig';

const backupDir = path.join(config.rootDir, 'cms', 'data', 'backups');

export class BackupService {
  constructor(private readonly db: Database.Database) {}

  async createBackup(): Promise<{ ok: boolean; file: string; timestamp: string }> {
    fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(backupDir, `hidromont-cms-${timestamp}.sqlite`);
    await (this.db as unknown as { backup(dest: string): Promise<void> }).backup(dest);
    return { ok: true, file: dest, timestamp: new Date().toISOString() };
  }

  listBackups(): Array<{ file: string; size: number; createdAt: string }> {
    if (!fs.existsSync(backupDir)) return [];
    return fs
      .readdirSync(backupDir)
      .filter((name) => name.endsWith('.sqlite'))
      .map((name) => {
        const filePath = path.join(backupDir, name);
        const stat = fs.statSync(filePath);
        return { file: name, size: stat.size, createdAt: stat.birthtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
