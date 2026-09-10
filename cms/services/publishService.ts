import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config/unifiedConfig';
import type { PublishJobRepository } from '../repositories/PublishJobRepository';
import type { PublishJob } from '../types/cms';
import { refreshPublicSecurityHeaders } from '../security/headers';
import type { ExportService, RevertedEntry, SkippedEntry } from './exportService';

type Exported = {
  files: string[];
  removed: string[];
  skipped: SkippedEntry[];
  revertedToFallback: RevertedEntry[];
};

const execFileAsync = promisify(execFile);

/**
 * A-7/A-9: las omisiones y las reversiones al texto por defecto entran en el
 * log del job igual que las eliminaciones, para que queden en el historial y
 * no solo en el stderr del servidor.
 */
function noticeLines(exported: Exported): string[] {
  return [
    ...exported.skipped.map((e) => `⚠ omitida: ${e.kind} "${e.slug}" (${e.id}) — ${e.reason}`),
    ...exported.revertedToFallback.map(
      (e) => `⚠ vuelve al texto por defecto: ${e.id} («${e.title}»)`
    ),
  ];
}

interface ExecFailure extends Error {
  stdout?: string;
  stderr?: string;
}

export class PublishService {
  // CMS-5: exportContent/exportContentWithGallery/publishContent all read the
  // DB and write the same shared files (src/data/cms-content.json,
  // src/content/*/*.md, src/data/gallery.json), and publishContent additionally
  // shells out to `npm run build`/`check` against the same working tree. Two
  // of these running concurrently (a double-click, or two admins) would race
  // on those writes and could interleave two builds in the same cwd. A single
  // in-process boolean is enough here — this is one Node process per server,
  // not a multi-instance deployment — and rejecting outright (not queueing) is
  // simpler and gives the caller an immediate, actionable error.
  private busy = false;

  private acquireLock(): void {
    if (this.busy) {
      throw new Error(
        'Ya hay una exportación o publicación en curso. Intente de nuevo en unos segundos.'
      );
    }
    this.busy = true;
  }

  constructor(
    private readonly exportService: ExportService,
    private readonly publishJobRepository: PublishJobRepository
  ) {}

  async exportContent(): Promise<{
    job: PublishJob;
    exported: Exported;
    galleryExported?: { file: string; count: number };
  }> {
    this.acquireLock();
    try {
      const startedAt = new Date().toISOString();
      const job = this.publishJobRepository.start({
        action: 'export',
        now: startedAt,
        logs: [`${startedAt} export started`],
      });

      try {
        const exported = await this.exportService.exportContent();
        const completedAt = new Date().toISOString();
        const completed = this.publishJobRepository.finish({
          id: job.id,
          status: 'succeeded',
          now: completedAt,
          logs: [
            ...job.logs,
            `${completedAt} exported ${exported.files.length} file(s)`,
            ...exported.files.map((file) => `file: ${file}`),
            ...exported.removed.map((file) => `removed (renamed/unpublished/deleted): ${file}`),
            ...noticeLines(exported),
          ],
        });
        return { job: completed, exported };
      } catch (error) {
        this.failJob(job, error);
        throw error;
      }
    } finally {
      this.busy = false;
    }
  }

  async exportContentWithGallery(): Promise<{
    job: PublishJob;
    exported: Exported;
    galleryExported: { file: string; count: number };
  }> {
    this.acquireLock();
    try {
      const startedAt = new Date().toISOString();
      const job = this.publishJobRepository.start({
        action: 'export',
        now: startedAt,
        logs: [`${startedAt} export started (content + gallery)`],
      });

      try {
        const exported = await this.exportService.exportContent();
        const galleryExported = await this.exportService.exportGallery();
        const completedAt = new Date().toISOString();
        const completed = this.publishJobRepository.finish({
          id: job.id,
          status: 'succeeded',
          now: completedAt,
          logs: [
            ...job.logs,
            `${completedAt} exported ${exported.files.length} file(s)`,
            ...exported.files.map((file) => `file: ${file}`),
            ...exported.removed.map((file) => `removed (renamed/unpublished/deleted): ${file}`),
            ...noticeLines(exported),
            `gallery: ${galleryExported.count} items → ${galleryExported.file}`,
          ],
        });
        return { job: completed, exported, galleryExported };
      } catch (error) {
        this.failJob(job, error);
        throw error;
      }
    } finally {
      this.busy = false;
    }
  }

  async publishContent(): Promise<{
    job: PublishJob;
    exported: Exported;
    galleryExported: { file: string; count: number };
    publish: { stdout: string; stderr: string };
  }> {
    this.acquireLock();
    try {
      const startedAt = new Date().toISOString();
      const job = this.publishJobRepository.start({
        action: 'publish',
        now: startedAt,
        logs: [`${startedAt} publish started`],
      });

      try {
        const exported = await this.exportService.exportContent();
        // CMS-1 fix: publish previously only re-exported page/collection content
        // and never regenerated src/data/gallery.json, so publishing after
        // editing/reordering gallery items shipped the *previous* gallery.
        // Mirrors exportContentWithGallery(); any failure here fails the whole
        // publish job below rather than being silently skipped.
        const galleryExported = await this.exportService.exportGallery();
        const [command, ...args] = config.cms.publishCheckCommand.split(' ');
        const result = await execFileAsync(command, args, {
          cwd: config.rootDir,
          timeout: config.cms.publishTimeoutMs,
        });

        // A-6: con el CMS y el sitio en el mismo proceso, `npm run build`
        // regenera el dist/ que este servidor sirve, así que el cambio queda
        // en línea sin más pasos. Pero el HTML nuevo puede traer otros
        // scripts inline, y la CSP se calcula de él: hay que recalcularla.
        refreshPublicSecurityHeaders();
        const completedAt = new Date().toISOString();
        const completed = this.publishJobRepository.finish({
          id: job.id,
          status: 'succeeded',
          now: completedAt,
          logs: [
            ...job.logs,
            `${completedAt} exported ${exported.files.length} file(s)`,
            ...exported.removed.map((file) => `removed (renamed/unpublished/deleted): ${file}`),
            ...noticeLines(exported),
            `gallery: ${galleryExported.count} items → ${galleryExported.file}`,
            `publish: ${config.cms.publishCheckCommand}`,
            ...this.nonEmptyLines(result.stdout, 'stdout'),
            ...this.nonEmptyLines(result.stderr, 'stderr'),
          ],
        });

        return {
          job: completed,
          exported,
          galleryExported,
          publish: {
            stdout: result.stdout,
            stderr: result.stderr,
          },
        };
      } catch (error) {
        const completed = this.failJob(job, error);
        const message = error instanceof Error ? error.message : 'Publish failed';
        throw new Error(`Publish job ${completed.id} failed: ${message}`);
      }
    } finally {
      this.busy = false;
    }
  }

  listJobs(): PublishJob[] {
    return this.publishJobRepository.list();
  }

  getJob(id: string): PublishJob {
    const job = this.publishJobRepository.find(id);
    if (!job) throw new Error(`Publish job ${id} not found`);
    return job;
  }

  private failJob(job: PublishJob, error: unknown): PublishJob {
    const completedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : 'Unknown publish error';
    return this.publishJobRepository.finish({
      id: job.id,
      status: 'failed',
      now: completedAt,
      logs: [...job.logs, `${completedAt} failed: ${message}`, ...this.errorOutput(error)],
    });
  }

  private errorOutput(error: unknown): string[] {
    const execError = error as ExecFailure;
    return [
      ...this.nonEmptyLines(execError.stdout, 'stdout'),
      ...this.nonEmptyLines(execError.stderr, 'stderr'),
    ];
  }

  private nonEmptyLines(value: string | undefined, prefix: string): string[] {
    return (value ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `${prefix}: ${line}`);
  }
}
