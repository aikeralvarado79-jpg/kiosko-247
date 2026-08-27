import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { api } from '../../api.js';
import { formatUsd, formatBs, usdToBs } from '../../utils/format.js';
import { normalizePhoneDigits, formatPhoneWhatsApp } from '../../utils/phone.js';
import { parseOrderDate, toYMD, haversineKm, STATUS_LABELS, STATUS_FLOW, nextOrderStatus, pickupCodeOf, needsPaymentAttention, needsPaymentValidation } from '../../utils/order.js';
import { playChime, haptic } from '../../utils/haptics.js';
import { subscribeToPush } from '../../utils/pwa.js';
import { lockBodyScroll, unlockBodyScroll } from '../../hooks/overlay.js';
import useSwipeToClose from '../../hooks/useSwipeToClose.js';

import AnimatedNumber from '../ui/AnimatedNumber.jsx';
import AdminOrderCard from './AdminOrderCard.jsx';
import AdminActiveOrders from './AdminActiveOrders.jsx';
import AdminPromos from './AdminPromos.jsx';
import AdminMostradorView from './AdminMostradorView.jsx';
import AdminInventory from './AdminInventory.jsx';
import AdminAnalytics from './AdminAnalytics.jsx';
import AdminEquipo from './AdminEquipo.jsx';
import AdminTienda from './AdminTienda.jsx';
import MapPickerModal from './MapPickerModal.jsx';
import AdminHistorialView from './AdminHistorialView.jsx';
import AdminDespachoView from './AdminDespachoView.jsx';
import AdminDeliveriesView from './AdminDeliveriesView.jsx';
import AdminBenefited from './AdminBenefited.jsx';
import FichaSheet from './FichaSheet.jsx';
import QuickMenuSheet from './QuickMenuSheet.jsx';
import RetiroVerifySheet from './RetiroVerifySheet.jsx';
import TvModeView from './TvModeView.jsx';

import { Icon, OrderStepsTimeline, DeliveriesRouteMap, ConfirmActionModal, AdminProfileView, AdminProfileModal, OverdueCollectionToast, OverdueCollectionsModal, PaymentProofModal, CreditLimitInput, BlacklistAdminView, buildAccountMessage } from '../../App.jsx';
import PaymentsAdminView from './PaymentsAdminView.jsx';
import { CounterSalesPanel } from './CounterSalesPanel.jsx';

function AdminView({
  products,
  costById = {},
  orders,
  rate,
  promos,
  onSavePromos,
  adminTab,
  setAdminTab,
  onLogout,
  refreshingDb,
  onRefreshDb,
  onOpenAddModal,
  onEditProduct,
  onDeleteProduct,
  onCounterSale,
  onUpdateOrderStatus,
  onUpdateOrderPayment,
  onUpdateCourierLocation,
  onDeleteOrder,
  allCustomers,
  onLoadCustomers,
  onToggleBenefited,
  onSetCreditLimit,
  onAddToBlacklist,
  onAddBlacklistDebt,
  collections,
  onLoadCollections,
  onUpsertCollection,
  onDeleteCollection,
  payments,
  pendingPayments,
  onLoadPayments,
  onApprovePayment,
  onRejectPayment,
  addToast,
  storeLocation,
  onSaveStoreLocation,
  adminPhone,
  adminRole,
  adminProfile,
  onChangePassword,
  onSaveAdminProfile,
  theme,
  onSetTheme,
  headerHeight
}) {
  // Order status filter state + preferencias recordadas (filtro, vista, orden
  // por antigüedad y pedidos fijados se persisten en localStorage).
  const ORDER_PREFS_KEY = 'kiosko_admin_order_prefs';
  const PINNED_KEY = 'kiosko_admin_pinned';
  const loadOrderPrefs = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(ORDER_PREFS_KEY) || '{}');
      return {
        statusFilter: raw.statusFilter || 'todos',
        ordersView: ['lista', 'despacho', 'entregas', 'historial'].includes(raw.ordersView) ? raw.ordersView : 'lista',
        productFilter: raw.productFilter || null,
        ageSortOldest: Boolean(raw.ageSortOldest)
      };
    } catch {
      return { statusFilter: 'todos', ordersView: 'lista', productFilter: null, ageSortOldest: false };
    }
  };
  const [initialOrderPrefs] = useState(loadOrderPrefs);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [confirmCancelOrder, setConfirmCancelOrder] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialOrderPrefs.statusFilter);
  const [ordersView, setOrdersView] = useState(initialOrderPrefs.ordersView); // lista | despacho | entregas | historial
  const [productFilter, setProductFilter] = useState(initialOrderPrefs.productFilter);
  const [ageSortOldest, setAgeSortOldest] = useState(initialOrderPrefs.ageSortOldest);

  // Preferencias del panel por administrador (tema, atajos, columnas visibles).
  // Se guardan en localStorage con la clave del teléfono: cada admin conserva
  // su propia configuración aunque compartan el mismo dispositivo.
  const ADMIN_PREFS_KEY = adminPhone ? `kiosko_admin_prefs_${adminPhone}` : null;
  const loadAdminPrefs = () => {
    if (!ADMIN_PREFS_KEY) return null;
    try {
      return JSON.parse(localStorage.getItem(ADMIN_PREFS_KEY) || 'null');
    } catch {
      return null;
    }
  };
  const [adminPrefs, setAdminPrefs] = useState(loadAdminPrefs);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const saveAdminPrefs = (next) => {
    const merged = { ...(adminPrefs || {}), ...next };
    setAdminPrefs(merged);
    if (ADMIN_PREFS_KEY) {
      try { localStorage.setItem(ADMIN_PREFS_KEY, JSON.stringify(merged)); } catch {}
    }
  };
  const isSuperAdmin = adminRole === 'superadmin';

  // Empleados gestionados (solo super admin) + sesiones activas.
  const [employees, setEmployees] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [newEmployeePhone, setNewEmployeePhone] = useState('');
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [usersFilter, setUsersFilter] = useState('');
  const [usersBusy, setUsersBusy] = useState(false);

  // Scroll horizontal del menú de pestañas (PC/laptop): flechas + scrollbar fino.
  const adminTabsRef = useRef(null);
  const scrollAdminTabs = (dir) => {
    const el = adminTabsRef.current;
    if (el) el.scrollBy({ left: dir * 260, behavior: 'smooth' });
  };

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const [emp, ses] = await Promise.all([api.listAdminEmployees(), api.listAdminSessions()]);
      if (emp.ok && Array.isArray(emp.data.employees)) setEmployees(emp.data.employees);
      if (ses.ok && Array.isArray(ses.data.sessions)) setActiveSessions(ses.data.sessions);
    } catch {}
    setLoadingEmployees(false);
  }, []);

  const addEmployee = async () => {
    const phone = newEmployeePhone.replace(/\D/g, '').slice(-11);
    if (phone.length < 7) {
      addToast('Ingresa un teléfono válido (7 dígitos o más)', 'error');
      return;
    }
    const res = await api.addAdminEmployee({ phone, name: newEmployeeName.trim() });
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo añadir el empleado', 'error');
      return;
    }
    addToast('Empleado añadido al panel');
    setNewEmployeePhone('');
    setNewEmployeeName('');
    loadEmployees();
  };

  const removeEmployee = async (phone) => {
    const res = await api.removeAdminEmployee(phone);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo quitar el empleado', 'error');
      return;
    }
    addToast('Empleado quitado del panel');
    loadEmployees();
  };

  const revokeSession = async (phone) => {
    const res = await api.revokeAdminSession(phone);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo cerrar la sesión', 'error');
      return;
    }
    addToast('Sesión cerrada remotamente');
    loadEmployees();
  };

  const toggleCustomerDisabled = async (customer) => {
    if (usersBusy) return;
    const next = !customer.disabled;
    setUsersBusy(true);
    const res = await api.setCustomerDisabled(customer.phone, next);
    setUsersBusy(false);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo actualizar el usuario', 'error');
      return;
    }
    addToast(next ? 'Usuario inhabilitado. No podrá pasar del login.' : 'Usuario habilitado');
    onLoadCustomers();
  };

  const deleteCustomerAccount = async (customer) => {
    if (usersBusy) return;
    if (!window.confirm(`¿Eliminar el perfil de "${customer.customerName || customer.phone}"? Esta acción no se puede deshacer.`)) return;
    setUsersBusy(true);
    const res = await api.deleteCustomer(customer.phone);
    setUsersBusy(false);
    if (!res.ok) {
      addToast(res.data.error || 'No se pudo eliminar el usuario', 'error');
      return;
    }
    addToast('Perfil eliminado del sistema');
    onLoadCustomers();
  };

  const filteredSystemUsers = (allCustomers || []).filter((c) => {
    const q = usersFilter.trim().toLowerCase();
    if (!q) return true;
    return String(c.phone).includes(q) || (c.customerName || '').toLowerCase().includes(q);
  });

  // Vista del inventario: 'lista' (tabla/tarjetas) | 'recorrido' (filas
  // horizontales estilo tienda con las opciones del admin en cada tarjeta).
  const [invView, setInvView] = useState('lista');

  // Al entrar con un admin que tiene tema propio guardado, se aplica ese tema.
  useEffect(() => {
    if (adminPrefs?.theme && theme !== adminPrefs.theme) {
      onSetTheme(adminPrefs.theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [pinnedOrders, setPinnedOrders] = useState(() => {
    try {
      const list = JSON.parse(localStorage.getItem(PINNED_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  });
  // Contador de pedidos nuevos no vistos en la pestaña de pedidos.
  const [unviewedCount, setUnviewedCount] = useState(0);
  const knownOrderIdsRef = useRef(null);
  // Historial (pedidos finalizados): filtros propios para no interferir con la
  // lista de pedidos activos.
  const [histStatus, setHistStatus] = useState('todos'); // todos | entregado | cancelado
  const [histSearch, setHistSearch] = useState('');
  const [histRange, setHistRange] = useState('7d'); // hoy | 7d | todo
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [proofOrder, setProofOrder] = useState(null);
  const [fichaOrder, setFichaOrder] = useState(null);
  // Acciones rápidas por long-press en la tarjeta de pedido (Activos).
  const [quickMenuOrder, setQuickMenuOrder] = useState(null);
  // Verificación de código de retiro antes de marcar entregado (#11).
  const [retiroVerifyOrder, setRetiroVerifyOrder] = useState(null);
  const [tvMode, setTvMode] = useState(false);
  // Bloquear scroll del body en modo TV
  useEffect(() => {
    if (!tvMode) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [tvMode]);
  // Reloj vivo de la vista Mostrador: los cronómetros de espera tickean 1/s
  // solo mientras la vista está visible.
  const [mostradorNow, setMostradorNow] = useState(() => Date.now());
  useEffect(() => {
    if ((adminTab !== 'orders' || ordersView !== 'mostrador') && !tvMode) return undefined;
    setMostradorNow(Date.now());
    const id = setInterval(() => setMostradorNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [adminTab, ordersView, tvMode]);
  // Feedback "procesando" por botón: deshabilita el control y muestra spinner
  // mientras su acción corre. Claves: st:/pay:/del:/gps: + id del pedido.
  const [busyActions, setBusyActions] = useState({});
  const busyActionsRef = useRef({});
  const runExclusive = useCallback((key, fn) => {
    if (busyActionsRef.current[key]) return;
    busyActionsRef.current[key] = true;
    setBusyActions((prev) => ({ ...prev, [key]: true }));
    Promise.resolve(fn()).finally(() => {
      busyActionsRef.current[key] = false;
      setBusyActions((prev) => ({ ...prev, [key]: false }));
    });
  }, []);
  const openFicha = (o) => {
    setFichaOrder(o);
  };
  const closeFicha = () => {
    setFichaOrder(null);
  };
  // Swipe hacia abajo para cerrar la ficha (bottom sheet en móvil).
  const fichaSheetRef = useSwipeToClose(closeFicha, Boolean(fichaOrder));

  // Mientras la ficha está abierta se bloquea el scroll de la página: solo se
  // desplaza el contenedor interno de la ficha.
  useEffect(() => {
    if (!fichaOrder) return undefined;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [fichaOrder]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [reminderPhone, setReminderPhone] = useState('');

  // Inventario: búsqueda en tiempo real + filtro por categoría + agrupación por marca
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('todas');
  const [invGroupByBrand, setInvGroupByBrand] = useState(false);
  // Stock: filtro (todas | bajo | agotado) y ordenación (stock asc | desc | sin orden).
  const [invStockFilter, setInvStockFilter] = useState('todas');
  const [invSortStock, setInvSortStock] = useState(false);
  const availOf = (p) => Math.max(0, (Number(p.stock) || 0) - (Number(p.reserved) || 0));
  const inventoryProducts = useMemo(() => products || [], [products]);
  const searchOnly = useMemo(() => {
    const q = invSearch.trim().toLowerCase();
    if (!q) return inventoryProducts;
    return inventoryProducts.filter((p) =>
      `${p.name || ''} ${p.code || ''} ${p.brand || ''} ${p.category || ''}`.toLowerCase().includes(q)
    );
  }, [inventoryProducts, invSearch]);
  const inventoryCategories = useMemo(() => {
    const cats = ['todas'];
    inventoryProducts.forEach((p) => {
      if (p.category && !cats.includes(p.category)) cats.push(p.category);
    });
    return cats;
  }, [inventoryProducts]);
  const catCount = useCallback(
    (c) => (c === 'todas' ? searchOnly.length : searchOnly.filter((p) => p.category === c).length),
    [searchOnly]
  );
  const filteredProducts = useMemo(() => {
    let list = invCategory === 'todas' ? searchOnly : searchOnly.filter((p) => p.category === invCategory);
    if (invStockFilter === 'agotado') {
      list = list.filter((p) => availOf(p) <= 0);
    } else if (invStockFilter === 'bajo') {
      list = list.filter((p) => {
        const a = availOf(p);
        return a > 0 && a <= 5;
      });
    }
    if (invSortStock) {
      list = [...list].sort((a, b) => {
        const d = availOf(a) - availOf(b);
        if (d !== 0) return invSortStock === 'asc' ? d : -d;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
    }
    return list;
  }, [searchOnly, invCategory, invStockFilter, invSortStock]);
  const groupedByBrand = useMemo(() => {
    if (!invGroupByBrand) return [];
    const map = {};
    filteredProducts.forEach((p) => {
      const br = (p.brand || 'Sin marca').trim() || 'Sin marca';
      (map[br] = map[br] || []).push(p);
    });
    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((br) => ({ brand: br, items: map[br] }));
  }, [filteredProducts, invGroupByBrand]);

  // Agrupa los productos filtrados por categoría para la góndola del recorrido
  // (misma forma que groupedByBrand, pero por categoría).
  const inventoryProductsByCategory = () => {
    const map = {};
    filteredProducts.forEach((p) => {
      const c = p.category || 'Otros';
      (map[c] = map[c] || []).push(p);
    });
    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ key: c, label: c, items: map[c] }));
  };
  const clearInvFilters = () => {
    setInvSearch('');
    setInvCategory('todas');
    setInvStockFilter('todas');
    setInvSortStock(false);
  };


  const handlePushBroadcast = async () => {
    if (!broadcastTitle.trim()) return;
    const res = await api.pushBroadcast(broadcastTitle.trim(), broadcastBody.trim());
    if (res.ok) {
      addToast(`Promoción enviada a ${res.data.sent || 0} dispositivo(s)`, 'success');
      setBroadcastTitle('');
      setBroadcastBody('');
    } else {
      addToast(res.data?.error || 'No se pudo enviar la notificación', 'error');
    }
  };

  const handlePushTest = async () => {
    const phone = (reminderPhone || adminPhone || '').trim();
    if (!phone) {
      addToast('Escribe tu teléfono para enviar la prueba', 'warning');
      return;
    }
    const res = await api.pushTest(phone, 'Notificación de prueba', 'Si ves esto, las notificaciones están funcionando.');
    if (res.ok) {
      addToast(`Prueba enviada${res.data.sent > 0 ? '' : ' (sin suscripciones activas)'}`, res.data.sent > 0 ? 'success' : 'warning');
    } else {
      addToast(res.data?.error || 'No se pudo enviar la prueba', 'error');
    }
  };

  const handlePushReminder = async () => {
    if (!reminderPhone.trim()) return;
    const res = await api.pushReminder(reminderPhone.trim());
    if (res.ok) {
      addToast(`Recordatorio enviado a ${res.data.sent || 0} dispositivo(s)`, 'success');
      setReminderPhone('');
    } else {
      addToast(res.data?.error || 'No se pudo enviar el recordatorio', 'error');
    }
  };

  const handleAdminSubscribePush = async () => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      addToast('Tu navegador no soporta notificaciones', 'error');
      return;
    }
    if (Notification.permission === 'denied') {
      addToast('Notificaciones bloqueadas. Actívalas en los ajustes del navegador', 'error');
      return;
    }
    let perm = Notification.permission;
    if (perm !== 'granted') perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      addToast('Notificaciones no activadas', 'info');
      return;
    }
    const ok = await subscribeToPush(adminPhone);
    addToast(
      ok
        ? 'Activadas. Recibirás los pedidos nuevos aunque cierres la app.'
        : 'No se pudo activar. Revisa que el teléfono del admin sea válido.',
      ok ? 'success' : 'error'
    );
  };

  // Modo Repartidor: cuando un pedido a domicilio está en "En Camino", el admin
  // (que reparte) comparte su GPS en vivo para que el cliente lo rastree.
  const [courierActive, setCourierActive] = useState(false);
  const [courierOrderId, setCourierOrderId] = useState(null);
  const courierPosRef = useRef(null);
  const courierWatchIdRef = useRef(null);

  const stopCourierTracking = () => {
    if (courierWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(courierWatchIdRef.current);
      courierWatchIdRef.current = null;
    }
    courierPosRef.current = null;
    setCourierActive(false);
    setCourierOrderId(null);
  };

  // Inicia el seguimiento GPS y lo reporta periódicamente al servidor.
  const startCourierTracking = (orderId) => {
    if (!navigator.geolocation) {
      addToast('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    setCourierActive(true);
    setCourierOrderId(orderId);
    addToast('Modo Repartidor activo: compartiendo tu ubicación en vivo', 'success');
    courierWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        courierPosRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  };

  // Reporta la posición cada 5s mientras el modo repartidor esté activo.
  const onUpdateCourierLocationRef = useRef(onUpdateCourierLocation);
  useEffect(() => {
    onUpdateCourierLocationRef.current = onUpdateCourierLocation;
  }, [onUpdateCourierLocation]);

  useEffect(() => {
    if (!courierActive || !courierOrderId) return;
    const report = () => {
      const pos = courierPosRef.current;
      if (pos) onUpdateCourierLocationRef.current?.(courierOrderId, pos.lat, pos.lng);
    };
    const timer = setInterval(report, 5000);
    return () => clearInterval(timer);
  }, [courierActive, courierOrderId]);

  // Detiene el seguimiento al desmontar el panel.
  useEffect(() => () => {
    if (courierWatchIdRef.current != null) navigator.geolocation.clearWatch(courierWatchIdRef.current);
  }, []);

  // Promos editor state
  const [promoDraft, setPromoDraft] = useState(null);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  // Cobros vencidos pendientes de enviar: mientras el panel esté abierto se
  // revisa cada 30s (y al montar) si algún cobro programado ya venció. El admin
  // decide enviarlo o descartarlo; no se envía solo. Lo descartado se olvida
  // al recargar la app, así que si estaba cerrada vuelve a aparecer.
  const [overdueList, setOverdueList] = useState([]);
  const dismissedOverdueRef = useRef([]);

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      const due = collections.filter(
        (c) => c.status === 'programado' && c.phone && new Date(c.dueAt || 0).getTime() <= now
      );
      setOverdueList(due.filter((c) => !dismissedOverdueRef.current.includes(c.id)));
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [collections]);

  const handleSendOverdue = async (c) => {
    const cust = (allCustomers || []).find((x) => normalizePhoneDigits(x.phone) === normalizePhoneDigits(c.phone)) || {
      phone: c.phone,
      customerName: c.customerName
    };
    const wa = formatPhoneWhatsApp(cust.phone);
    if (wa) {
      const msg = c.note ? `${buildAccountMessage(cust, orders)}\n\n_${c.note}_` : buildAccountMessage(cust, orders);
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    }
    const ok = await onUpsertCollection({ id: c.id, status: 'enviado' });
    if (ok) setOverdueList((prev) => prev.filter((x) => x.id !== c.id));
  };

  const handleDismissOverdue = (c) => {
    dismissedOverdueRef.current.push(c.id);
    setOverdueList((prev) => prev.filter((x) => x.id !== c.id));
  };

  // --- Mejoras operativas de la sección Pedidos ---

  // Alerta de pedido nuevo: detecta ids que antes no estaban, suena y avisa con
  // un toast (si el panel está visible) y acumula el contador de "no vistos"
  // hasta que se abre la pestaña de pedidos. La primera carga real de pedidos
  // solo siembra el conjunto para no alertar pedidos que ya existían.
  const addToastRef = useRef(addToast);
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);
  useEffect(() => {
    if (knownOrderIdsRef.current === null) {
      knownOrderIdsRef.current = orders.length > 0 ? new Set(orders.map((o) => o.id)) : null;
      return;
    }
    const prev = knownOrderIdsRef.current;
    const fresh = orders.filter((o) => !prev.has(o.id));
    knownOrderIdsRef.current = new Set(orders.map((o) => o.id));
    if (fresh.length === 0) return;
    setUnviewedCount((c) => c + fresh.length);
    const label = `${fresh.length} pedido${fresh.length !== 1 ? 's' : ''} nuevo${fresh.length !== 1 ? 's' : ''}: ${fresh.map((o) => o.id).join(', ')}`;
    playChime();
    haptic(160);
    if (document.visibilityState === 'visible') {
      addToastRef.current(label, 'info');
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const n = new Notification('Nuevo pedido', { body: label, tag: 'kiosko-new-order', renotify: true });
        n.onclick = () => window.focus();
        setTimeout(() => n.close(), 8000);
      } catch {}
    }
  }, [orders]);

  // Al abrir la pestaña de pedidos se limpia el contador de no vistos.
  useEffect(() => {
    if (adminTab === 'orders') setUnviewedCount(0);
  }, [adminTab]);

  // Preferencias de la sección Pedidos: se recuerdan entre sesiones.
  useEffect(() => {
    try {
      localStorage.setItem(ORDER_PREFS_KEY, JSON.stringify({ statusFilter, ordersView, productFilter, ageSortOldest }));
    } catch {}
  }, [statusFilter, ordersView, productFilter, ageSortOldest]);

  useEffect(() => {
    try {
      localStorage.setItem(PINNED_KEY, JSON.stringify(pinnedOrders));
    } catch {}
  }, [pinnedOrders]);

  const togglePin = (id) =>
    setPinnedOrders((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Antigüedad del pedido en minutos (semáforo de espera).
  const orderAgeMinutes = (o) => {
    const d = parseOrderDate(o);
    if (isNaN(d)) return 0;
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  };

  const semaforoOf = (o) => {
    const mins = orderAgeMinutes(o);
    const est = Number(o.estimatedMinutes) || 0;
    if (est > 0 && mins > est) {
      return { tone: 'rose', text: `${mins} min (+${mins - est})`, label: 'Supera lo estimado' };
    }
    if (mins >= 10) return { tone: 'rose', text: `${mins} min`, label: 'Espera alta' };
    if (mins >= 5) return { tone: 'amber', text: `${mins} min`, label: 'Espera media' };
    return { tone: 'emerald', text: `${mins} min`, label: 'Reciente' };
  };

  // Pedidos que incluyen un producto cuyo stock no alcanza lo pedido.
  const lowStockInOrder = useCallback(
    (o) => {
      const missing = [];
      (o.items || []).forEach((it) => {
        const p = products.find((pr) => pr.id === it.id);
        if (p && Number(p.stock) < Number(it.quantity)) {
          missing.push({ name: it.name, have: p.stock, need: it.quantity });
        }
      });
      return missing;
    },
    [products]
  );

  const lowStockOrdersCount = useMemo(
    () =>
      orders.filter(
        (o) => o.status !== 'cancelado' && o.status !== 'entregado' && lowStockInOrder(o).length > 0
      ).length,
    [orders, lowStockInOrder]
  );

  // Lista principal de PEDIDOS ACTIVOS: solo estados en curso. Los finalizados
  // (entregado / cancelado) viven en el panel de Historial, no acá.
  const ACTIVE_ORDER_STATUSES = ['pendiente', 'en_preparacion', 'listo', 'en_camino'];
  const activeStatus =
    statusFilter === 'todos' || !ACTIVE_ORDER_STATUSES.includes(statusFilter) ? 'todos' : statusFilter;
  const statusFiltered = activeStatus === 'todos'
    ? orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status))
    : orders.filter((o) => o.status === activeStatus);

  const productFilteredOrders = productFilter
    ? statusFiltered.filter((o) => o.items.some((it) => it.id === productFilter))
    : statusFiltered;

  const filteredOrders = useMemo(() => {
    const pinnedSet = new Set(pinnedOrders);
    return [...productFilteredOrders].sort((a, b) => {
      const pa = pinnedSet.has(a.id) ? 1 : 0;
      const pb = pinnedSet.has(b.id) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      if (ageSortOldest) return orderAgeMinutes(b) - orderAgeMinutes(a);
      return 0;
    });
  }, [productFilteredOrders, pinnedOrders, ageSortOldest]);

  // Historial: pedidos finalizados (entregado + cancelado) con sus propios
  // filtros de estado, rango de fechas y búsqueda. Ordenados del más reciente.
  const finalizedOrders = useMemo(
    () => orders.filter((o) => o.status === 'entregado' || o.status === 'cancelado'),
    [orders]
  );
  const orderDateVal = (o) => {
    const d = parseOrderDate(o);
    return isNaN(d) ? 0 : d.getTime();
  };
  const histFiltered = useMemo(() => {
    const q = histSearch.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOf7 = startOfToday - 6 * 86400000;
    return finalizedOrders
      .filter((o) => histStatus === 'todos' || o.status === histStatus)
      .filter((o) => {
        if (histRange === 'todo') return true;
        const t = orderDateVal(o);
        return t >= (histRange === 'hoy' ? startOfToday : startOf7);
      })
      .filter((o) => {
        if (!q) return true;
        return `${o.id} ${o.customerName || ''} ${o.phone || ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => orderDateVal(b) - orderDateVal(a));
  }, [finalizedOrders, histStatus, histSearch, histRange]);
  const histEntregados = histFiltered.filter((o) => o.status === 'entregado');
  const histCancelados = histFiltered.filter((o) => o.status === 'cancelado');
  const histRevenue = histEntregados.reduce((acc, o) => acc + (o.total || 0), 0);

  // Productos presentes en los pedidos del filtro de estado actual (para el
  // filtro rápido por producto).
  const productFilterOptions = useMemo(() => {
    const map = {};
    statusFiltered.forEach((o) =>
      o.items.forEach((it) => {
        if (!map[it.id]) map[it.id] = { id: it.id, name: it.name, count: 0 };
        map[it.id].count += 1;
      })
    );
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [statusFiltered]);

  // "Despacho vs Caja": separa lo que hay que alistar/despachar de lo que hay
  // que validar en caja (pagos digitales en revisión o rechazados).
  // Lógica por tipo:
  //  • Retiro en tienda: Iniciar → Marcar listo → Retirado (final = entregado).
  //  • Delivery: Iniciar → Marcar listo y desaparece de despacho para aparecer
  //    en Entregas (cuando queda "listo" se mueve a la pestaña Entregas).
  const isPaymentBlocked = (o) =>
    o.paymentMethod && o.paymentMethod !== 'efectivo' && o.paymentStatus === 'pendiente' && !o.credit;
  const despachoOrders = useMemo(
    () =>
      orders
        .filter((o) => !isPaymentBlocked(o) && o.paymentStatus !== 'rechazado')
        .filter((o) =>
          o.type === 'delivery'
            ? ['pendiente', 'en_preparacion'].includes(o.status)
            : ['pendiente', 'en_preparacion', 'listo'].includes(o.status)
        )
        .sort((a, b) => orderAgeMinutes(b) - orderAgeMinutes(a)),
    [orders]
  );
  const cajaOrders = useMemo(
    () =>
      orders
        .filter((o) => o.paymentMethod && o.paymentMethod !== 'efectivo')
        .filter((o) => o.paymentStatus === 'pendiente' || o.paymentStatus === 'rechazado')
        .sort((a, b) => orderAgeMinutes(b) - orderAgeMinutes(a)),
    [orders]
  );
  // Entregas del día: pedidos a domicilio listos para salir o ya en camino,
  // con su ruta sugerida (orden por cercanía desde el comercio).
  const activeDeliveries = useMemo(() => {
    const list = orders
      .filter((o) => o.type === 'delivery')
      .filter((o) => o.status === 'listo' || o.status === 'en_camino');
    const withCoords = list.filter((o) => o.lat != null && o.lng != null);
    const withoutCoords = list.filter((o) => o.lat == null || o.lng == null);
    const store = storeLocation;
    const start =
      store && store.lat != null && store.lng != null
        ? { lat: Number(store.lat), lng: Number(store.lng) }
        : null;
    const ordered = [];
    const remaining = [...withCoords];
    let cur = start;
    while (remaining.length > 0) {
      let bestIdx = 0;
      if (cur) {
        let bestDist = Infinity;
        remaining.forEach((o, i) => {
          const d = haversineKm(cur.lat, cur.lng, Number(o.lat), Number(o.lng));
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        });
      }
      const pick = remaining.splice(bestIdx, 1)[0];
      const routeKm =
        cur != null ? haversineKm(cur.lat, cur.lng, Number(pick.lat), Number(pick.lng)) : null;
      ordered.push({ ...pick, routeNumber: ordered.length + 1, routeKm });
      cur = { lat: Number(pick.lat), lng: Number(pick.lng) };
    }
    return { ordered, withoutCoords };
  }, [orders, storeLocation]);

  // Calculated Analytics
  const lowStockProducts = products.filter((p) => p.stock <= 5);
  const completedOrders = orders.filter((o) => o.status === 'entregado');
  const totalRevenue = completedOrders.reduce((acc, o) => acc + o.total, 0);
  const pendingOrders = orders.filter((o) => ['pendiente', 'en_preparacion', 'listo', 'en_camino'].includes(o.status));

  const openNewPromo = () => {
    setPromoDraft({ id: `promo-${Date.now()}`, title: '', subtitle: '', image: '', active: true });
    setIsPromoModalOpen(true);
  };

  const openEditPromo = (promo) => {
    setPromoDraft({ ...promo });
    setIsPromoModalOpen(true);
  };

  const handleSavePromo = (data) => {
    if (!data.id) return;
    const exists = promos.some((p) => p.id === data.id);
    const next = exists ? promos.map((p) => (p.id === data.id ? data : p)) : [...promos, data];
    onSavePromos(next);
    setIsPromoModalOpen(false);
    setPromoDraft(null);
  };

  const handleDeletePromo = (id) => {
    onSavePromos(promos.filter((p) => p.id !== id));
    setIsPromoModalOpen(false);
    setPromoDraft(null);
  };

  // Tendencia de ventas por día (últimos 7 días): cantidad de pedidos y ventas en $.
  const salesByDay = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        orders: 0,
        revenue: 0
      });
    }
    const map = {};
    days.forEach((d) => (map[d.key] = d));
    orders.forEach((o) => {
      const ts = o.timestamp ? new Date(o.timestamp) : null;
      const key = ts && !isNaN(ts) ? new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()).toISOString().slice(0, 10) : null;
      if (key && map[key]) {
        map[key].orders += 1;
        if (o.status === 'entregado') map[key].revenue += o.total || 0;
      }
    });
    return days;
  }, [orders]);

  // Clientes con mayor volumen de pedidos (segmentación por actividad).
  const topCustomers = useMemo(() => {
    const counts = {};
    orders.forEach((o) => {
      const key = (o.phone || 'desconocido').trim();
      counts[key] = counts[key] || { phone: key, orders: 0, revenue: 0 };
      counts[key].orders += 1;
      if (o.status === 'entregado') counts[key].revenue += o.total || 0;
    });
    return Object.values(counts)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
  }, [orders]);

  const lowStockMessage = useMemo(() => {
    if (lowStockProducts.length === 0) return '';
    const lines = lowStockProducts.slice(0, 10).map((p) => `• ${p.name}: ${p.stock} un.`);
    return `⚠️ *ALERTA DE STOCK BAJO* en Kiosko 247\n\nProductos con pocas unidades:\n${lines.join('\n')}\n\nRevisa el inventario y repón lo antes posible.`;
  }, [lowStockProducts]);

  // Pedido de reabastecimiento al proveedor: productos con stock bajo y cantidad
  // sugerida para reponer (mín. 10 unidades), listo para enviar por WhatsApp.
  const reorderMessage = useMemo(() => {
    if (lowStockProducts.length === 0) return '';
    const lines = lowStockProducts.slice(0, 15).map((p) => `• ${p.name}: ${Math.max(10, Math.ceil(p.stock * 2))} un.`);
    return `📦 *PEDIDO DE REABASTECIMIENTO — Kiosko 247*\n\nNecesito reponer:\n${lines.join('\n')}\n\nPor favor confírmame disponibilidad y precio.`;
  }, [lowStockProducts]);

  // ===== Dashboard financiero en vivo =====
  // KPIs del día (hoy y ayer) a partir de pedidos pagados/entregados.
  const finDash = useMemo(() => {
    const today = toYMD(new Date());
    const yesterday = toYMD(new Date(Date.now() - 86400000));
    const byDay = { [today]: { orders: 0, revenue: 0, cost: 0, cash: 0, digital: 0, credit: 0, tickets: 0 }, [yesterday]: { orders: 0, revenue: 0, cost: 0, cash: 0, digital: 0, credit: 0, tickets: 0 } };
    const todayItems = {};
    orders.forEach((o) => {
      const day = toYMD(parseOrderDate(o));
      if (!byDay[day]) return;
      const isSale = o.status === 'entregado';
      if (o.status !== 'cancelado') byDay[day].tickets += 1;
      if (!isSale) return;
      const total = Number(o.total) || 0;
      byDay[day].orders += 1;
      byDay[day].revenue += total;
      const items = Array.isArray(o.items) ? o.items : [];
      byDay[day].cost += items.reduce((acc, it) => acc + (it.quantity || 0) * (Number(costById[it.id]) || 0), 0);
      if (o.credit) byDay[day].credit += total;
      else if (o.paymentMethod === 'efectivo') byDay[day].cash += total;
      else byDay[day].digital += total;
      if (day === today) {
        items.forEach((it) => {
          todayItems[it.id] = (todayItems[it.id] || 0) + it.quantity;
        });
      }
    });
    const t = byDay[today];
    const y = byDay[yesterday];
    const topToday = Object.entries(todayItems)
      .map(([id, quantity]) => {
        const p = products.find((prod) => prod.id === id);
        const cost = Number(costById[id]) || 0;
        const unitRevenue = p ? Number(p.price) || 0 : 0;
        return p
          ? { ...p, quantity, cost, unitRevenue, marginUnit: unitRevenue - cost, margin: quantity * (unitRevenue - cost) }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);
    return {
      today: t,
      yesterday: y,
      grossProfit: t.revenue - t.cost,
      grossMarginPct: t.revenue > 0 ? ((t.revenue - t.cost) / t.revenue) * 100 : 0,
      ticketAvg: t.orders > 0 ? t.revenue / t.orders : 0,
      revenueDelta: y.revenue > 0 ? ((t.revenue - y.revenue) / y.revenue) * 100 : (t.revenue > 0 ? 100 : 0),
      ticketsDelta: y.tickets > 0 ? ((t.tickets - y.tickets) / y.tickets) * 100 : (t.tickets > 0 ? 100 : 0),
      topToday
    };
  }, [orders, products, costById]);

  // Total fiado pendiente (deuda activa de todos los clientes).
  const totalFiado = useMemo(
    () => (allCustomers || []).reduce((acc, c) => acc + Math.max(0, Number(c.balance) || 0), 0),
    [allCustomers]
  );

  // Pedidos pagados digitales pendientes de validar (caja).
  const cashDigitalTotal = useMemo(() => {
    let cash = 0;
    let digital = 0;
    completedOrders.forEach((o) => {
      if (o.credit) return;
      if (o.paymentMethod === 'efectivo') cash += Number(o.total) || 0;
      else digital += Number(o.total) || 0;
    });
    return { cash, digital };
  }, [completedOrders]);

  // ===== Kiosko Operator: resumen de jornada (cierre del día) =====
  const jornadaSummary = useMemo(() => {
    const t = finDash.today;
    const top = finDash.topToday.slice(0, 3).map((p) => `• ${p.name}: ${p.quantity} un.`).join('\n') || '• Sin ventas aún';
    const lines = [
      `📊 *RESUMEN DE JORNADA — Kiosko 247*`,
      `🗓️ Hoy, ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      ``,
      `💰 Ventas: ${formatUsd(t.revenue)} (${t.orders} entregados)`,
      `🎫 Tickets: ${t.tickets} pedidos`,
      `🧾 Ticket promedio: ${finDash.ticketAvg > 0 ? formatUsd(finDash.ticketAvg) : '—'}`,
      `💵 Efectivo: ${formatUsd(t.cash)}`,
      `📲 Digital: ${formatUsd(t.digital)}`,
      `📒 Fiado: ${formatUsd(t.credit)}`,
      `🧮 Deuda total pendiente: ${formatUsd(totalFiado)}`,
      ``,
      `🏆 Top productos:`,
      top,
      ``,
      `Comparado con ayer: ventas ${finDash.revenueDelta >= 0 ? `▲ +${finDash.revenueDelta.toFixed(0)}%` : `▼ ${finDash.revenueDelta.toFixed(0)}%`}`
    ];
    return lines.join('\n');
  }, [finDash, totalFiado]);

  // ── Vista Mostrador (#1): armado de pedidos en modo foco ────────────────
  // Tarjetas XXL ordenadas por espera, cronómetro vivo y UN botón contextual
  // por pedido (Aceptar → Listo → Despachar/Entregado). Los pagos digitales
  // por validar o rechazados viven AQUÍ con sus botones de Confirmar/Rechazar:
  // no avanzan hasta resolverse.
  const openProfile = () => {
    // En móvil el perfil es una vista completa; en escritorio, el modal clásico.
    if (window.innerWidth < 640) setAdminTab('profile');
    else setShowAdminProfile(true);
  };

  if (adminTab === 'profile') {
    return (
      <AdminProfileView
        phone={adminPhone}
        role={adminRole}
        profile={adminProfile}
        onChangePassword={onChangePassword}
        onSaveProfile={onSaveAdminProfile}
        adminPrefs={adminPrefs}
        onSavePrefs={saveAdminPrefs}
        theme={theme}
        onSetTheme={onSetTheme}
        rate={rate}
        onBack={() => setAdminTab('inventory')}
      />
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8 animate-fade-in">
      {/* Admin Top Dashboard Header */}
      <div className="flex flex-col sm:flex-row md:items-center justify-between gap-4 p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-slate-800/80 border border-slate-700/80 shadow-2xl backdrop-blur-md">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold uppercase tracking-wider">
            <Icon name="layers" className="w-3.5 h-3.5" />
            Panel Administrativo
          </span>
          <h2 className="font-display text-lg sm:text-2xl font-black text-white mt-2">Control de Inventario y Ventas</h2>
          <p className="text-xs text-slate-400 mt-1">Gestiona tus productos en tiempo real y atiende pedidos entrantes.</p>

          {/* Identidad del admin logueado: avatar, nombre, rol. Abre el perfil. */}
          <button
            onClick={openProfile}
            className="mt-3 inline-flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-2xl bg-slate-900/60 border border-slate-700/80 hover:border-teal-500/50 hover:bg-slate-900 transition-all group"
            title="Abrir mi perfil de administrador"
          >
            {adminProfile?.photo ? (
              <img
                src={adminProfile.photo}
                alt={adminProfile.name || 'Admin'}
                className="w-9 h-9 rounded-xl object-cover bg-slate-800 border border-slate-600/60 shrink-0"
              />
            ) : (
              <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-teal-400 text-slate-950 text-sm font-black flex items-center justify-center shrink-0">
                {(adminProfile?.name || 'A').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-left min-w-0">
              <span className="block text-xs font-bold text-white truncate max-w-40">
                {adminProfile?.name || (adminPhone ? `Admin ${adminPhone.slice(-4)}` : 'Administrador')}
              </span>
              <span className="block text-[10px] text-slate-400 truncate">
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                    <Icon name="star" className="w-3 h-3" /> Super Admin
                  </span>
                ) : (
                  adminPhone
                )}
              </span>
            </span>
            <Icon name="chevronRight" className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={openProfile}
            className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-teal-300 hover:border-teal-500/40 transition-all flex items-center justify-center gap-2"
            title="Perfil del administrador y preferencias"
          >
            <Icon name="user" className="w-4 h-4" />
            <span className="hidden sm:inline">Mi Perfil</span>
          </button>
          <button
            onClick={onOpenAddModal}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-sm hover:from-teal-400 hover:to-cyan-400 shadow-lg shadow-teal-500/20 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Icon name="plus" className="w-5 h-5" />
            <span>Nuevo Producto</span>
          </button>
          {window.location.hostname === 'kiosko-247-staging.onrender.com' && (
            <button
              onClick={() => setConfirmRefresh(true)}
              disabled={refreshingDb}
              className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-teal-300 hover:border-teal-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              title="Copiar datos de producción hacia calidad (reemplaza el contenido actual de calidad)"
            >
              <Icon name="refresh" className="w-4 h-4" />
              <span className="hidden sm:inline">{refreshingDb ? 'Refrescando…' : 'Refrescar datos'}</span>
            </button>
          )}
          <button
            onClick={onLogout}
            className="px-3 sm:px-4 py-3 rounded-2xl bg-slate-900/70 border border-slate-700 text-slate-300 font-bold text-sm hover:text-rose-300 hover:border-rose-500/40 transition-all flex items-center justify-center gap-2"
            title="Cerrar sesión"
          >
            <Icon name="x" className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
</div>

      {confirmRefresh && (
        <ConfirmActionModal
          title="¿Reemplazar los datos de calidad?"
          message="Se copiará una muestra de producción sobre esta base. Todo lo que cambió en calidad se perderá."
          note="Esta acción no se puede deshacer."
          confirmLabel="Reemplazar"
          onConfirm={() => {
            setConfirmRefresh(false);
            onRefreshDb();
          }}
          onClose={() => setConfirmRefresh(false)}
        />
      )}

      {confirmCancelOrder && (
        <ConfirmActionModal
          title="¿Cancelar este pedido?"
          message="El pedido se marcará como cancelado, se devolverá el stock de sus artículos y el cliente quedará notificado."
          note="Esta acción no se puede deshacer."
          confirmLabel="Cancelar pedido"
          onConfirm={() => {
            const o = confirmCancelOrder;
            setConfirmCancelOrder(null);
            onUpdateOrderStatus(o.id, 'cancelado');
          }}
          onClose={() => setConfirmCancelOrder(null)}
        />
      )}

      {/* Analytics Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-teal-500/20 text-teal-400">
            <Icon name="package" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Total Productos</span>
            <AnimatedNumber value={products.length} className="text-xl sm:text-2xl font-black text-white tabular-nums" />
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-500/20 text-amber-400">
            <Icon name="alertTriangle" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Stock Bajo</span>
            <AnimatedNumber value={lowStockProducts.length} className="text-xl sm:text-2xl font-black text-amber-400 tabular-nums" />
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-cyan-500/20 text-cyan-400">
            <Icon name="clock" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Pedidos Activos</span>
            <AnimatedNumber value={pendingOrders.length} className="text-xl sm:text-2xl font-black text-cyan-400 tabular-nums" />
          </div>
        </div>

        <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-500/20 text-emerald-400">
            <Icon name="dollarSign" className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-xs text-slate-400 font-medium block">Ingresos</span>
            <AnimatedNumber
              value={totalRevenue}
              format={(v) => formatUsd(v)}
              className="text-lg sm:text-2xl font-black text-emerald-400 truncate tabular-nums"
            />
            {rate?.rate > 0 && (
              <span className="hidden sm:block text-[11px] text-slate-400 font-semibold">
                {formatBs(usdToBs(totalRevenue, rate.rate))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Admin Tabs: scroll horizontal con flechas en desktop (móvil desplaza
          por gesto) */}
      <div className="flex items-center border-b border-slate-800">
        <button
          onClick={() => scrollAdminTabs(-1)}
          aria-label="Anterior pestaña"
          className="hidden md:flex shrink-0 items-center justify-center w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition-all cursor-pointer"
        >
          <Icon name="chevronLeft" className="w-4 h-4" />
        </button>
        <div
          ref={adminTabsRef}
          className="flex items-center flex-1 gap-4 sm:gap-6 overflow-x-auto tabs-scroll-x -mx-3 sm:mx-0 px-3 sm:px-0"
        >
          {[
            { key: 'inventory', label: 'Inventario', full: 'Inventario de Productos', icon: 'package' },
            { key: 'ventas', label: 'Ventas', full: 'Venta en Mostrador', icon: 'shoppingBag' },
            { key: 'orders', label: `Pedidos (${pendingOrders.length})`, full: `Pedidos en Vivo (${pendingOrders.length})`, icon: 'clock' },
            { key: 'promos', label: 'Promos', full: 'Promos de Tienda', icon: 'sparkles' },
            { key: 'benefited', label: 'Beneficiados', full: 'Clientes Beneficiados', icon: 'users' },
            { key: 'blacklist', label: 'Lista Negra', full: 'Lista Negra (Deudores)', icon: 'alertTriangle' },
            { key: 'abonos', label: `Abonos (${pendingPayments})`, full: `Abonos por Aprobar (${pendingPayments})`, icon: 'wallet' },
            { key: 'tienda', label: 'Tienda', full: 'Ubicación del Comercio', icon: 'store' },
            { key: 'analytics', label: 'Finanzas', full: 'Finanzas & Métricas', icon: 'trendingUp' },
            ...(isSuperAdmin ? [{ key: 'equipo', label: 'Equipo', full: 'Equipo y Sesiones Activas', icon: 'users' }] : [])
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'benefited' || tab.key === 'blacklist') onLoadCustomers();
                if (tab.key === 'blacklist') onLoadCollections();
                if (tab.key === 'abonos') onLoadPayments();
                if (tab.key === 'equipo') loadEmployees();
                setAdminTab(tab.key);
              }}
              className={`pb-3 sm:pb-4 text-xs sm:text-sm font-bold flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all whitespace-nowrap shrink-0 ${
                adminTab === tab.key
                  ? 'border-teal-400 text-teal-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon name={tab.icon} className="w-4 h-4" />
              <span className="sm:hidden">{tab.label}</span>
              <span className="hidden sm:inline">{tab.full}</span>
              {tab.key === 'orders' && unviewedCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black leading-none shrink-0">
                  {unviewedCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => scrollAdminTabs(1)}
          aria-label="Siguiente pestaña"
          className="hidden md:flex shrink-0 items-center justify-center w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-teal-300 hover:border-teal-500/40 transition-all cursor-pointer"
        >
          <Icon name="chevronRight" className="w-4 h-4" />
        </button>
      </div>

      {/* Venta en mostrador: el admin escanea o toca productos y registra la
          venta física como pedido pickup entregado y pagado. */}
      {adminTab === 'ventas' && (
        <CounterSalesPanel
          products={products}
          orders={orders}
          onCounterSale={onCounterSale}
          addToast={addToast}
        />
      )}

      {/* Tab 1: Inventory Management */}
      {adminTab === 'inventory' && (
        <AdminInventory
          products={products}
          rate={rate}
          lowStockProducts={lowStockProducts}
          reorderMessage={reorderMessage}
          headerHeight={headerHeight}
          invSearch={invSearch}
          setInvSearch={setInvSearch}
          invStockFilter={invStockFilter}
          setInvStockFilter={setInvStockFilter}
          invSortStock={invSortStock}
          setInvSortStock={setInvSortStock}
          invGroupByBrand={invGroupByBrand}
          setInvGroupByBrand={setInvGroupByBrand}
          invView={invView}
          setInvView={setInvView}
          invCategory={invCategory}
          setInvCategory={setInvCategory}
          filteredProducts={filteredProducts}
          groupedByBrand={groupedByBrand}
          inventoryCategories={inventoryCategories}
          catCount={catCount}
          clearInvFilters={clearInvFilters}
          inventoryProductsByCategory={inventoryProductsByCategory}
          onEditProduct={onEditProduct}
          onDeleteProduct={onDeleteProduct}
        />
      )}

      {/* Tab 2: Orders */}
      {adminTab === 'orders' && (
        <div className="space-y-4">
          {/* Vista operativa: Activos / Despacho·Caja / Entregas / Historial */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
            {[
              { key: 'mostrador', label: 'Mostrador', icon: 'store' },
              { key: 'lista', label: 'Activos', icon: 'clock' },
              { key: 'despacho', label: 'Despacho / Caja', icon: 'package' },
              { key: 'entregas', label: 'Entregas (ruta)', icon: 'mapPin' },
              { key: 'historial', label: 'Historial', icon: 'list' }
            ].map((v) => (
              <button
                key={v.key}
                onClick={() => {
                  if (v.key === 'lista' && (statusFilter === 'entregado' || statusFilter === 'cancelado')) {
                    setStatusFilter('todos');
                  }
                  setOrdersView(v.key);
                }}
                className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap border transition-all shrink-0 flex items-center gap-1.5 ${
                  ordersView === v.key
                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/80 hover:text-white'
                }`}
              >
                <Icon name={v.icon} className="w-4 h-4" />
                {v.label}
                {v.key === 'historial' && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-slate-700/80 text-[10px] font-black leading-none">
                    {finalizedOrders.length}
                  </span>
                )}
              </button>
            ))}
          </div>

            {ordersView === 'mostrador' && (
              <AdminMostradorView
                orders={orders}
                products={products}
                mostradorNow={mostradorNow}
                busyActions={busyActions}
                onRunExclusive={runExclusive}
                onUpdateOrderStatus={onUpdateOrderStatus}
                onUpdateOrderPayment={onUpdateOrderPayment}
                onSetRetiroVerify={setRetiroVerifyOrder}
                onSetProofOrder={setProofOrder}
                onOpenFicha={openFicha}
                onSetTvMode={setTvMode}
              />
            )}

          {ordersView === 'lista' && (
          <AdminActiveOrders
            orders={orders}
            ACTIVE_ORDER_STATUSES={ACTIVE_ORDER_STATUSES}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            activeStatus={activeStatus}
            lowStockOrdersCount={lowStockOrdersCount}
            productFilter={productFilter}
            setProductFilter={setProductFilter}
            productFilterOptions={productFilterOptions}
            statusFiltered={statusFiltered}
            ageSortOldest={ageSortOldest}
            setAgeSortOldest={setAgeSortOldest}
            filteredOrders={filteredOrders}
            rate={rate}
            products={products}
            pinnedOrders={pinnedOrders}
            busyActions={busyActions}
            courierOrderId={courierOrderId}
            courierActive={courierActive}
            onRunExclusive={runExclusive}
            onUpdateOrderStatus={onUpdateOrderStatus}
            onUpdateOrderPayment={onUpdateOrderPayment}
            onDeleteOrder={onDeleteOrder}
            onTogglePin={togglePin}
            onOpenFicha={openFicha}
            onSetQuickMenu={setQuickMenuOrder}
            onSetProofOrder={setProofOrder}
            onSetConfirmCancel={setConfirmCancelOrder}
            onStopCourierTracking={stopCourierTracking}
            onStartCourierTracking={startCourierTracking}
          />
          )}

          {/* Vista Despacho / Caja: separa lo que hay que alistar de lo que hay que validar */}
          {ordersView === 'despacho' && (
            <AdminDespachoView
              despachoOrders={despachoOrders}
              cajaOrders={cajaOrders}
              semaforoOf={semaforoOf}
              lowStockInOrder={lowStockInOrder}
              OrderStepsTimeline={OrderStepsTimeline}
              onUpdateOrderStatus={onUpdateOrderStatus}
              onUpdateOrderPayment={onUpdateOrderPayment}
              onSetProofOrder={setProofOrder}
              onOpenFicha={openFicha}
            />
          )}

          {/* Vista Entregas: ruta del día ordenada por cercanía */}
          {ordersView === 'entregas' && (
            <AdminDeliveriesView
              activeDeliveries={activeDeliveries}
              courierOrderId={courierOrderId}
              courierActive={courierActive}
              onOpenFicha={openFicha}
              onUpdateOrderStatus={onUpdateOrderStatus}
              onStartCourierTracking={startCourierTracking}
              onStopCourierTracking={stopCourierTracking}
              storeLocation={storeLocation}
              DeliveriesRouteMap={DeliveriesRouteMap}
            />
          )}

          {/* Vista Historial: pedidos finalizados (entregado + cancelado) */}
          {ordersView === 'historial' && (
            <AdminHistorialView
              finalizedOrders={finalizedOrders}
              histFiltered={histFiltered}
              histEntregados={histEntregados}
              histCancelados={histCancelados}
              histRevenue={histRevenue}
              histStatus={histStatus}
              setHistStatus={setHistStatus}
              histSearch={histSearch}
              setHistSearch={setHistSearch}
              histRange={histRange}
              setHistRange={setHistRange}
              rate={rate}
              onOpenFicha={openFicha}
              onDeleteOrder={onDeleteOrder}
            />
          )}
        </div>
      )}

      {/* Tab 3: Promos */}
      {adminTab === 'promos' && (
        <AdminPromos
          promos={promos}
          openNewPromo={openNewPromo}
          openEditPromo={openEditPromo}
          onSavePromos={onSavePromos}
          adminPhone={adminPhone}
          handleAdminSubscribePush={handleAdminSubscribePush}
          broadcastTitle={broadcastTitle}
          setBroadcastTitle={setBroadcastTitle}
          broadcastBody={broadcastBody}
          setBroadcastBody={setBroadcastBody}
          handlePushBroadcast={handlePushBroadcast}
          handlePushTest={handlePushTest}
          reminderPhone={reminderPhone}
          setReminderPhone={setReminderPhone}
          handlePushReminder={handlePushReminder}
          isPromoModalOpen={isPromoModalOpen}
          setIsPromoModalOpen={setIsPromoModalOpen}
          promoDraft={promoDraft}
          setPromoDraft={setPromoDraft}
          handleSavePromo={handleSavePromo}
          handleDeletePromo={handleDeletePromo}
        />
      )}

      {/* Tab 4: Beneficiados */}
      {adminTab === 'benefited' && (
        <AdminBenefited allCustomers={allCustomers} onLoadCustomers={onLoadCustomers} onToggleBenefited={onToggleBenefited} onSetCreditLimit={onSetCreditLimit} CreditLimitComponent={CreditLimitInput} />
      )}

      {/* Tab 5: Lista Negra */}
      {adminTab === 'blacklist' && (
        <BlacklistAdminView
          customers={allCustomers}
          orders={orders}
          rate={rate}
          products={products}
          payments={payments}
          onLoadCustomers={onLoadCustomers}
          onAddToBlacklist={onAddToBlacklist}
          onAddBlacklistDebt={onAddBlacklistDebt}
          collections={collections}
          onUpsertCollection={onUpsertCollection}
          onDeleteCollection={onDeleteCollection}
          headerHeight={headerHeight}
        />
      )}

      {/* Tab: Abonos — pagos a cuenta que los clientes subieron para aprobar */}
      {adminTab === 'abonos' && (
        <PaymentsAdminView
          payments={payments}
          onLoadPayments={onLoadPayments}
          onApprovePayment={onApprovePayment}
          onRejectPayment={onRejectPayment}
        />
      )}

      {/* Tab: Tienda — ubicación fija del comercio */}
      {adminTab === 'tienda' && (
        <AdminTienda
          storeLocation={storeLocation}
          showStorePicker={showStorePicker}
          setShowStorePicker={setShowStorePicker}
          MapPickerModal={MapPickerModal}
          onSaveStoreLocation={onSaveStoreLocation}
        />
      )}

      {/* Tab 6: Analytics / Finanzas */}
      {adminTab === 'analytics' && (
        <AdminAnalytics
          finDash={finDash}
          totalFiado={totalFiado}
          cashDigitalTotal={cashDigitalTotal}
          salesByDay={salesByDay}
          topCustomers={topCustomers}
          allCustomers={allCustomers}
          lowStockProducts={lowStockProducts}
          lowStockMessage={lowStockMessage}
          jornadaSummary={jornadaSummary}
        />
      )}
      {isSuperAdmin && adminTab === 'equipo' && (
        <AdminEquipo
          activeSessions={activeSessions}
          loadingEmployees={loadingEmployees}
          employees={employees}
          adminPhone={adminPhone}
          allCustomers={allCustomers}
          filteredSystemUsers={filteredSystemUsers}
          usersFilter={usersFilter}
          setUsersFilter={setUsersFilter}
          usersBusy={usersBusy}
          onLoadEmployees={loadEmployees}
          onRevokeSession={revokeSession}
          onAddEmployee={addEmployee}
          onRemoveEmployee={removeEmployee}
          onToggleCustomerDisabled={toggleCustomerDisabled}
          onDeleteCustomerAccount={deleteCustomerAccount}
          onLoadCustomers={onLoadCustomers}
          newEmployeeName={newEmployeeName}
          setNewEmployeeName={setNewEmployeeName}
          newEmployeePhone={newEmployeePhone}
          setNewEmployeePhone={setNewEmployeePhone}
        />
      )}
      {overdueList.length === 1 && (
        <OverdueCollectionToast
          collection={overdueList[0]}
          onSend={() => handleSendOverdue(overdueList[0])}
          onDismiss={() => handleDismissOverdue(overdueList[0])}
        />
      )}
      {overdueList.length > 1 && (
        <OverdueCollectionsModal
          collections={overdueList}
          onSend={handleSendOverdue}
          onDismiss={handleDismissOverdue}
        />
      )}

      {proofOrder && (
        <PaymentProofModal
          order={proofOrder}
          onClose={() => setProofOrder(null)}
          onUpdateOrderPayment={onUpdateOrderPayment}
        />
      )}

      <FichaSheet
        fichaOrder={fichaOrder}
        closeFicha={closeFicha}
        headerHeight={headerHeight}
        fichaSheetRef={fichaSheetRef}
        OrderStepsTimeline={OrderStepsTimeline}
        AdminOrderCard={AdminOrderCard}
        rate={rate}
        products={products}
        pinnedOrders={pinnedOrders}
        busyActions={busyActions}
        courierOrderId={courierOrderId}
        courierActive={courierActive}
        onRunExclusive={runExclusive}
        onUpdateOrderStatus={onUpdateOrderStatus}
        onUpdateOrderPayment={onUpdateOrderPayment}
        onDeleteOrder={onDeleteOrder}
        onTogglePin={togglePin}
        onOpenFicha={openFicha}
        onSetQuickMenu={setQuickMenuOrder}
        onSetProofOrder={setProofOrder}
        onSetConfirmCancel={setConfirmCancelOrder}
        onStopCourierTracking={stopCourierTracking}
        onStartCourierTracking={startCourierTracking}
      />
      <QuickMenuSheet
        quickMenuOrder={quickMenuOrder}
        setQuickMenuOrder={setQuickMenuOrder}
        STATUS_LABELS={STATUS_LABELS}
        nextOrderStatus={nextOrderStatus}
        needsPaymentValidation={needsPaymentValidation}
        busyActions={busyActions}
        onRunExclusive={runExclusive}
        onUpdateOrderStatus={onUpdateOrderStatus}
        openFicha={openFicha}
      />
      <RetiroVerifySheet
        retiroVerifyOrder={retiroVerifyOrder}
        setRetiroVerifyOrder={setRetiroVerifyOrder}
        pickupCodeOf={pickupCodeOf}
        busyActions={busyActions}
        onRunExclusive={runExclusive}
        onUpdateOrderStatus={onUpdateOrderStatus}
      />
      <TvModeView
        orders={orders}
        tvMode={tvMode}
        setTvMode={setTvMode}
        mostradorNow={mostradorNow}
        parseOrderDate={parseOrderDate}
        needsPaymentAttention={needsPaymentAttention}
        STATUS_LABELS={STATUS_LABELS}
        STATUS_FLOW={STATUS_FLOW}
        busyActions={busyActions}
        onRunExclusive={runExclusive}
        onUpdateOrderStatus={onUpdateOrderStatus}
      />
      {showAdminProfile && (
        <AdminProfileModal
          phone={adminPhone}
          role={adminRole}
          profile={adminProfile}
          onClose={() => setShowAdminProfile(false)}
          onChangePassword={onChangePassword}
          onSaveProfile={onSaveAdminProfile}
          adminPrefs={adminPrefs}
          onSavePrefs={saveAdminPrefs}
          theme={theme}
          onSetTheme={onSetTheme}
          rate={rate}
        />
      )}
    </div>
  );
}
export default AdminView;
