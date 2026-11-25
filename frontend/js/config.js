// Cấu hình URL backend khi tách frontend lên Vercel.
// Khi chạy chung với backend (localhost / Docker), để mặc định rỗng ''.
// Khi deploy frontend lên Vercel, điền URL backend (ví dụ: 'https://your-app.onrender.com')
// hoặc truyền qua query ?backend=https://... (tự lưu vào localStorage).
export const DEFAULT_BACKEND_URL = '';

export function getBackendUrl() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get('backend');
  if (fromQuery !== null) {
    const clean = fromQuery.trim().replace(/\/+$/, '');
    if (clean) localStorage.setItem('bt_backend_url', clean);
    else localStorage.removeItem('bt_backend_url');
  }
  const saved = localStorage.getItem('bt_backend_url') || '';
  return (saved || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, '');
}

export function getApiUrl(path) {
  const base = getBackendUrl();
  if (!base || !path.startsWith('/')) return path;
  return `${base}${path}`;
}

export function getWsUrl(token) {
  const base = getBackendUrl();
  const q = `token=${encodeURIComponent(token)}`;
  if (base) {
    const u = new URL(base);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${u.host}/ws?${q}`;
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws?${q}`;
}
