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

  const valid =
    inventory.total === 56 &&
    inventory.desktop === 28 &&
    inventory.mobile === 28 &&
    inventory.publicPerViewport === 24 &&
    count('mobile/public/') === 24 &&
    inventory.cmsPerViewport === 4 &&
    count('mobile/cms/') === 4;

  if (!valid) {
    throw new Error(
      `Inventario incompleto: ${inventory.total} de 56 PNG; ` +
        `${inventory.desktop}/28 desktop y ${inventory.mobile}/28 mobile.`
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
