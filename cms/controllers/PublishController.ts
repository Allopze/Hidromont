import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PublishService } from '../services/publishService';
import { BaseController } from './BaseController';

export class PublishController extends BaseController {
  constructor(private readonly publishService: PublishService) {
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
}
