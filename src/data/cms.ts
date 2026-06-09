import cmsContent from './cms-content.json';

type CmsField = {
  type: string;
  value: unknown;
};

type CmsContent = {
  entries: Record<string, {
    fields: Record<string, CmsField>;
  }>;
};

const content = cmsContent as CmsContent;

function getField(entryId: string, key: string): unknown {
  const entry = content.entries[entryId];
  return entry?.fields?.[key]?.value;
}

export function getCmsText(entryId: string, key: string, fallback: string): string {
  const value = getField(entryId, key);
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

export function getCmsNumber(entryId: string, key: string, fallback: number): number {
  const value = getField(entryId, key);
  return typeof value === 'number' ? value : fallback;
}

export function getCmsValue<T>(entryId: string, key: string, fallback: T): T {
  const value = getField(entryId, key);
  return value === undefined ? fallback : (value as T);
}

export interface CmsImageData {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export function getCmsImage(entryId: string, fallback: CmsImageData): CmsImageData {
  return {
    src: getCmsText(entryId, 'image', fallback.src),
    alt: getCmsText(entryId, 'imageAlt', fallback.alt),
    width: getCmsNumber(entryId, 'imageWidth', fallback.width),
    height: getCmsNumber(entryId, 'imageHeight', fallback.height),
  };
}
