const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const TOKEN_KEY = 'token';

// sessionStorage: some ao fechar a aba (menor janela de exposição que localStorage)
export const getToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t) => {
  try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch {}
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  let payload = body;
  if (body && !(body instanceof FormData)) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${API}/api${path}`, { method, headers: h, body: payload });
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor', 0);
  }
  if (!res.ok) {
    let data = {};
    try { data = await res.json(); } catch {}
    if (res.status === 401 && token && !path.startsWith('/auth/confirm') && !path.startsWith('/auth/login')) {
      setToken(null);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('session-expired'));
    }
    throw new ApiError(data.error || `Erro ${res.status}`, res.status, data.details);
  }
  return raw ? res : res.json();
}

export const api = {
  get: (p, o) => request(p, o),
  post: (p, body, o) => request(p, { method: 'POST', body, ...o }),
  put: (p, body) => request(p, { method: 'PUT', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  // Abre um recibo (precisa do header Authorization, por isso baixamos como blob)
  async openReceipt(expenseId, index) {
    const res = await request(`/expenses/${expenseId}/receipts/${index}`, { raw: true });
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank', 'noopener');
  },
};

export const brl = (n) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const fmtDate = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—');
