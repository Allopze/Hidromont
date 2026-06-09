import type { FastifyReply, FastifyRequest } from 'fastify';
import type { BackupService } from '../services/backupService';
import type { PublishService } from '../services/publishService';
import { BaseController } from './BaseController';

export class PublishController extends BaseController {
  constructor(
    private readonly publishService: PublishService,
    private readonly backupService?: BackupService
  ) {
    super();
  }

  async export(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      this.handleSuccess(reply, this.publishService.exportContent());
    } catch (error) {
      this.handleError(error, reply, 'exportContent');
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
