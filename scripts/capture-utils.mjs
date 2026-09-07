import fs from 'fs';

/**
 * Lee el tamaño de un PNG desde su cabecera IHDR, sin dependencias:
 * firma de 8 bytes + 4 de largo + 4 "IHDR" + 4 width (BE) + 4 height (BE).
 * Devuelve null si el buffer no trae una cabecera PNG válida.
 */
export function readPngSize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47) {
    return null;
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

export function readPngSizeFromFile(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(24);
    const read = fs.readSync(fd, header, 0, 24, 0);
    return readPngSize(header.subarray(0, read));
  } finally {
    fs.closeSync(fd);
  }
}

export function collectRoutesFromHtmlPaths(relativePaths) {
  const routes = [];
  const skipped = [];

  for (const relative of relativePaths) {
    const normalized = relative.replace(/\\/g, '/');
    if (normalized === 'index.html') {
      routes.push('/');
    } else if (normalized === '404.html') {
      continue;
    } else if (normalized.endsWith('/index.html')) {
      routes.push('/' + normalized.slice(0, -'/index.html'.length));
    } else {
      skipped.push(normalized);
    }
  }

  return {
    routes: [...new Set(routes)].sort(),
    skipped: [...new Set(skipped)].sort(),
  };
}

export function classifyMedia(media) {
  const result = { loaded: [], broken: [], pending: [] };

  for (const item of media) {
    if (!item.complete) {
      result.pending.push(item.src);
    } else if (item.naturalWidth <= 0) {
      result.broken.push(item.src);
    } else {
      result.loaded.push(item.src);
    }
  }

  return result;
}

const PUBLIC_CMS_MARKERS = [
  'data-cms-entry',
  '__HIDROMONT_CMS__',
  'hm-cms-bar',
  'Agregar imagen',
];

export function findPublicCmsMarkers(html) {
  return PUBLIC_CMS_MARKERS.filter((marker) => html.includes(marker));
}

export function validateScreenshotInventory(files) {
  const normalized = files.map((file) => file.replace(/\\/g, '/'));
  const count = (prefix) => normalized.filter((file) => file.startsWith(prefix)).length;
  const inventory = {
    total: normalized.length,
    desktop: count('desktop/'),
    mobile: count('mobile/'),
    publicPerViewport: count('desktop/public/'),
    cmsPerViewport: count('desktop/cms/'),
  };

  // 27 rutas públicas: las 24 originales + ruta-nahuelbuta-pasarelas,
  // tanques-glp-coyhaique y tanques-glp-puerto-williams, promovidas de
  // `tipo: banco` a `tipo: destacado` (ahora generan página propia).
  const PUBLIC_ROUTES = 27;
  const CMS_SCENES = 4;
  const expectedTotal = (PUBLIC_ROUTES + CMS_SCENES) * 2;

  const valid =
    inventory.total === expectedTotal &&
    inventory.desktop === PUBLIC_ROUTES + CMS_SCENES &&
    inventory.mobile === PUBLIC_ROUTES + CMS_SCENES &&
    inventory.publicPerViewport === PUBLIC_ROUTES &&
    count('mobile/public/') === PUBLIC_ROUTES &&
    inventory.cmsPerViewport === CMS_SCENES &&
    count('mobile/cms/') === CMS_SCENES;

  if (!valid) {
    throw new Error(
      `Inventario incompleto: ${inventory.total} de ${expectedTotal} PNG; ` +
        `${inventory.desktop}/${PUBLIC_ROUTES + CMS_SCENES} desktop y ` +
        `${inventory.mobile}/${PUBLIC_ROUTES + CMS_SCENES} mobile.`
    );
  }

  return inventory;
}

export function resolveCapturePorts(env) {
  const parse = (value, fallback) => {
    const port = Number.parseInt(value || '', 10);
    return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
  };

  return {
    publicPort: parse(env.CAPTURE_PUBLIC_PORT, 8897),
    cmsPort: parse(env.CAPTURE_CMS_PORT, 8898),
  };
}
