export const INITIAL_CATEGORIES = ['Comida', 'Confitería', 'Bebidas', 'Higiene', 'Lácteos'];

export const INITIAL_PRODUCTS = [
  {
    id: 'p1',
    code: 'COM-001',
    name: 'Sándwich Jamón y Queso Especial',
    brand: 'Kiosco',
    description: 'Pan artesanal de miga con doble capa de queso gouda fresco, jamón cocido seleccionado y manteca fina.',
    price: 3200,
    category: 'Comida',
    stock: 14,
    sizeValue: 250,
    sizeUnit: 'g',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'p2',
    code: 'COM-002',
    name: 'Empanada de Carne Criolla',
    brand: 'Kiosco',
    description: 'Empanada horneada rellena de carne cortada a cuchillo con cebolla, pimentón y aceituna.',
    price: 1800,
    category: 'Comida',
    stock: 25,
    sizeValue: 90,
    sizeUnit: 'g',
    image: 'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'p3',
    code: 'CNF-001',
    name: 'Alfajor Triple Dulce de Leche',
    brand: 'Cachafaz',
    description: 'Tres tapas de galleta suave bañadas en chocolate semiamargo y abundante dulce de leche repostero.',
    price: 1200,
    category: 'Confitería',
    stock: 3,
    sizeValue: 70,
    sizeUnit: 'g',
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'p4',
    code: 'CNF-002',
    name: 'Chocolate con Avellanas 80g',
    brand: 'Milka',
    description: 'Barra de chocolate de leche alpino con avellanas europeas tostadas y crocantes.',
    price: 2500,
    category: 'Confitería',
    stock: 18,
    sizeValue: 80,
    sizeUnit: 'g',
    image: 'https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'p5',
    code: 'BEB-001',
    name: 'Gaseosa Cola 500ml',
    brand: 'Coca-Cola',
    description: 'Bebida refrescante sabor cola helada en botella individual R-PET.',
    price: 1500,
    category: 'Bebidas',
    stock: 32,
    sizeValue: 500,
    sizeUnit: 'ml',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'p6',
    code: 'BEB-002',
    name: 'Agua Mineral Sin Gas 600ml',
    brand: 'Villavicencio',
    description: 'Agua pura de manantial naturalmente filtrada en las sierras.',
    price: 1100,
    category: 'Bebidas',
    stock: 40,
    sizeValue: 600,
    sizeUnit: 'ml',
    image: 'https://images.unsplash.com/photo-1560023907-5f3132d1e028?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'p7',
    code: 'HIG-001',
    name: 'Alcohol en Gel Sanitizante 100ml',
    brand: 'Bac',
    description: 'Gel antiséptico para manos con aloe vera humectante. Elimina 99.9% de gérmenes.',
    price: 950,
    category: 'Higiene',
    stock: 2,
    sizeValue: 100,
    sizeUnit: 'ml',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500&auto=format&fit=crop&q=80'
  },
  {
    id: 'p8',
    code: 'LAC-001',
    name: 'Yogur Entero de Frutilla 200g',
    brand: 'Serenísima',
    description: 'Yogur cremoso fortificado con calcio y probióticos naturales.',
    price: 1350,
    category: 'Lácteos',
    stock: 10,
    sizeValue: 200,
    sizeUnit: 'g',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=500&auto=format&fit=crop&q=80'
  }
];

const formatTimestamp = (date = new Date()) =>
  date.toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const toTimestamp = (msAgo) => formatTimestamp(new Date(Date.now() - msAgo));

export const INITIAL_ORDERS = [
  {
    id: 'ORD-9821',
    customerName: 'Lucía Fernández',
    phone: '+54 9 11 4432-8810',
    type: 'pickup',
    notes: 'Preparar en bolsa de papel por favor.',
    items: [
      { id: 'p1', name: 'Sándwich Jamón y Queso Especial', price: 3200, quantity: 2 },
      { id: 'p5', name: 'Gaseosa Cola 500ml', price: 1500, quantity: 1 }
    ],
    total: 7900,
    status: 'en_preparacion',
    timestamp: toTimestamp(1000 * 60 * 12),
    estimatedMinutes: 8
  },
  {
    id: 'ORD-9820',
    customerName: 'Martín Gomez',
    phone: '+54 9 11 5519-0023',
    type: 'delivery',
    address: 'Av. Corrientes 1420 4°B',
    items: [
      { id: 'p3', name: 'Alfajor Triple Dulce de Leche', price: 1200, quantity: 3 }
    ],
    total: 3600,
    status: 'pendiente',
    timestamp: toTimestamp(1000 * 60 * 25),
    estimatedMinutes: 15
  }
];

export const STATUS_FLOW = ['pendiente', 'en_preparacion', 'listo', 'entregado'];

// Teléfonos admin fijos (fallback compartido cliente/servidor). El servidor
// además suma los que vienen de env (ADMIN_PHONES), config o empleados añadidos.
export const ADMIN_PHONES = ['04129862577', '04141823718', '04242980404', '04242963490'];

export const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_preparacion: 'En Preparación',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado'
};

export const formatSize = (product) => {
  if (!product || product.sizeValue === undefined || product.sizeValue === null || product.sizeValue === '') return '';
  const num = Number(product.sizeValue);
  const formatted = Number.isInteger(num) ? String(num) : num.toLocaleString('es-AR');
  return `${formatted}${product.sizeUnit || ''}`;
};

export { formatTimestamp };
