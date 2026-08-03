import { useState, useEffect, useMemo, useCallback } from 'react';
import { api, getToken, setToken, clearToken } from './api.js';

// SVG Icons Helper Components for full visual depth without external dependencies
const Icon = ({ name, className = "w-5 h-5", ...props }) => {
  const icons = {
    store: <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7M2 7v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7M2 7h20M12 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    shoppingBag: <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />,
    search: <path d="m21 21-4.3-4.3M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    trash: <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />,
    edit: <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    check: <path d="M20 6 9 17l-5-5" />,
    package: <path d="m16.5 9.4-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />,
    alertTriangle: <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3zM12 9v4M12 17h.01" />,
    trendingUp: <path d="m22 7-8.5 8.5-5-5L1 18M16 7h6v6" />,
    user: <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
    mapPin: <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0zM12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
    clock: <path d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />,
    filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
    eye: <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
    dollarSign: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
    layers: <path d="m12 2 10 5-10 5L2 7zm0 10 10 5-10 5-10-5zm0 10 10 5-10 5-10-5z" />,
    refresh: <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />,
    sparkles: <path d="m12 3 1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {icons[name] || <circle cx="12" cy="12" r="10" />}
    </svg>
  );
};

const formatTimestamp = (date = new Date()) =>
  date.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const formatSize = (product) => {
  if (!product || product.sizeValue === undefined || product.sizeValue === null || product.sizeValue === '') return '';
  const num = Number(product.sizeValue);
  const formatted = Number.isInteger(num) ? String(num) : num.toLocaleString('es-AR');
  return `${formatted}${product.sizeUnit || ''}`;
};

const STATUS_FLOW = ['pendiente', 'en_preparacion', 'listo', 'entregado'];

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
  entregado: 'Entregado'
};

export default function App() {
  // App views: 'customer' | 'admin'
  const [activeView, setActiveView] = useState('customer');

  // Server state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Admin session state
  const [isAdminAuthed, setIsAdminAuthed] = useState(() => Boolean(getToken()));

  const loadState = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
      setLoadError('');
    }
    const res = await api.getState();
    if (!res.ok) {
      if (!silent) {
        setLoadError('No se pudo conectar con el servidor. Asegurate de ejecutar "npm run dev:all".');
      }
      setIsLoading(false);
      return;
    }
    setProducts(res.data.products || []);
    setCategories(res.data.categories || []);
    setOrders(res.data.orders || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  // Polling: keep products, orders and tracking fresh in real time
  useEffect(() => {
    const POLL_INTERVAL = Number(import.meta.env.VITE_POLL_INTERVAL) || 5000;

    const poll = () => {
      if (document.hidden) return; // no gastar requests con la pestaña oculta
      loadState({ silent: true });
    };

    const id = setInterval(poll, POLL_INTERVAL);
    document.addEventListener('visibilitychange', poll);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [loadState]);

  // Cart State
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Search & Filters
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [productDetailModal, setProductDetailModal] = useState(null); // Product object
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [currentOrderTracking, setCurrentOrderTracking] = useState(null); // Order id for customer view

  // Admin Specific States
  const [adminTab, setAdminTab] = useState('inventory'); // 'inventory' | 'orders' | 'analytics'
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState(null);
  const [deleteConfirmProduct, setDeleteConfirmProduct] = useState(null);

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const handleAdminLogin = async (password) => {
    const res = await api.login(password);
    if (!res.ok) {
      addToast(res.data.error || 'Contraseña incorrecta', 'error');
      return false;
    }
    setToken(res.data.token);
    setIsAdminAuthed(true);
    addToast('Sesión iniciada en el panel admin');
    return true;
  };

  const handleAdminLogout = () => {
    clearToken();
    setIsAdminAuthed(false);
    setActiveView('customer');
    setAdminTab('inventory');
    addToast('Sesión cerrada', 'info');
  };

  const addToCart = (product, quantityToAdd = 1) => {
    if (product.stock <= 0) {
      addToast('Este producto no tiene stock disponible', 'error');
      return;
    }

    const existing = cart.find((item) => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const newQty = currentQty + quantityToAdd;

    if (newQty > product.stock) {
      addToast(`Solo hay ${product.stock} unidades en stock`, 'warning');
      return;
    }

    if (existing) {
      setCart(cart.map((item) =>
        item.product.id === product.id ? { ...item, quantity: newQty } : item
      ));
    } else {
      setCart([...cart, { product, quantity: quantityToAdd }]);
    }

    addToast(`Agregado: ${product.name} (x${quantityToAdd})`);
  };

  const updateCartQty = (productId, delta) => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty > item.product.stock) {
      addToast(`Máximo disponible: ${item.product.stock}`, 'warning');
      return;
    }

    if (newQty <= 0) {
      setCart(cart.filter((i) => i.product.id !== productId));
      return;
    }

    setCart(cart.map((i) =>
      i.product.id === productId ? { ...i, quantity: newQty } : i
    ));
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    addToast('Producto removido del carrito', 'info');
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handlePlaceOrder = async (formData) => {
    if (cart.length === 0) return;

    const orderPayload = {
      customerName: formData.customerName,
      phone: formData.phone,
      type: formData.type,
      address: formData.type === 'delivery' ? formData.address : undefined,
      notes: formData.notes,
      items: cart.map((item) => ({
        id: item.product.id,
        name: item.product.name,
        price: item.product.price,
        quantity: item.quantity
      })),
      total: cartTotal,
      timestamp: formatTimestamp(),
      estimatedMinutes: formData.type === 'delivery' ? 25 : 10
    };

    const res = await api.createOrder(orderPayload);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo realizar el pedido', 'error');
      return;
    }

    const { state, order } = res.data;
    setProducts(state.products || []);
    setOrders(state.orders || []);
    setCart([]);
    setIsCheckoutOpen(false);
    setIsCartOpen(false);
    setCurrentOrderTracking(order.id);
    addToast('¡Pedido realizado con éxito!', 'success');
  };

  const handleSaveProduct = async (productData) => {
    if (productData.id) {
      // Edit existing
      const res = await api.updateProduct(productData.id, productData);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo actualizar el producto', 'error');
        return;
      }
      setProducts(res.data.state.products || []);
      setCategories(res.data.state.categories || []);
      addToast(`Producto "${productData.name}" actualizado`);
    } else {
      // Create new (id y code los genera el servidor)
      const res = await api.createProduct(productData);
      if (!res.ok) {
        addToast(res.data.error || 'No se pudo crear el producto', 'error');
        return;
      }
      setProducts(res.data.state.products || []);
      setCategories(res.data.state.categories || []);
      addToast(`Producto "${productData.name}" creado con éxito`);
    }

    setIsAddEditModalOpen(false);
    setProductToEdit(null);
  };

  const handleDeleteProduct = async (productId) => {
    const res = await api.deleteProduct(productId);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el producto', 'error');
      return;
    }
    setProducts(res.data.state.products || []);
    addToast('Producto eliminado del inventario', 'info');
    setDeleteConfirmProduct(null);
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const res = await api.updateOrderStatus(orderId, newStatus);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el pedido', 'error');
      return;
    }
    setOrders(res.data.state.orders || []);
    addToast(`Estado del pedido ${orderId} actualizado a ${STATUS_LABELS[newStatus] || newStatus}`);
  };

  // Derive live tracking order from current orders so status changes reflect in customer view
  const trackedOrder = currentOrderTracking
    ? orders.find((o) => o.id === currentOrderTracking) || null
    : null;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 border text-sm font-medium transition-all duration-300 transform translate-y-0 animate-bounce-short ${
              toast.type === 'error'
                ? 'bg-rose-900/80 border-rose-500/50 text-rose-100'
                : toast.type === 'warning'
                ? 'bg-amber-900/80 border-amber-500/50 text-amber-100'
                : toast.type === 'info'
                ? 'bg-sky-900/80 border-sky-500/50 text-sky-100'
                : 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100'
            }`}
          >
            <Icon
              name={
                toast.type === 'error' || toast.type === 'warning'
                  ? 'alertTriangle'
                  : 'sparkles'
              }
              className="w-5 h-5 flex-shrink-0"
            />
            <p className="flex-1">{toast.message}</p>
          </div>
        ))}
      </div>

      {/* Modern Glassmorphic Top Navbar */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20 ring-2 ring-white/10">
              <Icon name="store" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-200 to-teal-400 bg-clip-text text-transparent">
                Kiosco 24/7
              </h1>
              <span className="text-xs text-teal-400/90 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping inline-block" />
                Abierto Ahora • Atención Rápida
              </span>
            </div>
          </div>

          {/* Mode Switcher: Customer vs Admin Panel */}
          <div className="flex items-center gap-2 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => setActiveView('customer')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                activeView === 'customer'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 shadow-md shadow-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Icon name="shoppingBag" className="w-4 h-4" />
              <span>Tienda Comprador</span>
            </button>
            <button
              onClick={() => setActiveView('admin')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                activeView === 'admin'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
              }`}
            >
              <Icon name="layers" className="w-4 h-4" />
              <span>Panel Kiosco</span>
              {orders.filter((o) => o.status === 'pendiente').length > 0 && (
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                  {orders.filter((o) => o.status === 'pendiente').length}
                </span>
              )}
            </button>
          </div>

          {/* Customer Cart Quick Button */}
          {activeView === 'customer' && (
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-800 transition-all text-slate-200 hover:text-teal-400 group"
              aria-label="Abrir carrito"
            >
              <Icon name="shoppingBag" className="w-6 h-6 transition-transform group-hover:scale-110" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-teal-400 text-slate-950 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-scale-up ring-2 ring-slate-900">
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <LoadingScreen />
        ) : loadError ? (
          <LoadErrorScreen error={loadError} onRetry={loadState} />
        ) : activeView === 'customer' ? (
          <CustomerView
            products={filteredProducts}
            allProducts={products}
            categories={categories}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onAddToCart={addToCart}
            onOpenProductModal={(product) => setProductDetailModal(product)}
            currentOrderTracking={trackedOrder}
            setCurrentOrderTracking={setCurrentOrderTracking}
          />
        ) : isAdminAuthed ? (
          <AdminView
            products={products}
            categories={categories}
            orders={orders}
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            onLogout={handleAdminLogout}
            onOpenAddModal={() => {
              setProductToEdit(null);
              setIsAddEditModalOpen(true);
            }}
            onEditProduct={(product) => {
              setProductToEdit(product);
              setIsAddEditModalOpen(true);
            }}
            onDeleteProduct={(product) => setDeleteConfirmProduct(product)}
            onUpdateOrderStatus={handleUpdateOrderStatus}
          />
        ) : (
          <AdminLoginView onLogin={handleAdminLogin} onBack={() => setActiveView('customer')} />
        )}
      </main>

      {/* 1. Customer Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        cartTotal={cartTotal}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* 2. Product Detail Modal */}
      {productDetailModal && (
        <ProductDetailModal
          product={productDetailModal}
          onClose={() => setProductDetailModal(null)}
          onAddToCart={(qty) => {
            addToCart(productDetailModal, qty);
            setProductDetailModal(null);
          }}
        />
      )}

      {/* 3. Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          onClose={() => setIsCheckoutOpen(false)}
          cart={cart}
          cartTotal={cartTotal}
          onSubmit={handlePlaceOrder}
        />
      )}

      {/* 4. Admin Add/Edit Product Modal */}
      {isAddEditModalOpen && (
        <ProductFormModal
          productToEdit={productToEdit}
          categories={categories}
          onClose={() => setIsAddEditModalOpen(false)}
          onSave={handleSaveProduct}
        />
      )}

      {/* 5. Delete Confirm Modal */}
      {deleteConfirmProduct && (
        <DeleteConfirmModal
          product={deleteConfirmProduct}
          onClose={() => setDeleteConfirmProduct(null)}
          onConfirm={() => handleDeleteProduct(deleteConfirmProduct.id)}
        />
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/60 py-6 px-4 text-center text-xs text-slate-500">
        <p>© 2026 Kiosco 24/7 Digital Platform • Gestión inteligente de inventario y pedidos al instante.</p>
      </footer>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-500 to-cyan-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20 animate-pulse">
        <Icon name="store" className="w-7 h-7" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">Cargando el Kiosco 24/7...</h2>
        <p className="text-xs text-slate-400 mt-1">Sincronizando productos y pedidos desde el servidor.</p>
      </div>
    </div>
  );
}

function LoadErrorScreen({ error, onRetry }) {
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center space-y-5 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
        <Icon name="alertTriangle" className="w-7 h-7" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">No se pudo conectar</h2>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
      >
        <Icon name="refresh" className="w-4 h-4" />
        Reintentar
      </button>
    </div>
  );
}

function AdminLoginView({ onLogin, onBack }) {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Ingresá la contraseña de administrador.');
      return;
    }
    setIsSubmitting(true);
    setError('');
    const ok = await onLogin(password);
    setIsSubmitting(false);
    if (!ok) setError('Contraseña incorrecta. Probá con la configurada en server/config.json.');
  };

  return (
    <div className="py-16 flex items-center justify-center">
      <div className="w-full max-w-md bg-slate-800/80 border border-slate-700/80 rounded-3xl p-8 shadow-2xl backdrop-blur-md space-y-6">
        <div className="text-center space-y-2">
          <span className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-cyan-500/20">
            <Icon name="layers" className="w-7 h-7" />
          </span>
          <h2 className="text-xl font-black text-white">Acceso al Panel Admin</h2>
          <p className="text-xs text-slate-400">Ingresá la contraseña para gestionar inventario y pedidos.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-cyan-500 focus:outline-none"
            />
            {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold text-sm hover:from-cyan-400 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
          >
            <Icon name="check" className="w-4 h-4" />
            {isSubmitting ? 'Verificando...' : 'Ingresar al Panel'}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full py-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            ← Volver a la tienda
          </button>
        </form>
      </div>
    </div>
  );
}

function CustomerView({
  products,
  allProducts,
  categories,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  onAddToCart,
  onOpenProductModal,
  currentOrderTracking,
  setCurrentOrderTracking
}) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-900/40 via-slate-800 to-indigo-950/50 border border-slate-700/60 p-6 sm:p-10 shadow-2xl backdrop-blur-md">
        <div className="relative z-10 max-w-2xl space-y-3">
          <span className="px-3 py-1 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold uppercase tracking-wider">
            ⚡ Pedidos al momento
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            ¿Qué se te antoja hoy?
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Explora nuestros antojos, bebidas frías, snacks y artículos esenciales. Paga y retira sin hacer filas o recibe en tu puerta.
          </p>
        </div>
        {/* Decorative graphic background */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Live Order Tracker Banner (If customer placed an order recently) */}
      {currentOrderTracking && (
        <div className="p-6 rounded-3xl bg-slate-800/90 border border-teal-500/40 shadow-xl space-y-4 backdrop-blur-md relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-teal-500/20 text-teal-400">
                <Icon name="clock" className="w-6 h-6 animate-spin-slow" />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Estado de tu Pedido <span className="text-teal-400">#{currentOrderTracking.id}</span>
                </h3>
                <p className="text-xs text-slate-400">Estimado de preparación: ~{currentOrderTracking.estimatedMinutes} mins</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentOrderTracking(null)}
              className="text-xs text-slate-400 hover:text-white p-2"
            >
              Cerrar aviso
            </button>
          </div>

          {/* Stepper Status Bar */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {[
              { key: 'pendiente', label: '1. Recibido' },
              { key: 'en_preparacion', label: '2. Preparando' },
              { key: 'listo', label: '3. Listo para retirar' },
              { key: 'entregado', label: '4. Entregado' }
            ].map((step, idx) => {
              const currentIdx = STATUS_FLOW.indexOf(currentOrderTracking.status);
              const isPassed = idx <= currentIdx;
              const isCurrent = idx === currentIdx;

              return (
                <div key={step.key} className="flex flex-col items-center gap-2">
                  <div
                    className={`w-full h-2 rounded-full transition-all duration-500 ${
                      isPassed
                        ? 'bg-teal-400 shadow-lg shadow-teal-500/50'
                        : 'bg-slate-700/60'
                    }`}
                  />
                  <span
                    className={`text-[10px] sm:text-xs font-semibold text-center ${
                      isCurrent
                        ? 'text-teal-300 font-bold scale-105'
                        : isPassed
                        ? 'text-slate-300'
                        : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Bar & Category Filter Bar */}
      <div className="space-y-4">
        <div className="relative">
          <Icon name="search" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o descripción (ej: alfajor, gaseosa, sanguchito)..."
            className="w-full pl-12 pr-10 py-3.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all text-sm backdrop-blur-md"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {['Todas', ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-300 border ${
                selectedCategory === cat
                  ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-lg shadow-teal-500/20 scale-105'
                  : 'bg-slate-800/60 text-slate-300 border-slate-700/80 hover:bg-slate-700/60 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/30 rounded-3xl border border-slate-800 space-y-3">
          <Icon name="search" className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-300">No encontramos productos</h3>
          <p className="text-slate-500 text-xs">Intenta cambiar la categoría o limpiar el término de búsqueda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={() => onAddToCart(product, 1)}
              onOpenDetail={() => onOpenProductModal(product)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, onAddToCart, onOpenDetail }) {
  const isOut = product.stock <= 0;
  const isLow = product.stock > 0 && product.stock <= 5;

  return (
    <div className="group bg-slate-800/70 border border-slate-700/60 rounded-3xl overflow-hidden hover:border-teal-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-teal-500/5 hover:-translate-y-1 flex flex-col justify-between backdrop-blur-sm">
      <div onClick={onOpenDetail} className="cursor-pointer relative overflow-hidden aspect-[4/3] bg-slate-900">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1">
          {product.brand && (
            <span className="px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-medium text-teal-300 border border-teal-500/30">
              {product.brand}
            </span>
          )}
          <span className="px-2.5 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-medium text-slate-200 border border-white/10">
            {product.category}
          </span>
        </div>

        {/* Stock Badge Overlay */}
        {isOut ? (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
            <span className="px-3 py-1.5 rounded-full bg-rose-500/90 text-white font-bold text-xs shadow-lg uppercase tracking-wider">
              Agotado
            </span>
          </div>
        ) : isLow ? (
          <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-xl bg-amber-500/90 text-slate-950 font-extrabold text-[11px] shadow-lg">
            ¡Últimas {product.stock} un.!
          </span>
        ) : null}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          <h3
            onClick={onOpenDetail}
            className="font-bold text-slate-100 group-hover:text-teal-300 transition-colors cursor-pointer line-clamp-1"
          >
            {product.name}
          </h3>
          {formatSize(product) && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-700/60 text-[11px] font-bold text-teal-300">
              {formatSize(product)}
            </span>
          )}
          <p className="text-slate-400 text-xs line-clamp-2 mt-1 leading-relaxed">
            {product.description}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
          <div>
            <span className="text-xs text-slate-400 font-medium block">Precio</span>
            <span className="text-lg font-black text-white">
              ${product.price.toLocaleString('es-AR')}
            </span>
          </div>

          <button
            onClick={onAddToCart}
            disabled={isOut}
            className={`p-3 rounded-2xl font-semibold text-xs flex items-center gap-1.5 transition-all duration-300 active:scale-95 ${
              isOut
                ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                : 'bg-teal-500 text-slate-950 hover:bg-teal-400 shadow-md shadow-teal-500/20'
            }`}
            aria-label="Agregar al carrito"
          >
            <Icon name="plus" className="w-4 h-4" />
            <span className="hidden sm:inline">Agregar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDetailModal({ product, onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  const isOut = product.stock <= 0;

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-slate-950/60 text-slate-300 hover:text-white backdrop-blur-md hover:bg-slate-800 transition-all"
        >
          <Icon name="x" className="w-5 h-5" />
        </button>

        <div className="relative h-64 bg-slate-950">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4">
            <span className="px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md text-xs font-semibold text-teal-300 border border-teal-500/30">
              {product.category}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-mono">CÓDIGO: {product.code}</span>
                {product.brand && (
                  <span className="text-xs font-semibold text-teal-400">{product.brand}</span>
                )}
              </div>
              <span className={`text-xs font-semibold ${product.stock > 5 ? 'text-teal-400' : product.stock > 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                {product.stock > 0 ? `Stock: ${product.stock} un.` : 'Agotado'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-1">{product.name}</h2>
            {formatSize(product) && (
              <span className="text-xs font-semibold text-teal-400 mt-1 block">Tamaño: {formatSize(product)}</span>
            )}
            <p className="text-slate-300 text-sm mt-3 leading-relaxed">{product.description}</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <div>
              <span className="text-xs text-slate-400 block">Precio Unitario</span>
              <span className="text-2xl font-black text-white">${product.price.toLocaleString('es-AR')}</span>
            </div>

            {/* Quantity Controls */}
            {!isOut && (
              <div className="flex items-center gap-3 bg-slate-900 p-1.5 rounded-xl border border-slate-700">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Icon name="minus" className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-100 text-sm w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  <Icon name="plus" className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => onAddToCart(quantity)}
            disabled={isOut}
            className={`w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
              isOut
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95'
            }`}
          >
            <Icon name="shoppingBag" className="w-5 h-5" />
            <span>
              {isOut ? 'Sin Stock Disponible' : `Agregar al Carrito • $${(product.price * quantity).toLocaleString('es-AR')}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({ isOpen, onClose, cart, cartTotal, onUpdateQty, onRemove, onProceedToCheckout }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-900 h-full border-l border-slate-800 shadow-2xl flex flex-col z-10 animate-slide-left">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Icon name="shoppingBag" className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-white">Tu Carrito de Compras</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body - Items list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 text-slate-500">
              <Icon name="shoppingBag" className="w-16 h-16 stroke-1 text-slate-700" />
              <p className="font-semibold text-slate-400">Tu carrito está vacío</p>
              <p className="text-xs">Agrega algunos productos del catálogo para comenzar.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 group hover:border-slate-600 transition-all"
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-16 h-16 rounded-xl object-cover bg-slate-900"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-200 text-xs sm:text-sm truncate">
                    {item.product.name}
                  </h4>
                  <span className="text-xs text-teal-400 font-semibold block mt-1">
                    ${item.product.price.toLocaleString('es-AR')} c/u
                  </span>

                  {/* Quantity bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700">
                      <button
                        onClick={() => onUpdateQty(item.product.id, -1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="minus" className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-5 text-center text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.product.id, 1)}
                        className="p-1 rounded text-slate-400 hover:text-white"
                      >
                        <Icon name="plus" className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemove(item.product.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors ml-auto"
                      title="Eliminar del carrito"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer Summary */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-slate-800 bg-slate-900/90 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal</span>
                <span>${cartTotal.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Costo de preparación</span>
                <span className="text-teal-400 font-semibold">¡GRATIS!</span>
              </div>
              <div className="flex justify-between text-base font-black text-white pt-2 border-t border-slate-800">
                <span>Total a Pagar</span>
                <span className="text-teal-400">${cartTotal.toLocaleString('es-AR')}</span>
              </div>
            </div>

            <button
              onClick={onProceedToCheckout}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>Confirmar y Elegir Forma de Pago</span>
              <Icon name="check" className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CheckoutModal({ onClose, cart, cartTotal, onSubmit }) {
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    type: 'pickup', // 'pickup' | 'delivery'
    address: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.customerName.trim()) newErrors.customerName = 'Ingresa tu nombre completo';
    if (!formData.phone.trim()) newErrors.phone = 'Ingresa un teléfono de contacto';
    if (formData.type === 'delivery' && !formData.address.trim()) {
      newErrors.address = 'Ingresa la dirección de entrega';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-up">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Finalizar Pedido</h2>
            <p className="text-xs text-slate-400 mt-0.5">Completa tus datos para enviarlo al kiosco</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Order Method Selector */}
          <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-800 border border-slate-700">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'pickup' })}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                formData.type === 'pickup'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon name="store" className="w-4 h-4" />
              Retiro en Kiosco
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'delivery' })}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                formData.type === 'delivery'
                  ? 'bg-teal-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon name="mapPin" className="w-4 h-4" />
              Envío a Domicilio
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre y Apellido *
              </label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="Ej: Juan Pérez"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
              />
              {errors.customerName && <p className="text-xs text-rose-400 mt-1">{errors.customerName}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Teléfono / WhatsApp *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Ej: +54 9 11 1234-5678"
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
              />
              {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone}</p>}
            </div>

            {formData.type === 'delivery' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Dirección Completa de Entrega *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Calle, Número, Piso/Depto..."
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none"
                />
                {errors.address && <p className="text-xs text-rose-400 mt-1">{errors.address}</p>}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Aclaraciones o Notas (Opcional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Ej: Si no hay Sprite reemplazar por 7Up..."
                rows={2}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:border-teal-500 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Mini Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Resumen del Pedido</span>
            <div className="text-xs text-slate-300 flex justify-between">
              <span>Productos ({cart.length})</span>
              <span className="font-bold text-white">${cartTotal.toLocaleString('es-AR')}</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-emerald-400 shadow-xl shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="check" className="w-5 h-5" />
            <span>Confirmar y Enviar Pedido</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminView({
  products,
  categories,
  orders,
  adminTab,
  setAdminTab,
  onLogout,
  onOpenAddModal,
  onEditProduct,
  onDeleteProduct,
  onUpdateOrderStatus
}) {
  // Calculated Analytics
  const lowStockProducts = products.filter((p) => p.stock <= 5);
  const completedOrders = orders.filter((o) => o.status === 'entregado');
  const totalRevenue = completedOrders.reduce((acc, o) => acc + o.total, 0);
  const pendingOrders = orders.filter((o) => o.status === 'pendiente' || o.status === 'en_preparacion');

  const topByDemand = useMemo(() => {
    const counts = {};
    orders.forEach((o) =>
      o.items.forEach((it) => {
        counts[it.id] = (counts[it.id] || 0) + it.quantity;
      })
    );
    return Object.entries(counts)
      .map(([id, quantity]) => ({ id, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .map(({ id, quantity }) => {
        const p = products.find((prod) => prod.id === id);
        return p ? { ...p, quantity } : null;
      })
      .filter(Boolean)
      .slice(0, 4);
  }, [orders, products]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Admin Top Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <div>
          <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold uppercase tracking-wider">
            🛡️ Panel Administrativo Kiosco
          </span>
          <h2 className="text-2xl font-black text-white mt-2">Control de Inventario y Ventas</h2>
          <p className="text-xs text-slate-400 mt-1">Gestiona tus productos en tiempo real y atiende pedidos entrantes.</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddModal}
            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-cyan-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Icon name="plus" className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-rose-300 hover:border-rose-500/40 transition-all flex items-center justify-center gap-2"
            title="Cerrar sesión"
          >
            <Icon name="x" className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-400">
            <Icon name="package" className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Total Productos</span>
            <span className="text-2xl font-black text-white">{products.length}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400">
            <Icon name="alertTriangle" className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Stock Bajo / Crítico</span>
            <span className="text-2xl font-black text-amber-400">{lowStockProducts.length}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-400">
            <Icon name="clock" className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Pedidos Activos</span>
            <span className="text-2xl font-black text-cyan-400">{pendingOrders.length}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400">
            <Icon name="dollarSign" className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-400 font-medium block">Ingresos Confirmados</span>
            <span className="text-2xl font-black text-emerald-400">${totalRevenue.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        {[
          { key: 'inventory', label: 'Inventario de Productos', icon: 'package' },
          { key: 'orders', label: `Pedidos en Vivo (${pendingOrders.length})`, icon: 'clock' },
          { key: 'analytics', label: 'Estadísticas del Kiosco', icon: 'trendingUp' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setAdminTab(tab.key)}
            className={`pb-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              adminTab === tab.key
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon name={tab.icon} className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Inventory Management */}
      {adminTab === 'inventory' && (
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/60 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Producto</th>
                  <th className="p-4">Código</th>
                  <th className="p-4">Categoría</th>
                  <th className="p-4">Precio</th>
                  <th className="p-4">Stock</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm">
                {products.map((p) => {
                  const isLow = p.stock <= 5;
                  const isOut = p.stock === 0;

                  return (
                    <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="p-4 flex items-center gap-3">
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover bg-slate-900 border border-slate-700"
                        />
                        <div>
                          <p className="font-bold text-slate-100">{p.name}</p>
                          <p className="text-xs text-slate-400 line-clamp-1 max-w-xs">
                            {[formatSize(p), p.description].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-400">{p.code}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-300">
                          {p.category}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-white">${p.price.toLocaleString('es-AR')}</td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            isOut
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {p.stock} unidades
                        </span>
                      </td>
                      <td className="p-4 text-right space-x-2">
                        <button
                          onClick={() => onEditProduct(p)}
                          className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-cyan-400 transition-all"
                          title="Editar producto"
                        >
                          <Icon name="edit" className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteProduct(p)}
                          className="p-2 rounded-xl bg-slate-700/60 hover:bg-rose-500/20 text-rose-400 transition-all"
                          title="Eliminar producto"
                        >
                          <Icon name="trash" className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Orders */}
      {adminTab === 'orders' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orders.length === 0 ? (
            <div className="col-span-full py-16 text-center text-slate-500 space-y-2">
              <Icon name="clock" className="w-12 h-12 text-slate-700 mx-auto" />
              <p className="font-bold text-slate-400">Sin pedidos registrados aún</p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="p-5 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-xl space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-teal-400">{order.id}</span>
                    <span className="text-xs text-slate-400">{order.timestamp}</span>
                  </div>

                  <div>
                    <h4 className="font-bold text-white text-base">{order.customerName}</h4>
                    <p className="text-xs text-slate-300 flex items-center gap-1 mt-0.5">
                      <Icon name="phone" className="w-3.5 h-3.5 text-slate-400" />
                      {order.phone}
                    </p>
                    {order.type === 'delivery' ? (
                      <p className="text-xs text-amber-300 flex items-center gap-1 mt-1 bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                        <Icon name="mapPin" className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Entrega: {order.address}</span>
                      </p>
                    ) : (
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg bg-teal-500/10 text-teal-300 text-xs font-semibold">
                        🛍️ Retiro por Mostrador
                      </span>
                    )}
                  </div>

                  {/* Order Line Items */}
                  <div className="p-3 rounded-2xl bg-slate-900/80 space-y-1.5 text-xs text-slate-300">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{it.quantity}x {it.name}</span>
                        <span className="font-bold text-white">${(it.price * it.quantity).toLocaleString('es-AR')}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-white text-sm">
                      <span>Total</span>
                      <span className="text-teal-400">${order.total.toLocaleString('es-AR')}</span>
                    </div>
                  </div>

                  {order.notes && (
                    <p className="text-xs text-slate-400 italic bg-slate-900/40 p-2 rounded-xl">
                      "{order.notes}"
                    </p>
                  )}
                </div>

                {/* Status Update Controls */}
                <div className="pt-3 border-t border-slate-700/60 space-y-2">
                  <span className="text-[11px] text-slate-400 font-semibold block">Cambiar Estado:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'pendiente', label: 'Pendiente' },
                      { key: 'en_preparacion', label: 'En Preparación' },
                      { key: 'listo', label: 'Listo' },
                      { key: 'entregado', label: 'Entregado' }
                    ].map((st) => (
                      <button
                        key={st.key}
                        onClick={() => onUpdateOrderStatus(order.id, st.key)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                          order.status === st.key
                            ? 'bg-teal-500 text-slate-950 border-teal-400 shadow-md'
                            : 'bg-slate-900/60 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Analytics */}
      {adminTab === 'analytics' && (
        <div className="p-8 rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl space-y-6 backdrop-blur-md">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Icon name="trendingUp" className="w-5 h-5 text-teal-400" />
            Resumen de Métricas del Negocio
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm">Productos con Mayor Demanda</h4>
              {topByDemand.length === 0 ? (
                <p className="text-xs text-slate-400">Aún no hay ventas registradas para calcular la demanda.</p>
              ) : (
                <ul className="space-y-3">
                  {topByDemand.map((p, idx) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">#{idx + 1} {p.name}</span>
                      <span className="text-teal-400 font-bold">{p.quantity} un. vendidas</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm">Estado de Stock Crítico</h4>
              <ul className="space-y-3">
                {lowStockProducts.length === 0 ? (
                  <p className="text-xs text-emerald-400">¡Excelente! Todo el catálogo cuenta con stock suficiente.</p>
                ) : (
                  lowStockProducts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">{p.name}</span>
                      <span className="text-amber-400 font-bold">{p.stock} un. restantes</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const BEAUTY_CATEGORIES = ['higiene', 'limpieza', 'perfum', 'cosmetic', 'belleza', 'farmacia', 'salud', 'cuidado'];

const OPENFACTS_FIELDS = 'code,product_name,brands,image_front_url';

const searchOpenFoodFacts = async (query, useBeauty) => {
  const base = useBeauty
    ? 'https://world.openbeautyfacts.org'
    : 'https://world.openfoodfacts.org';
  const res = await fetch(
    `${base}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=${OPENFACTS_FIELDS}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.products || [])
    .filter((p) => p.image_front_url)
    .map((p) => ({
      id: `${useBeauty ? 'openbeautyfacts' : 'openfoodfacts'}-${p.code}`,
      thumb: p.image_front_url,
      full: p.image_front_url,
      photographer: p.brands || 'Supermercado',
      page: `${base}/product/${p.code}`,
      source: useBeauty ? 'Open Beauty Facts' : 'Open Food Facts'
    }));
};

const searchPexels = async (query) => {
  const res = await fetch(
    `/pexels-api/search?query=${encodeURIComponent(query)}&per_page=8&size=medium`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data.photos || []).map((photo) => ({
    id: `pexels-${photo.id}`,
    thumb: photo.src.medium || photo.src.small || photo.src.large,
    full: photo.src.large || photo.src.original,
    photographer: photo.photographer,
    page: photo.url
  }));
};

const searchWikimedia = async (query) => {
  const res = await fetch(
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&format=json&origin=*`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
  return pages
    .map((page) => {
      const info = page.imageinfo?.[0];
      return {
        id: `wikimedia-${page.pageid}`,
        thumb: info?.thumburl || info?.url,
        full: info?.thumburl || info?.url,
        photographer: info?.extmetadata?.Artist?.value
          ? info.extmetadata.Artist.value.replace(/<[^>]+>/g, '').trim()
          : 'Wikimedia Commons',
        page: info?.descriptionurl || ''
      };
    })
    .filter((r) => r.thumb && r.full);
};

function ProductFormModal({ productToEdit, categories, onClose, onSave }) {
  const [formData, setFormData] = useState({
    id: productToEdit?.id || '',
    code: productToEdit?.code || '',
    name: productToEdit?.name || '',
    brand: productToEdit?.brand || '',
    description: productToEdit?.description || '',
    price: productToEdit?.price || '',
    stock: productToEdit?.stock || '',
    category: productToEdit?.category || categories[0] || 'Comida',
    image: productToEdit?.image || 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80',
    sizeValue: productToEdit?.sizeValue || '',
    sizeUnit: productToEdit?.sizeUnit || 'ml'
  });

  const [newCatInput, setNewCatInput] = useState('');

  const sizeType = ['ml', 'L'].includes(formData.sizeUnit) ? 'liquid' : 'solid';
  const sizeUnits = sizeType === 'liquid' ? ['ml', 'L'] : ['g', 'kg'];

  const setSizeType = (type) => {
    setFormData((prev) => ({
      ...prev,
      sizeUnit: type === 'liquid' ? 'ml' : 'g'
    }));
  };

  const [imageResults, setImageResults] = useState([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [imageSearchError, setImageSearchError] = useState('');
  const [imageSource, setImageSource] = useState('');

  const searchImages = async () => {
    const query = [formData.brand, formData.name, formData.category]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!query) {
      setImageSearchError('Completa al menos el nombre o la marca del producto para buscar imágenes.');
      return;
    }

    setIsSearchingImages(true);
    setImageSearchError('');
    setImageResults([]);
    setImageSource('');

    let results = null;

    // 1. Open Food Facts / Open Beauty Facts: fotos reales de productos de supermercado
    const useBeauty = BEAUTY_CATEGORIES.some((k) =>
      formData.category.toLowerCase().includes(k)
    );

    const foodQuery = [formData.brand, formData.name]
      .filter(Boolean)
      .join(' ')
      .replace(/\b\d+(\.\d+)?\s*(ml|l|g|kg)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      results = await searchOpenFoodFacts(foodQuery || query, useBeauty);
    } catch (err) {
      console.error('[kiosko] Open Food Facts falló:', err);
    }

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource(results[0].source);
      setIsSearchingImages(false);
      return;
    }

    // 2. Pexels (vía proxy de dev)
    try {
      results = await searchPexels(query);
    } catch (err) {
      console.error('[kiosko] Pexels falló:', err);
    }

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource('Pexels');
      setIsSearchingImages(false);
      return;
    }

    // 3. Wikimedia Commons (CORS directo)
    try {
      results = await searchWikimedia(query);
    } catch (err) {
      console.error('[kiosko] Wikimedia falló:', err);
    }

    setIsSearchingImages(false);

    if (results && results.length > 0) {
      setImageResults(results);
      setImageSource('Wikimedia');
      return;
    }

    setImageSearchError(
      'No se pudieron cargar las sugerencias. Verificá tu conexión. Si la app corre como build de producción, iniciá "npm run dev" para habilitar la búsqueda de Pexels (Open Food Facts y Wikimedia funcionan igual).'
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.price || formData.stock === '') return;

    onSave({
      ...formData,
      price: Number(formData.price),
      stock: Number(formData.stock),
      sizeValue: formData.sizeValue === '' ? '' : Number(formData.sizeValue),
      category: newCatInput.trim() ? newCatInput.trim() : formData.category
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden z-10 animate-scale-up">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {productToEdit ? 'Editar Producto' : 'Crear Nuevo Producto'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl">
            <Icon name="x" className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre del Producto *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Chocolate Semi Amargo"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Marca (Opcional)</label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              placeholder="Ej: Quilmes, La Serenísima, Milka..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalles sobre ingredientes, tamaño, etc."
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Precio ($ ARS) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="1500"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Stock Disponible *</label>
              <input
                type="number"
                required
                min="0"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                placeholder="20"
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Tamaño del Producto</label>
            <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-slate-800 border border-slate-700 mb-3">
              <button
                type="button"
                onClick={() => setSizeType('liquid')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  sizeType === 'liquid'
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                🥤 Líquido / Bebida
              </button>
              <button
                type="button"
                onClick={() => setSizeType('solid')}
                className={`py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  sizeType === 'solid'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                📦 Sólido
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                min="0"
                step="any"
                value={formData.sizeValue}
                onChange={(e) => setFormData({ ...formData, sizeValue: e.target.value })}
                placeholder={sizeType === 'liquid' ? 'Ej: 500' : 'Ej: 200'}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              />
              <select
                value={formData.sizeUnit}
                onChange={(e) => setFormData({ ...formData, sizeUnit: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
              >
                {sizeUnits.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none mb-2"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="text"
              value={newCatInput}
              onChange={(e) => setNewCatInput(e.target.value)}
              placeholder="O escribe una nueva categoría aquí..."
              className="w-full px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">URL de Imagen</label>
            <input
              type="url"
              value={formData.image}
              onChange={(e) => setFormData({ ...formData, image: e.target.value })}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-sm focus:border-teal-500 focus:outline-none"
            />
            {formData.image && (
              <div className="mt-2">
                <img
                  src={formData.image}
                  alt="Preview del producto"
                  className="w-28 h-28 rounded-xl object-cover border border-slate-700 bg-slate-900"
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={searchImages}
              disabled={isSearchingImages}
              className="w-full py-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold text-xs hover:bg-cyan-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Icon name="search" className="w-4 h-4" />
              {isSearchingImages ? 'Buscando sugerencias...' : 'Sugerir imágenes de la web'}
            </button>
            {imageSearchError && (
              <p className="text-xs text-rose-400 mt-2">{imageSearchError}</p>
            )}
            {imageResults.length > 0 && (
              <div className="mt-3">
                <span className="text-[11px] text-slate-400 font-semibold block mb-2">
                  Sugerencias para:{' '}
                  <span className="text-cyan-300">
                    {[formData.brand, formData.name, formData.category].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {imageResults.map((img) => (
                    <button
                      key={img.id}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, image: img.full }))}
                      title={`Foto por ${img.photographer}`}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${
                        formData.image === img.full
                          ? 'border-teal-400 shadow-lg shadow-teal-500/30 scale-105'
                          : 'border-slate-700 hover:border-teal-500/50'
                      }`}
                    >
                      <img
                        src={img.thumb}
                        alt={`Sugerencia: ${img.photographer}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      {formData.image === img.full && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center">
                          <Icon name="check" className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-500 mt-2">
                  {imageSource === 'Wikimedia' ? (
                    <>
                      Imágenes de{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        Wikimedia Commons
                      </a>{' '}
                      (licencias CC).
                    </>
                  ) : imageSource.includes('Open') ? (
                    <>
                      Fotos del producto real de{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        {imageSource}
                      </a>{' '}
                      (CC BY-SA). Hacé clic en una miniatura para usarla.
                    </>
                  ) : (
                    <>
                      Fotografías por{' '}
                      <a
                        href={imageResults.find((i) => i.full === formData.image)?.page}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-slate-300"
                      >
                        Pexels
                      </a>
                      . Hacé clic en una miniatura para usarla.
                    </>
                  )}
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 mt-4 rounded-2xl bg-teal-500 text-slate-950 font-bold text-sm hover:bg-teal-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
          >
            <Icon name="check" className="w-5 h-5" />
            <span>Guardar Producto</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ product, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4 animate-scale-up">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
          <Icon name="alertTriangle" className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">¿Eliminar producto?</h3>
          <p className="text-xs text-slate-400 mt-1">
            Estás a punto de borrar <strong className="text-slate-200">{product.name}</strong> del catálogo. Esta acción no se puede deshacer.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onClose}
            className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 shadow-lg shadow-rose-500/20"
          >
            Sí, Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

