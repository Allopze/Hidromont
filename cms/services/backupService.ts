import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config/unifiedConfig';

export class BackupService {
  constructor(
    private readonly db: Database.Database,
    private readonly backupDir: string = config.cms.backupDir
  ) {}

  /**
   * P3-08 (auditoría 2026-09): el respaldo copiaba también las sesiones
   * abiertas (quien tuviera el archivo podía entrar con ellas) y no rotaba
   * (59 archivos en la base local). Ahora se vacían `sessions` y
   * `login_attempts` en la copia y se conservan las `CMS_BACKUP_KEEP` más
   * recientes (20 por defecto).
   */
  async createBackup(): Promise<{ ok: boolean; file: string; timestamp: string }> {
    fs.mkdirSync(this.backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dest = path.join(this.backupDir, `hidromont-cms-${timestamp}.sqlite`);
    await (this.db as unknown as { backup(dest: string): Promise<void> }).backup(dest);
    const copia = new Database(dest);
    try {
      copia.exec('DELETE FROM sessions; DELETE FROM login_attempts; VACUUM;');
    } finally {
      copia.close();
    }
    this.rotar();
    return { ok: true, file: dest, timestamp: new Date().toISOString() };
  }

  private rotar(conservar = Number(process.env.CMS_BACKUP_KEEP) || 20): void {
    const sobrantes = this.listBackups().slice(conservar);
    for (const b of sobrantes) fs.rmSync(path.join(this.backupDir, b.file), { force: true });
  }

  /** Ruta de un respaldo por su nombre, o null si no es uno de los nuestros. */
  rutaDeRespaldo(nombre: string): string | null {
    if (!/^hidromont-cms-[0-9T-]+\.sqlite$/.test(nombre)) return null;
    const ruta = path.join(this.backupDir, nombre);
    return fs.existsSync(ruta) ? ruta : null;
  }

  listBackups(): Array<{ file: string; size: number; createdAt: string }> {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs
      .readdirSync(this.backupDir)
      .filter((name) => name.endsWith('.sqlite'))
      .map((name) => {
        const filePath = path.join(this.backupDir, name);
        const stat = fs.statSync(filePath);
        return { file: name, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
