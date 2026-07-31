export function initStateAndApi(config) {
  const apiBase = config.apiBase || `${location.protocol}//${location.hostname}:8787`;
  const state = {
    csrfToken: '',
    selected: null,
    entry: null,
    mediaItems: [],
    isFormDirty: false,
    lastActiveElement: null,
  };

  async function api(path, options = {}) {
    const headers = options.headers || {};
    if (state.csrfToken && options.method && options.method !== 'GET') {
      headers['X-CSRF-Token'] = state.csrfToken;
    }
    const response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      ...options,
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Error CMS');
    return data;
  }

  return { apiBase, state, api };
}
