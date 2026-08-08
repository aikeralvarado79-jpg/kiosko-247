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
  getState: (clientId) => request(`/api/state${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
  holdStock: (clientId, items, ttlMs) => request('/api/holds', { method: 'POST', body: JSON.stringify({ clientId, items, ttlMs }) }),
  releaseHold: (clientId) => request('/api/holds', { method: 'DELETE', body: JSON.stringify({ clientId }) }),
  createShare: (data) => request('/api/share', { method: 'POST', body: JSON.stringify(data) }),
  getShare: (code) => request(`/api/share/${encodeURIComponent(code)}`),
  addShareItems: (code, items) => request(`/api/share/${encodeURIComponent(code)}/items`, { method: 'POST', body: JSON.stringify({ items }) }),
  closeShare: (code, clientId) => request(`/api/share/${encodeURIComponent(code)}`, { method: 'DELETE', body: JSON.stringify({ clientId }) }),
  login: (phone, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) }),
  createOrder: (order) => request('/api/orders', { method: 'POST', body: JSON.stringify(order) }),
  createProduct: (product) => request('/api/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id, product) => request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id) => request(`/api/products/${id}`, { method: 'DELETE' }),
  updateOrderStatus: (id, status) => request(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  cancelOrder: (id, phone) => request(`/api/orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ phone }) }),
  deleteOrder: (id) => request(`/api/orders/${id}`, { method: 'DELETE' }),
  updateCourierLocation: (id, lat, lng) => request(`/api/orders/${id}/courier-location`, { method: 'POST', body: JSON.stringify({ lat, lng }) }),
  getOrderTracking: (id) => request(`/api/orders/${id}/tracking`),
  recoverPassword: (phone, response, newPassword) => request('/api/auth/recover', { method: 'POST', body: JSON.stringify({ phone, response, newPassword }) }),
  adminBiometricLogin: (phone, response) => request('/api/auth/admin/biometric-login', { method: 'POST', body: JSON.stringify({ phone, response }) }),
  adminBiometricRegister: (phone, response) => request('/api/auth/admin/biometric-register', { method: 'POST', body: JSON.stringify({ phone, response }) }),
  saveSettings: (settings) => request('/api/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  refreshDb: () => request('/api/db/refresh', { method: 'POST' }),
  getCustomer: (phone) => request(`/api/customers/${encodeURIComponent(phone)}`),
  upsertCustomer: (phone, data) => request(`/api/customers/${encodeURIComponent(phone)}`, { method: 'PUT', body: JSON.stringify(data) }),
  listCustomers: () => request('/api/customers'),
  setCustomerBenefited: (phone, benefited) => request(`/api/customers/${encodeURIComponent(phone)}/benefited`, { method: 'PUT', body: JSON.stringify({ benefited }) }),
  getBlacklist: () => request('/api/customers/blacklist'),
  addToBlacklist: (data) => request('/api/customers/blacklist', { method: 'POST', body: JSON.stringify(data) }),
  addBlacklistDebt: (data) => request('/api/customers/blacklist/debt', { method: 'POST', body: JSON.stringify(data) }),
  getCollections: () => request('/api/collections'),
  upsertCollection: (data) => request('/api/collections', { method: 'POST', body: JSON.stringify(data) }),
  deleteCollection: (id) => request(`/api/collections/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  webauthnRegisterOptions: (data) => request('/api/webauthn/register-options', { method: 'POST', body: JSON.stringify(data) }),
  webauthnRegisterVerify: (data) => request('/api/webauthn/register-verify', { method: 'POST', body: JSON.stringify(data) }),
  webauthnLoginOptions: (data) => request('/api/webauthn/login-options', { method: 'POST', body: JSON.stringify(data) }),
  webauthnLoginVerify: (data) => request('/api/webauthn/login-verify', { method: 'POST', body: JSON.stringify(data) }),
  getVapidKey: () => request('/api/push/vapid-key'),
  subscribePush: (phone, subscription) => request('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ phone, subscription }) }),
  unsubscribePush: (endpoint) => request('/api/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint }) }),
  pushTest: (phone, title, body) => request('/api/push/test', { method: 'POST', body: JSON.stringify({ phone, title, body }) }),
  pushBroadcast: (title, body) => request('/api/push/broadcast', { method: 'POST', body: JSON.stringify({ title, body }) }),
  pushReminder: (phone, amount) => request('/api/push/reminder', { method: 'POST', body: JSON.stringify({ phone, amount }) }),
  updateOrderPayment: (id, status) => request(`/api/orders/${id}/payment`, { method: 'POST', body: JSON.stringify({ status }) }),
  attachPaymentProof: (id, phone, proof, reference) => request(`/api/orders/${id}/payment-proof`, { method: 'POST', body: JSON.stringify({ phone, proof, reference }) }),
  convertOrderToCredit: (id, phone) => request(`/api/orders/${id}/payment/credit`, { method: 'POST', body: JSON.stringify({ phone }) }),
  getOrderMessages: (id, phone) => request(`/api/orders/${id}/messages?phone=${encodeURIComponent(phone || '')}`),
  sendOrderMessage: (id, phone, text) => request(`/api/orders/${id}/messages`, { method: 'POST', body: JSON.stringify({ phone, text }) })
};
