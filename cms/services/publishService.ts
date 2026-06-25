import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config/unifiedConfig';
import type { PublishJobRepository } from '../repositories/PublishJobRepository';
import type { PublishJob } from '../types/cms';
import type { ExportService } from './exportService';

const execFileAsync = promisify(execFile);

interface ExecFailure extends Error {
  stdout?: string;
  stderr?: string;
}

export class PublishService {
  constructor(
    private readonly exportService: ExportService,
    private readonly publishJobRepository: PublishJobRepository
  ) {}

  exportContent(): { job: PublishJob; exported: { files: string[] }; galleryExported?: { file: string; count: number } } {
    const startedAt = new Date().toISOString();
    const job = this.publishJobRepository.start({
      action: 'export',
      now: startedAt,
      logs: [`${startedAt} export started`],
    });

    try {
      const exported = this.exportService.exportContent();
      const completedAt = new Date().toISOString();
      const completed = this.publishJobRepository.finish({
        id: job.id,
        status: 'succeeded',
        now: completedAt,
        logs: [
          ...job.logs,
          `${completedAt} exported ${exported.files.length} file(s)`,
          ...exported.files.map((file) => `file: ${file}`),
        ],
      });
      return { job: completed, exported };
    } catch (error) {
      this.failJob(job, error);
      throw error;
    }
  }

  async exportContentWithGallery(): Promise<{ job: PublishJob; exported: { files: string[] }; galleryExported: { file: string; count: number } }> {
    const startedAt = new Date().toISOString();
    const job = this.publishJobRepository.start({
      action: 'export',
      now: startedAt,
      logs: [`${startedAt} export started (content + gallery)`],
    });

    try {
      const exported = this.exportService.exportContent();
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
          `gallery: ${galleryExported.count} items → ${galleryExported.file}`,
        ],
      });
      return { job: completed, exported, galleryExported };
    } catch (error) {
      this.failJob(job, error);
      throw error;
    }
  }

  async publishContent(): Promise<{ job: PublishJob; exported: { files: string[] }; publish: { stdout: string; stderr: string } }> {
    const startedAt = new Date().toISOString();
    const job = this.publishJobRepository.start({
      action: 'publish',
      now: startedAt,
      logs: [`${startedAt} publish started`],
    });

    try {
      const exported = this.exportService.exportContent();
      const [command, ...args] = config.cms.publishCheckCommand.split(' ');
      const result = await execFileAsync(command, args, {
        cwd: config.rootDir,
        timeout: 120000,
      });
      const completedAt = new Date().toISOString();
      const completed = this.publishJobRepository.finish({
        id: job.id,
        status: 'succeeded',
        now: completedAt,
        logs: [
          ...job.logs,
          `${completedAt} exported ${exported.files.length} file(s)`,
          `publish: ${config.cms.publishCheckCommand}`,
          ...this.nonEmptyLines(result.stdout, 'stdout'),
          ...this.nonEmptyLines(result.stderr, 'stderr'),
        ],
      });

      return {
        job: completed,
        exported,
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
      logs: [
        ...job.logs,
        `${completedAt} failed: ${message}`,
        ...this.errorOutput(error),
      ],
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
