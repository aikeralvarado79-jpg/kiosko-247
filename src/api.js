const TOKEN_KEY = 'kiosko_admin_token';

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (res.status === 401) clearToken();

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export const api = {
  getState: () => request('/api/state'),
  login: (password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  createOrder: (order) => request('/api/orders', { method: 'POST', body: JSON.stringify(order) }),
  createProduct: (product) => request('/api/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id, product) => request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  updateOrderStatus: (id, status) => request(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  saveSettings: (settings) => request('/api/settings', { method: 'PUT', body: JSON.stringify(settings) })
};
