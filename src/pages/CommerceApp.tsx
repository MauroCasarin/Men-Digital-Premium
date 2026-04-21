import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UtensilsCrossed, Clock, CheckCircle, Package, ChevronDown, ChevronUp, Settings, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order, Product } from '../types';
import { PRODUCTS } from '../constants';

const PALETTES = [
  { name: 'Clásico Dark', theme: { accent: '#FFCC00', bg: '#0A0A0A', card: '#141414' } },
  { name: 'Rojo Fuego', theme: { accent: '#EF4444', bg: '#100000', card: '#1C0000' } },
  { name: 'Azul Océano', theme: { accent: '#0EA5E9', bg: '#000A14', card: '#001428' } },
  { name: 'Verde Neón', theme: { accent: '#22C55E', bg: '#051005', card: '#0A1A0A' } },
  { name: 'Violeta Místico', theme: { accent: '#A855F7', bg: '#10051A', card: '#1A0A2E' } },
  { name: 'Dorado Elegante', theme: { accent: '#D4AF37', bg: '#0F0F0F', card: '#1A1A1A' } },
];

export default function CommerceApp() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'orders' | 'config'>('orders');
  
  const [menuItems, setMenuItems] = useState<Product[]>(PRODUCTS);
  const [businessSettings, setBusinessSettings] = useState({ alias: '', cbu: '', holder_name: '', name: 'TU NOMBRE.MENU', logo_url: '', categories: ['Menú', 'Bebidas'], hidden_categories: [] as string[], theme: { accent: '#FFCC00', bg: '#0A0A0A', card: '#141414' } });
  const [dbErrorSql, setDbErrorSql] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (businessSettings.theme) {
      document.documentElement.style.setProperty('--color-accent', businessSettings.theme.accent);
      document.documentElement.style.setProperty('--color-bg-dark', businessSettings.theme.bg);
      document.documentElement.style.setProperty('--color-card-dark', businessSettings.theme.card);
    }
  }, [businessSettings.theme]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data: menuData } = await supabase.from('menu_items').select('*').order('category', { ascending: false });
        if (menuData && menuData.length > 0) setMenuItems(menuData as Product[]);
        
        const { data: settingsData, error } = await supabase.from('business_settings').select('*').single();
        
        if (error && error.code !== 'PGRST116') throw error; // Allow 0 rows but throw others

        if (settingsData) {
          setBusinessSettings({ 
            alias: settingsData.alias || '', 
            cbu: settingsData.cbu || '',
            holder_name: settingsData.holder_name || '',
            name: settingsData.name || 'TU NOMBRE.MENU',
            logo_url: settingsData.logo_url || '',
            categories: settingsData.categories || ['Menú', 'Bebidas'],
            hidden_categories: settingsData.hidden_categories || [],
            theme: settingsData.theme || { accent: '#FFCC00', bg: '#0A0A0A', card: '#141414' }
          });
        }
        
        setDbErrorSql(null);
      } catch (err: any) {
        if (err.code === '42P01') { 
          setDbErrorSql(`CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price NUMERIC NOT NULL,
  image TEXT,
  category TEXT NOT NULL,
  is_recommendation BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS business_settings (
  id TEXT PRIMARY KEY,
  alias TEXT,
  cbu TEXT,
  holder_name TEXT,
  name TEXT,
  logo_url TEXT,
  categories JSONB DEFAULT '["Menú", "Bebidas"]'::jsonb,
  theme JSONB DEFAULT '{"accent": "#FFCC00", "bg": "#0A0A0A", "card": "#141414"}'::jsonb,
  hidden_categories JSONB DEFAULT '[]'::jsonb
);

INSERT INTO business_settings (id, alias, cbu, holder_name, name, logo_url, categories, theme, hidden_categories) VALUES ('config', '', '', '', 'TU NOMBRE.MENU', '', '["Menú", "Bebidas"]'::jsonb, '{"accent": "#FFCC00", "bg": "#0A0A0A", "card": "#141414"}'::jsonb, '[]'::jsonb) ON CONFLICT DO NOTHING;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings DISABLE ROW LEVEL SECURITY;`);
        } else if (err.message && (err.message.includes('column') || err.message.includes('No se pudo encontrar la columna'))) {
          setDbErrorSql(`ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '["Menú", "Bebidas"]'::jsonb;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS theme JSONB DEFAULT '{"accent": "#FFCC00", "bg": "#0A0A0A", "card": "#141414"}'::jsonb;
ALTER TABLE business_settings ADD COLUMN IF NOT EXISTS hidden_categories JSONB DEFAULT '[]'::jsonb;`);
        }
      }
    };
    fetchConfig();
  }, []);

  const toggleExpand = (id: string, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Safe global audio context to prevent creating too many contexts in a session
  const getCommerceAudioContext = (() => {
    let ctx: AudioContext | null = null;
    return () => {
      if (!ctx) {
        try {
          ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
          console.warn("AudioContext init failed", e);
        }
      }
      return ctx;
    };
  })();

  const playNewOrderSound = () => {
    try {
      const audioCtx = getCommerceAudioContext();
      if (!audioCtx) return;
      
      // Intentar reanudar por directrices de audio en móviles
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.warn(e));
      }
      
      const playChime = (freq: number, startTime: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine'; // Sonido dulce y resonante
        oscillator.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.5, startTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.0);
        oscillator.start(startTime);
        oscillator.stop(startTime + 1.0);
      };
      
      const t = audioCtx.currentTime;
      playChime(523.25, t);      // Do
      playChime(659.25, t + 0.1); // Mi
      playChime(783.99, t + 0.2); // Sol
      playChime(1046.50, t + 0.3); // Do octava
    } catch (e) {
      console.warn("Could not play order sound:", e);
    }
  };

  useEffect(() => {
    // 1. Fetch existing orders
    const fetchOrders = async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setOrders(data as Order[]);
      }
    };

    fetchOrders();

    // 2. Subscribe to new orders
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log("New order received!", payload.new);
          playNewOrderSound();
          setOrders((current) => [payload.new as Order, ...current]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          setOrders((current) => 
            current.map(o => o.id === payload.new.id ? (payload.new as Order) : o)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && activeTab === 'orders') {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    };

    if (activeTab === 'orders') {
      requestWakeLock();
    } else {
      if (wakeLock) wakeLock.release().catch(() => {});
    }

    return () => {
      if (wakeLock) wakeLock.release().catch(() => {});
    };
  }, [activeTab]);

  const updateOrderStatus = async (id: string, newStatus: string) => {
    let updatePayload: any = { status: newStatus };
    
    // If the commerce puts it as "completed" (Retirado), liberate the name formally
    if (newStatus === 'completed') {
      updatePayload.customer_name = ''; // "Eliminar nombre de la base de datos del CLIENTE cuando se le entrega el pedido"
    }

    const { error } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      console.error("Error updating status", error);
      alert("Error al actualizar la orden.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      case 'preparing': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'ready': return 'bg-accent/20 text-accent border-accent/50';
      case 'on_the_way': return 'bg-orange-500/20 text-orange-400 border-orange-500/50 animate-pulse ring-2 ring-orange-500';
      case 'delivered': return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'completed': return 'bg-[#222] text-gray-500 border-border-dark';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'preparing': return 'Preparando';
      case 'ready': return 'Listo';
      case 'on_the_way': return '¡En camino a retirar!';
      case 'delivered': return 'Entregado';
      case 'completed': return 'Retirado';
      default: return status;
    }
  };

  const activeOrders = orders.filter(o => !['delivered', 'completed'].includes(o.status));
  const pastOrders = orders.filter(o => ['delivered', 'completed'].includes(o.status));

  const handleProductChange = (index: number, field: keyof Product, value: any) => {
    const newItems = [...menuItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setMenuItems(newItems);
  };

  const handleAddProduct = () => {
    const newId = `new-${Math.random().toString(36).substr(2, 6)}`;
    setMenuItems([{ id: newId, name: '', description: '', price: 0, category: 'Menú', image: '', is_recommendation: false }, ...menuItems]);
  };

  const handleDeleteProduct = (id: string | number) => {
    setMenuItems(menuItems.filter(p => p.id !== id));
  };

  const saveMenuConfig = async () => {
    setIsSaving(true);
    try {
      // Save menu
      const { error: menuError } = await supabase.from('menu_items').upsert(menuItems);
      if (menuError) throw menuError;

      // Save business settings
      const { error: settsError } = await supabase.from('business_settings').upsert({ id: 'config', ...businessSettings });
      if (settsError) {
         if (settsError.message && settsError.message.includes('column')) {
            throw new Error("Missing database columns. " + settsError.message);
         }
         throw settsError;
      }

      alert("Configuración guardada correctamente.");
      setDbErrorSql(null);
    } catch (e: any) {
      console.error(e);
      if (e.code === '42P01' || (e.message && e.message.includes('Could not find the table'))) {
         alert("Tablas no encontradas. ¡Por favor copia el bloque de código SQL de color rojo y ejecútalo en Supabase!");
      } else {
         alert("Error al guardar. " + e.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm("¿Seguro que deseas eliminar el historial antiguo?")) return;
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('status', 'completed');
      
      if (error) throw error;
      alert("Historial limpiado correctamente");
    } catch (err: any) {
      console.error(err);
      alert("No se pudo limpiar el historial: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark text-white p-6 md:p-10 font-sans">
      <header className="bento-card mb-8 p-6 flex flex-col md:flex-row justify-between items-center gap-6 bg-card-dark border-border-dark">
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
          <UtensilsCrossed className="text-accent" size={32} />
          Panel de <span className="text-accent">Comercio</span>
        </h1>
        
        <div className="flex bg-[#222] p-1 rounded-2xl w-full md:w-auto overflow-hidden">
          <button 
             onClick={() => {
               // Activate AudioContext via user interaction as required by mobile browsers
               const ctx = getCommerceAudioContext();
               if (ctx && ctx.state === 'suspended') ctx.resume().catch(e => console.warn(e));
               setActiveTab('orders');
             }}
            className={`flex-1 md:w-32 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'orders' ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-gray-400 hover:text-white'}`}
          >
            Pedidos
          </button>
          <button 
             onClick={() => {
               const ctx = getCommerceAudioContext();
               if (ctx && ctx.state === 'suspended') ctx.resume().catch(e => console.warn(e));
               setActiveTab('config');
             }}
            className={`flex-1 md:w-40 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'config' ? 'bg-white text-black shadow-lg shadow-white/20' : 'text-gray-400 hover:text-white'}`}
          >
            Menú & Config
          </button>
        </div>
      </header>

      {activeTab === 'config' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {dbErrorSql && (
            <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl mb-8">
              <h3 className="text-red-500 font-bold mb-2 text-lg">⚠️ Base de datos requiere actualización</h3>
              <p className="text-sm text-red-200 mb-4">Para usar las nuevas funciones (logo, categorías editables, nombre), debes ejecutar esta consulta en el SQL Editor de Supabase (o si no existe la tabla, crearla):</p>
              <pre className="bg-[#111] p-4 rounded-xl text-xs text-gray-300 overflow-x-auto border border-[#333]">
                {dbErrorSql}
              </pre>
            </div>
          )}

          <div className="flex justify-between items-center bg-card-dark p-6 rounded-2xl border border-border-dark">
            <div>
              <h2 className="text-xl font-bold mb-1">Editor del Menú & Negocio</h2>
              <p className="text-sm text-text-dim"> Suma más categorías según productos, para cobro on line agrega tus datos.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleAddProduct} className="flex items-center gap-2 bg-[#333] hover:bg-[#444] text-white px-4 py-2 rounded-xl font-bold transition-colors">
                <Plus size={18} /> Agregar
              </button>
              <button disabled={isSaving} onClick={saveMenuConfig} className="flex items-center gap-2 bg-accent hover:bg-yellow-400 text-black px-6 py-2 rounded-xl font-bold transition-colors">
                <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Todo'}
              </button>
            </div>
          </div>

          <div className="bg-card-dark border border-border-dark p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <h3 className="text-sm font-black text-accent uppercase tracking-widest mb-4">Personalización del Menú</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Nombre del Comercio</label>
                  <input 
                    type="text" 
                    value={businessSettings.name} 
                    onChange={e => setBusinessSettings({...businessSettings, name: e.target.value})} 
                    placeholder="TU NOMBRE.MENU"
                    className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-white font-bold" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">URL del Logo (Opcional)</label>
                  <input 
                    type="text" 
                    value={businessSettings.logo_url} 
                    onChange={e => setBusinessSettings({...businessSettings, logo_url: e.target.value})} 
                    placeholder="https://..."
                    className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-gray-300 text-sm" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Categorías Creadas (Clic para ocultar/mostrar)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {businessSettings.categories.map((cat, i) => {
                      const isHidden = businessSettings.hidden_categories?.includes(cat);
                      return (
                        <span key={i} className={`font-bold px-3 py-1 rounded-full text-xs flex items-center gap-2 cursor-pointer border ${isHidden ? 'bg-[#222] text-gray-500 border-[#333] opacity-60' : 'bg-accent/20 text-accent border-accent/20'}`} onClick={() => {
                          const hidden = businessSettings.hidden_categories || [];
                          const newHidden = hidden.includes(cat) ? hidden.filter(h => h !== cat) : [...hidden, cat];
                          setBusinessSettings({...businessSettings, hidden_categories: newHidden});
                        }} title={isHidden ? 'Oculta al cliente. Clic para mostrar.' : 'Visible al cliente. Clic para ocultar.'}>
                          {cat}
                          <button onClick={(e) => { e.stopPropagation(); setBusinessSettings({...businessSettings, categories: businessSettings.categories.filter((_, idx) => idx !== i)}); }} className="hover:text-white"><Trash2 size={12}/></button>
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newCategory} 
                      onChange={e => setNewCategory(e.target.value)} 
                      placeholder="Nueva Categoría"
                      className="flex-1 bg-[#111] border border-[#333] p-2 rounded-xl focus:border-accent focus:outline-none text-white text-sm" 
                    />
                    <button 
                      onClick={() => {
                        if (newCategory.trim() && !businessSettings.categories.includes(newCategory.trim())) {
                          setBusinessSettings({...businessSettings, categories: [...businessSettings.categories, newCategory.trim()]});
                          setNewCategory('');
                        }
                      }}
                      className="bg-[#333] hover:bg-[#444] px-4 rounded-lg font-bold transition-colors shadow"
                    >
                      Sumar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-black text-accent uppercase tracking-widest mb-4">Datos de Cobro (Pagos Online)</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Nombre del Titular</label>
                  <input 
                    type="text" 
                    value={businessSettings.holder_name} 
                    onChange={e => setBusinessSettings({...businessSettings, holder_name: e.target.value})} 
                    placeholder="ej: Juan Perez"
                    className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-white font-bold" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Alias de MercadoPago / Banco</label>
                  <input 
                    type="text" 
                    value={businessSettings.alias} 
                    onChange={e => setBusinessSettings({...businessSettings, alias: e.target.value})} 
                    placeholder="ej: burger.pasion.mp"
                    className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-white font-bold" 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Número de CBU / CVU</label>
                  <input 
                    type="text" 
                    value={businessSettings.cbu} 
                    onChange={e => setBusinessSettings({...businessSettings, cbu: e.target.value})} 
                    placeholder="000000312000000..."
                    className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-white font-mono text-sm" 
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-center bg-accent/5 p-6 rounded-xl border border-accent/20">
              <p className="text-sm text-accent font-medium leading-relaxed italic">
                "Configura estos datos para que tus clientes puedan pagar por transferencia. <br/><br/>
                La IA verificará los comprobantes usando estos números y el ALIAS para asegurar que el dinero fue enviado a tu cuenta real."
              </p>
            </div>
          </div>

          <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mt-8 ml-2">Lista de Productos</h3>
          
          {businessSettings.categories.map((cat) => {
            const hasProducts = menuItems.some(p => p.category === cat);
            // Creamos un estado local temporal para el collapse. Si quisiéramos estado real convendría extraer a un componente
            return (
               <details key={cat} className="group mt-8 bg-[#1a1a1a] p-4 rounded-2xl border border-border-dark" open={false}>
                 <summary className="text-lg font-bold text-accent mb-4 p-2 bg-accent/10 rounded-lg inline-flex items-center cursor-pointer list-none select-none">
                   {cat}
                   <ChevronDown size={18} className="ml-2 transition-transform group-open:rotate-180" />
                 </summary>
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                  {menuItems.filter(p => p.category === cat).map((product) => {
                     const idx = menuItems.findIndex(p => p.id === product.id);
                     return (
                       <div key={product.id} className="bg-card-dark border border-border-dark p-6 rounded-2xl flex flex-col gap-4 relative">
                         <button onClick={() => handleDeleteProduct(product.id)} className="absolute top-4 right-4 p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors">
                           <Trash2 size={20} />
                         </button>
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Nombre del producto</label>
                             <input type="text" value={product.name} onChange={e => handleProductChange(idx, 'name', e.target.value)} className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-white font-medium" />
                           </div>
                           <div>
                              <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Categoría</label>
                               <select value={product.category} onChange={e => handleProductChange(idx, 'category', e.target.value)} className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-white font-medium">
                                 {businessSettings.categories.map((c, i) => (
                                    <option key={i} value={c}>{c}</option>
                                 ))}
                               </select>
                           </div>
                         </div>
         
                         <div className="grid grid-cols-[1fr_120px] gap-4">
                           <div>
                              <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Descripción Breve</label>
                              <input type="text" value={product.description} onChange={e => handleProductChange(idx, 'description', e.target.value)} className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-gray-300 text-sm" />
                           </div>
                           <div>
                              <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">Precio ($)</label>
                              <input type="number" step="0.01" value={product.price} onChange={e => handleProductChange(idx, 'price', parseFloat(e.target.value) || 0)} className="w-full bg-[#111] border border-[#333] p-3 rounded-xl focus:border-accent focus:outline-none text-accent font-bold" />
                           </div>
                         </div>
         
                         <div className="flex items-center gap-4 border-t border-border-dark pt-4 mt-2">
                           <div className="flex-1">
                              <label className="text-xs font-bold text-gray-500 block mb-1 uppercase tracking-wider">URL Imagen (Opcional)</label>
                              <input type="text" placeholder="/ruta-o-https://..." value={product.image || ''} onChange={e => handleProductChange(idx, 'image', e.target.value)} className="w-full bg-[#111] border border-[#333] p-2 rounded-lg focus:border-accent focus:outline-none text-gray-400 text-xs" />
                           </div>
                           <label className="flex items-center gap-2 cursor-pointer pt-4">
                             <input type="checkbox" checked={product.is_recommendation || false} onChange={e => handleProductChange(idx, 'is_recommendation', e.target.checked)} className="w-5 h-5 accent-accent" />
                             <span className="font-bold text-sm text-yellow-500">¿Recomendación?</span>
                           </label>
                         </div>
                       </div>
                     );
                  })}
                </div>
              </details>
            );
          })}

          <details className="group mt-12 bg-[#1a1a1a] p-4 rounded-2xl border border-border-dark mb-12" open={false}>
            <summary className="text-sm font-black text-gray-500 uppercase tracking-widest p-2 bg-black/20 rounded-lg inline-flex items-center cursor-pointer list-none select-none">
              Diseño y Colores
              <ChevronDown size={18} className="ml-2 transition-transform group-open:rotate-180" />
            </summary>
            
            <div className="mt-6">
               <p className="text-sm text-gray-400 mb-6">Selecciona una paleta de colores para tu menú y este panel:</p>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                 {PALETTES.map((palette, i) => (
                   <button 
                     key={i}
                     onClick={() => setBusinessSettings({...businessSettings, theme: palette.theme})}
                     className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                       businessSettings.theme?.accent === palette.theme.accent && businessSettings.theme?.bg === palette.theme.bg ? 'border-accent bg-accent/10' : 'border-[#333] hover:border-gray-500'
                     }`}
                   >
                     <div className="flex gap-2 w-full justify-center">
                       <div className="w-6 h-6 rounded-full shadow-inner border border-white/10" style={{ backgroundColor: palette.theme.accent }}></div>
                       <div className="w-6 h-6 rounded-full shadow-inner border border-white/10" style={{ backgroundColor: palette.theme.bg }}></div>
                       <div className="w-6 h-6 rounded-full shadow-inner border border-white/10" style={{ backgroundColor: palette.theme.card }}></div>
                     </div>
                     <span className="font-bold text-xs text-white">{palette.name}</span>
                   </button>
                 ))}
               </div>

               <div className="mt-8 pt-6 border-t border-[#333]">
                 <h4 className="text-xs font-bold text-gray-400 block mb-4 uppercase tracking-wider">O crea tus propios colores</h4>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                   <div>
                     <label className="text-xs font-bold text-gray-500 block mb-2 uppercase">Color de Botones (Énfasis)</label>
                     <div className="flex bg-[#111] border border-[#333] rounded-xl overflow-hidden relative p-1.5 items-center gap-3 focus-within:border-accent transition-colors">
                       <input type="color" value={businessSettings.theme?.accent || '#FFCC00'} onChange={e => setBusinessSettings({...businessSettings, theme: {...businessSettings.theme, accent: e.target.value}})} className="w-10 h-10 rounded cursor-pointer shrink-0 bg-transparent border-0" />
                       <span className="text-sm font-mono text-white">{businessSettings.theme?.accent?.toUpperCase() || '#FFCC00'}</span>
                     </div>
                   </div>
                   <div>
                     <label className="text-xs font-bold text-gray-500 block mb-2 uppercase">Fondo Principal</label>
                     <div className="flex bg-[#111] border border-[#333] rounded-xl overflow-hidden relative p-1.5 items-center gap-3 focus-within:border-accent transition-colors">
                       <input type="color" value={businessSettings.theme?.bg || '#0A0A0A'} onChange={e => setBusinessSettings({...businessSettings, theme: {...businessSettings.theme, bg: e.target.value}})} className="w-10 h-10 rounded cursor-pointer shrink-0 bg-transparent border-0" />
                       <span className="text-sm font-mono text-white">{businessSettings.theme?.bg?.toUpperCase() || '#0A0A0A'}</span>
                     </div>
                   </div>
                   <div>
                     <label className="text-xs font-bold text-gray-500 block mb-2 uppercase">Fondo de Tarjetas</label>
                     <div className="flex bg-[#111] border border-[#333] rounded-xl overflow-hidden relative p-1.5 items-center gap-3 focus-within:border-accent transition-colors">
                       <input type="color" value={businessSettings.theme?.card || '#141414'} onChange={e => setBusinessSettings({...businessSettings, theme: {...businessSettings.theme, card: e.target.value}})} className="w-10 h-10 rounded cursor-pointer shrink-0 bg-transparent border-0" />
                       <span className="text-sm font-mono text-white">{businessSettings.theme?.card?.toUpperCase() || '#141414'}</span>
                     </div>
                   </div>
                 </div>
               </div>
            </div>
          </details>
        </motion.div>
      )}

      {activeTab === 'orders' && (
        <>
          <header className="mb-6 flex justify-between items-center opacity-0 h-0 hidden">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-sm font-bold text-gray-400">Escuchando pedidos</span>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {activeOrders.map((order) => {
            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`bento-card flex flex-col p-6 border ${order.status === 'on_the_way' ? 'bg-orange-950/20 border-orange-500/50 relative overflow-hidden' : 'bg-card-dark border-border-dark'}`}
              >
                {order.status === 'on_the_way' && (
                  <div className="absolute top-0 left-0 w-full h-1 bg-orange-500 animate-pulse"></div>
                )}
                <div className="flex justify-between items-start mb-6 pb-4 border-b border-border-dark">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">Orden #{order.id.split('-')[0].toUpperCase()}</h2>
                      {order.customer_name && (
                        <span className="bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded text-xs font-bold ring-1 ring-yellow-500/50">
                          {order.customer_name}
                        </span>
                      )}
                    </div>
                    {/* Payment Status Indicator */}
                    <div className="flex items-center gap-2 mt-2">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.is_paid ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                          {order.is_paid ? 'PAGADO ✅' : 'PENDIENTE ⏳'}
                       </span>
                       <span className="text-[10px] text-gray-400 font-bold uppercase">{order.payment_method}</span>
                    </div>
                    <p className="text-xs text-text-dim mt-2">
                      {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </div>
                </div>

                <div className="flex-1 space-y-3 mb-6">
                  <h3 className="text-sm font-bold text-accent mb-2">Detalle:</h3>
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start text-sm">
                      <div className="flex items-start gap-2">
                        <span className="font-black text-gray-400">{item.quantity}x</span>
                        <div>
                          <span className="font-medium text-white">{item.product.name}</span>
                          {item.instructions && (
                            <p className="text-xs text-yellow-500/80 italic mt-0.5">Nota: {item.instructions}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-400">${(item.product.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-4 border-t border-border-dark">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-gray-400">Total</span>
                    <span className="text-xl font-bold text-accent">${order.total.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'preparing')}
                        className="col-span-2 w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <Package size={18} /> Preparar Orden
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="col-span-2 w-full py-3 bg-accent hover:bg-yellow-400 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-colors uppercase tracking-widest text-xs"
                      >
                        <CheckCircle size={18} /> AVISAR PEDIDO LISTO
                      </button>
                    )}
                    {(order.status === 'ready' || order.status === 'on_the_way') && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'delivered')}
                        className="col-span-2 w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <UtensilsCrossed size={18} /> Entregada
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {activeOrders.length === 0 && (
             <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-500 gap-4">
               <Clock size={48} className="opacity-20" />
               <p className="text-lg font-bold">No hay pedidos activos todavía.</p>
             </div>
          )}
        </AnimatePresence>
      </div>

      {pastOrders.length > 0 && (
        <div className="mt-12 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-400 flex items-center gap-2">Historial de Turno</h2>
          </div>
          <div className="flex flex-col gap-2">
            {pastOrders.map(order => {
              const isExpanded = expandedOrders.has(order.id);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.id} 
                  className={`bento-card border transition-colors overflow-hidden ${order.status === 'completed' ? 'bg-[#111] border-border-dark opacity-60 hover:opacity-100' : 'bg-card-dark/40 border-green-500/20 hover:bg-card-dark/60 cursor-pointer'}`}
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="p-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-xs text-gray-500">#{order.id.split('-')[0].toUpperCase()}</span>
                      {order.customer_name && (
                         <span className="font-black text-white text-base tracking-tight">{order.customer_name.replace(' (Retirado)', '')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-accent">${order.total.toFixed(2)}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded border ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {isExpanded ? <ChevronUp size={16} className="text-text-dim" /> : <ChevronDown size={16} className="text-text-dim" />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                      >
                        <div className="px-4 pb-4 pt-2 border-t border-border-dark mt-2" onClick={e => e.stopPropagation()}>
                          <div className="space-y-2 mb-4">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span className="text-gray-400"><span className="text-white font-bold">{item.quantity}x</span> {item.product.name}</span>
                                <span className="text-gray-500">${(item.product.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                          
                          {order.status === 'delivered' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateOrderStatus(order.id, 'completed');
                              }}
                              className="w-full py-3 bg-[#222] hover:bg-white hover:text-black font-bold uppercase tracking-widest text-xs rounded-xl shadow transition-colors border border-border-dark"
                            >
                              El Cliente Se Retiró (Liberar Nombre)
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-12 p-6 bento-card bg-[#111] border-t-4 border-accent shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Balance General</p>
            <h3 className="text-xl font-black text-white mt-1">Total Vendido</h3>
          </div>
          <div className="text-3xl font-black text-accent tracking-tighter">
            ${orders.reduce((acc, order) => acc + order.total, 0).toFixed(2)}
          </div>
        </div>
        
        {pastOrders.length > 0 && (
          <div className="border-t border-border-dark pt-4 w-full">
             <button 
               onClick={clearHistory}
               className="w-full flex justify-center items-center gap-2 bg-red-500/10 text-red-500 hover:text-red-400 hover:bg-red-500/20 px-4 py-3 rounded-xl text-sm font-bold transition-colors uppercase tracking-widest"
             >
               <Trash2 size={16} /> ELIMINAR HISTORIAL ANTIGUO
             </button>
          </div>
        )}
      </div>

        </>
      )}
    </div>
  );
}
