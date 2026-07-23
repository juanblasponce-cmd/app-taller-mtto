// Cliente HTTP con la cabecera de identidad (Entra ID simulado).
const KEY = 'taller_user_id';

export function getUserId() {
  return localStorage.getItem(KEY);
}
export function setUserId(id) {
  if (id) localStorage.setItem(KEY, String(id));
  else localStorage.removeItem(KEY);
}

async function request(method, url, body, isForm = false) {
  const headers = {};
  const uid = getUserId();
  if (uid) headers['x-user-id'] = uid;
  const opts = { method, headers };
  if (body !== undefined) {
    if (isForm) opts.body = body;
    else { headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  }
  const res = await fetch('/api' + url, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  upload: (url, formData) => request('POST', url, formData, true),
};
