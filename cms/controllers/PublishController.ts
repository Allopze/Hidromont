import type { FastifyReply, FastifyRequest } from 'fastify';
import type { BackupService } from '../services/backupService';
import type { PublishService } from '../services/publishService';
import { captureException } from '../utils/errorTracking';
import { BaseController } from './BaseController';

// CMS-4: the only failure exportContentWithGallery() should ever gracefully
// degrade from is a DB that predates the gallery tables (a real, expected
// state for an older/test database). Any other failure — a corrupt source
// image, disk full, a real sharp error — must NOT be silently swallowed and
// reported as a 200 "export succeeded" with stale gallery.json.
function isMissingGalleryTables(error: unknown): boolean {
  return error instanceof Error && /no such table/i.test(error.message);
}

export class PublishController extends BaseController {
  constructor(
    private readonly publishService: PublishService,
    private readonly backupService?: BackupService
  ) {
    super();
  }

  async export(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      // Use gallery-aware export if available, otherwise fallback to content-only
      const result = await this.publishService.exportContentWithGallery();
      this.handleSuccess(reply, result);
    } catch (error) {
      if (!isMissingGalleryTables(error)) {
        captureException(error, { action: 'exportContentWithGallery' });
        this.handleError(error, reply, 'exportContentWithGallery');
        return;
      }
      // Fallback: gallery tables genuinely don't exist yet, export content only
      try {
        this.handleSuccess(reply, this.publishService.exportContent());
      } catch (fallbackError) {
        this.handleError(fallbackError, reply, 'exportContent');
      }
    }
  }

  async publish(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      this.handleSuccess(reply, await this.publishService.publishContent());
    } catch (error) {
      this.handleError(error, reply, 'publishContent');
    }
  }

  async listJobs(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      this.handleSuccess(reply, { items: this.publishService.listJobs() });
    } catch (error) {
      this.handleError(error, reply, 'listPublishJobs');
    }
  }

  async getJob(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      this.handleSuccess(reply, this.publishService.getJob(params.id));
    } catch (error) {
      this.handleError(error, reply, 'getPublishJob');
    }
  }

  async backup(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!this.backupService) {
        reply.status(501).send({ error: 'Backup no disponible en este entorno' });
        return;
      }
      this.handleSuccess(reply, await this.backupService.createBackup());
    } catch (error) {
      this.handleError(error, reply, 'backup');
    }
  }

  async listBackups(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      if (!this.backupService) {
        reply.status(501).send({ error: 'Backup no disponible en este entorno' });
        return;
      }
      this.handleSuccess(reply, { backups: this.backupService.listBackups() });
    } catch (error) {
      this.handleError(error, reply, 'listBackups');
    }
  }
}
