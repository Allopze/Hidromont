import { getDb } from '../db/connection';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';
import { BackupService } from '../services/backupService';
import {
  auditedValueRules,
  findAuditedMatches,
  type AuditedFieldRow,
} from '../content/auditedMigration';

async function main() {
  const mode = process.argv.includes('--apply')
    ? 'apply'
    : process.argv.includes('--check')
      ? 'check'
      : '';
  if (!mode) throw new Error('Use --check o --apply.');

  migrate();
  const db = getDb();
  const repository = new ContentRepository(db);
  const rows: AuditedFieldRow[] = [];

  for (const rule of auditedValueRules) {
    const entry = repository.findEntry(rule.entryId);
    const field = entry?.fields[rule.key];
    if (field) rows.push({ entryId: rule.entryId, key: rule.key, value: field.value });
  }

  const matches = findAuditedMatches(rows, auditedValueRules);
  process.stdout.write(
    `${matches.length} valor(es) antiguo(s) auditado(s) encontrado(s).\n${matches
      .map((match) => `- ${match.entryId}.${match.key}`)
      .join('\n')}\n`
  );

  if (mode === 'check' || matches.length === 0) return;

  const backup = await new BackupService(db).createBackup();
  process.stdout.write(`Backup creado: ${backup.file}\n`);

  for (const match of matches) {
    repository.updateField(match.entryId, match.key, match.nextValue, new Date().toISOString());
  }
  process.stdout.write(`Migración aplicada: ${matches.length} valor(es) actualizado(s).\n`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
