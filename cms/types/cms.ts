export type FieldType =
  'text' | 'textarea' | 'richtext' | 'image' | 'link' | 'number' | 'list' | 'object';

export interface CmsField {
  key: string;
  type: FieldType;
  value: unknown;
  /**
   * E-3: nombre legible del campo, derivado de la clave. Viaja con el campo
   * para que las dos vistas del panel —el editor de un campo y el formulario
   * de entrada— lo tengan sin duplicar el diccionario en el cliente, y para
   * que una clave nueva salga rotulada sin volver a desplegar el overlay.
   * El export no lo incluye: proyecta solo `type` y `value`.
   */
  label?: string;
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
