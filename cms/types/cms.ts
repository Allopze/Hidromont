export type FieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'image'
  | 'link'
  | 'number'
  | 'list'
  | 'object';

export interface CmsField {
  key: string;
  type: FieldType;
  value: unknown;
  sourceRef?: Record<string, unknown>;
  updatedAt?: string;
}

export interface CmsEntry {
  id: string;
  kind: string;
  slug: string;
  locale: string;
  title: string;
  status: 'draft' | 'published';
  version: number;
  fields: Record<string, CmsField>;
}

export interface CmsSession {
  id: string;
  userId: string;
  csrfToken: string;
  expiresAt: string;
}

export type PublishJobStatus = 'running' | 'succeeded' | 'failed';
export type PublishJobAction = 'export' | 'publish';

export interface PublishJob {
  id: string;
  action: PublishJobAction;
  status: PublishJobStatus;
  logs: string[];
  createdAt: string;
  completedAt?: string;
}
