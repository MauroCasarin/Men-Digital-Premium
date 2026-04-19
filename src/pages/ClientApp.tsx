/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  Send, 
  X,
  PlusCircle,
  Clock,
  ChevronRight,
  CheckCircle,
  UtensilsCrossed
} from 'lucide-react';
import { Product, CartItem } from '../types';
import { PRODUCTS, WHATSAPP_PHONE } from '../constants';
import { supabase } from '../lib/supabase';

export default function ClientApp() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCartMobile, setShowCartMobile] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Menú');
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'details' | 'payment' | 'tracking'>('cart');
  const [customerName, setCustomerName] = useState(() => localStorage.getItem('studioMenu_customerName') || '');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderStatus, setActiveOrderStatus] = useState<string>('');

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = (freq: number, startTime: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'square'; // Agudo y penetrante
        oscillator.frequency.setValueAtTime(freq, startTime);
        gainNode.gain.setValueAtTime(0.3, startTime);
        oscillator.start(startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);
        oscillator.stop(startTime + 0.3);
      };
      
      const t = audioCtx.currentTime;
      playBeep(1200, t);
      playBeep(1500, t + 0.15);
      playBeep(1800, t + 0.3);
    } catch(e) {}
  };

  useEffect(() => {
    let alertInterval: NodeJS.Timeout;
    
    if (activeOrderStatus === 'ready') {
      // Tocar y vibrar inmediatamente al cambiar a ready
      playNotificationSound();
      if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
      
      // Configurar loop cada 3 segundos hasta que cambie el estado
      alertInterval = setInterval(() => {
        playNotificationSound();
        if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
      }, 3000);
    }

    return () => {
      if (alertInterval) clearInterval(alertInterval);
    };
  }, [activeOrderStatus]);

  const categories = ['Menú', 'Bebidas'];

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter(p => p.category === activeCategory);
  }, [activeCategory]);

  const featuredProduct = PRODUCTS[1]; // Hamburguesa Trufada

  const total = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { product, quantity: 1, instructions: '' }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateInstructions = (id: number, instructions: string) => {
    setCart(prev => prev.map(item => 
      item.product.id === id ? { ...item, instructions } : item
    ));
  };

  const clearCart = () => {
    if (window.confirm('¿Estás seguro de que deseas vaciar el carrito?')) {
      setCart([]);
    }
  };

  const handleCheckout = async (paymentMethod: string) => {
    if (cart.length === 0 || !customerName.trim()) return;

    setIsProcessing(true);
    try {
      // 1. Verify if the name is already taken by a currently active order
      const { data: existingOrders, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .ilike('customer_name', customerName.trim()) // Use ilike for case-insensitive match
        .neq('status', 'completed');
        
      if (fetchError) throw fetchError;
      
      if (existingOrders && existingOrders.length > 0) {
        alert('Este nombre ya está registrado en un pedido activo. Por favor, elige otro nombre o añade tu apellido.');
        return;
      }

      // 2. Generate Order ID
      const orderId = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();
      
      // 3. Insert the order
      const { error } = await supabase.from('orders').insert([{
        id: orderId,
        items: cart,
        total: total,
        status: 'pending',
        payment_method: paymentMethod,
        customer_name: customerName.trim()
      }]);

      if (error) throw error;
      
      // 4. Setup state for tracking view
      setActiveOrderId(orderId);
      setActiveOrderStatus('pending');
      setCheckoutStep('tracking');
      
      // We do not clear the cart yet so they don't lose it if they refresh before we're fully tracking, 
      // but essentially they are in tracking mode now.
      
      // Listen to status updates for this specific order
      const channel = supabase
        .channel(`public:orders:id=eq.${orderId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
          (payload) => {
            setActiveOrderStatus(payload.new.status);
          }
        )
        .subscribe();
      
    } catch (error) {
      console.error(error);
      alert('Hubo un error al procesar el pedido. Comprueba la conexión a Supabase.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOnTheWay = async () => {
    if (!activeOrderId) return;
    await supabase.from('orders').update({ status: 'on_the_way' }).eq('id', activeOrderId);
    setActiveOrderStatus('on_the_way');
  };

  return (
    <div className="min-h-screen bg-bg-dark p-4 md:p-10 flex flex-col items-center overflow-x-hidden">
      <div className="w-full max-w-[1400px] flex flex-col md:grid md:grid-cols-[1fr_1fr_360px] md:grid-rows-[auto_1fr_1fr_auto] gap-5">
        
        {/* Header Bento Item */}
        <header className="bento-card md:col-span-2 flex flex-row items-center justify-between bg-linear-to-r from-card-dark to-[#1a1a1a] h-20">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="text-xl sm:text-2xl font-extrabold tracking-tighter cursor-default"
          >
            TU NOMBRE<span className="text-accent">.</span>MENU
          </motion.div>
          <div className="hidden lg:flex gap-3">
            {categories.map(cat => (
              <motion.button
                key={cat}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all ${
                  activeCategory === cat ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'bg-[#222] text-white hover:bg-[#333]'
                }`}
              >
                {cat}
              </motion.button>
            ))}
          </div>
          <button 
            onClick={() => setShowCartMobile(true)}
            className="md:hidden relative p-3 bg-accent rounded-xl text-black hover:scale-105 transition-transform"
          >
            <ShoppingBag size={20} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-white text-black text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-black shadow-lg">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>
        </header>

        {/* Categories Mobile (shown only on mobile) */}
        <div className="flex md:hidden overflow-x-auto gap-2 pb-2 scrollbar-none">
           {categories.map(cat => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-[12px] font-bold transition-all ${
                  activeCategory === cat ? 'bg-accent text-black' : 'bg-card-dark text-white border border-border-dark'
                }`}
              >
                {cat}
              </motion.button>
            ))}
        </div>

        {/* Featured / Special Bento Item */}
        <motion.div 
          whileHover={{ y: -4, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
          transition={{ duration: 0.2 }}
          className="bento-card md:col-span-1 md:row-span-2 bg-[#1a1810] border-[#443a10] overflow-hidden group min-h-[400px]"
        >
          <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
            <img src={featuredProduct.image} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="relative z-10 h-full flex flex-col justify-end">
            <span className="inline-block px-2 py-1 bg-accent text-black text-[10px] font-extrabold rounded mb-3 self-start">CHEF'S PICK</span>
            <h2 className="text-4xl font-extrabold leading-none mb-4 text-white">
              {featuredProduct.name.split(' ').map((word, i) => (
                <span key={i} className="block">{word}</span>
              ))}
            </h2>
            <p className="text-sm text-text-dim mb-8 max-w-xs leading-relaxed">{featuredProduct.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-accent tracking-tighter">${featuredProduct.price.toFixed(2)}</span>
              <button 
                onClick={() => addToCart(featuredProduct)}
                className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-3xl font-light hover:bg-accent hover:text-black transition-all shadow-xl hover:rotate-90"
              >
                +
              </button>
            </div>
          </div>
        </motion.div>

        {/* Dynamic Product Grid Items */}
        {filteredProducts.filter(p => p.id !== featuredProduct.id).slice(0, 2).map((product) => (
          <motion.div 
            key={product.id}
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ duration: 0.2 }}
            className="bento-card overflow-hidden group min-h-[240px] md:min-h-0 cursor-pointer"
          >
            <div className="absolute inset-0">
               <img 
                src={product.image} 
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent" />
            </div>
            <button 
              onClick={() => addToCart(product)}
              className="absolute top-5 right-5 z-20 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-xl font-light hover:bg-accent hover:text-black transition-all hover:scale-110"
            >
              +
            </button>
            <div className="relative z-10 mt-auto">
              <h3 className="text-xl font-bold text-white mb-1 group-hover:text-accent transition-colors">{product.name}</h3>
              <p className="text-[11px] text-text-dim mb-3 line-clamp-1">{product.description}</p>
              <span className="text-lg font-bold text-accent tracking-tight">${product.price.toFixed(2)}</span>
            </div>
          </motion.div>
        ))}

        {/* Sidebar Cart Bento Item */}
        <aside className="bento-card md:row-span-4 bg-[#0F0F0F] flex flex-col p-6 h-full md:max-h-screen shadow-2xl overflow-hidden hidden md:flex">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
            <h2 className="text-2xl font-extrabold tracking-tight">Tu Pedido</h2>
            {cart.length > 0 && checkoutStep === 'cart' && (
              <button onClick={clearCart} className="text-text-dim hover:text-red-400 transition-colors p-1">
                <Trash2 size={18} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto space-y-6 pr-2 scrollbar-thin scrollbar-thumb-accent/20">
            <AnimatePresence mode="popLayout" initial={false}>
              {checkoutStep === 'tracking' ? (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                   className="h-full flex flex-col items-center justify-center text-center gap-6 text-white py-12 px-4"
                 >
                   {activeOrderStatus === 'on_the_way' ? (
                     <>
                        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                           <Clock size={80} className="text-orange-500 mb-4 mx-auto" />
                        </motion.div>
                        <h3 className="text-2xl font-bold text-white tracking-tight text-orange-500">¡Ve al mostrador!</h3>
                        <p className="text-sm text-text-dim">Te estamos esperando para entregarte tu pedido.</p>
                     </>
                   ) : activeOrderStatus === 'ready' ? (
                     <>
                        <motion.div 
                           initial={{ scale: 0.8 }}
                           animate={{ scale: [0.8, 1.2, 1] }} 
                           transition={{ duration: 0.5, type: 'spring' }}
                        >
                           <UtensilsCrossed size={80} className="text-accent mb-4 mx-auto drop-shadow-[0_0_15px_rgba(255,204,0,0.5)]" />
                        </motion.div>
                        <h3 className="text-3xl font-black text-accent tracking-tighter">¡PEDIDO LISTO<br/>PARA RETIRAR!</h3>
                        <p className="text-base text-gray-300 font-medium w-full">Acércate al mostrador indicando el nombre:<br/><span className="text-white font-black text-xl bg-[#222] px-4 py-2 rounded-xl inline-block mt-3 border border-border-dark w-full">{customerName}</span></p>
                        
                        <button 
                          onClick={handleOnTheWay}
                          className="mt-6 w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xl shadow-orange-500/20 transition-all uppercase tracking-widest text-xs"
                        >
                          Estoy en camino a retirar
                        </button>
                     </>
                   ) : activeOrderStatus === 'preparing' ? (
                     <>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}>
                           <UtensilsCrossed size={64} className="text-blue-400 mb-2 mx-auto" />
                        </motion.div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Preparando tu pedido</h3>
                        <p className="text-sm text-text-dim">¡El comercio ya está trabajando en lo tuyo!</p>
                     </>
                   ) : (
                     <>
                        <Clock size={64} className="text-yellow-500 mb-2 mx-auto animate-pulse" />
                        <h3 className="text-2xl font-bold text-white tracking-tight">Pedido Enviado</h3>
                        <p className="text-sm text-text-dim">Esperando que el comercio comience a prepararlo.</p>
                     </>
                   )}
                 </motion.div>
              ) : checkoutStep === 'details' ? (
                 <motion.div 
                   initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                   className="flex flex-col gap-4 py-4"
                 >
                   <h3 className="text-lg font-bold text-white mb-2">¿A nombre de quién?</h3>
                   <p className="text-xs text-text-dim mb-2">Ingresa tu nombre para identificarte al retirar.</p>
                   <input
                     type="text"
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                     placeholder="Tu Nombre o Apellido"
                     className="w-full bg-[#222] border border-border-dark text-white p-4 rounded-xl focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all font-bold text-lg"
                   />
                 </motion.div>
              ) : checkoutStep === 'payment' ? (
                 <motion.div 
                   initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                   className="flex flex-col gap-4 py-4"
                 >
                   <h3 className="text-lg font-bold text-white mb-2">Método de pago</h3>
                   <button 
                     onClick={() => handleCheckout('efectivo')}
                     disabled={isProcessing}
                     className="w-full bg-[#222] hover:bg-[#333] border border-border-dark text-white p-4 rounded-xl flex items-center justify-between transition-colors"
                   >
                     <span className="font-bold">Efectivo al recibir</span>
                     <ChevronRight size={18} className="text-text-dim" />
                   </button>
                   <button 
                     onClick={() => handleCheckout('tarjeta')}
                     disabled={isProcessing}
                     className="w-full bg-[#222] hover:bg-[#333] border border-border-dark text-white p-4 rounded-xl flex items-center justify-between transition-colors"
                   >
                     <span className="font-bold">Tarjeta de Crédito / Débito</span>
                     <ChevronRight size={18} className="text-text-dim" />
                   </button>
                   {isProcessing && (
                     <div className="flex items-center justify-center gap-2 mt-4 text-accent">
                       <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                         <Clock size={16} />
                       </motion.div>
                       <span className="text-sm font-bold animate-pulse">Procesando pedido...</span>
                     </div>
                   )}
                 </motion.div>
              ) : cart.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center gap-6 text-text-dim py-12"
                >
                  <div className="w-20 h-20 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                    <ShoppingBag size={40} strokeWidth={1} />
                  </div>
                  <p className="text-sm font-medium">Su carrito está esperando<br/>una selección gourmet.</p>
                </motion.div>
              ) : (
                cart.map(item => (
                  <motion.div
                    key={item.product.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col gap-3 group"
                  >
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#222] shadow-lg flex-shrink-0">
                        <img src={item.product.image} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate group-hover:text-accent transition-colors">{item.product.name}</h4>
                        <p className="text-xs text-accent font-bold">${(item.product.price * item.quantity).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-[#222] rounded-lg p-1 border border-white/5">
                          <button 
                            onClick={() => updateQuantity(item.product.id, -1)} 
                            className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
                          >
                             <Minus size={12} />
                          </button>
                          <span className="text-xs font-bold min-w-[12px] text-center">{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.product.id, 1)} 
                            className="w-6 h-6 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
                          >
                             <Plus size={12} />
                          </button>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-text-dim hover:text-red-500 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    {item.quantity >= 1 && (
                      <textarea 
                        value={item.instructions}
                        onChange={(e) => updateInstructions(item.product.id, e.target.value)}
                        placeholder="Añadir nota especial..."
                        className="w-full text-[11px] p-2.5 rounded-xl bg-[#222]/30 border border-border-dark italic text-gray-400 focus:outline-none focus:border-accent/50 transition-all resize-none shadow-inner"
                        rows={1}
                      />
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className="mt-6 pt-6 border-t border-border-dark space-y-4">
            <div className="flex justify-between items-center text-xl font-bold px-1">
              <span>Total</span>
              <span className="text-accent tracking-tighter text-2xl">${total.toFixed(2)}</span>
            </div>
            {checkoutStep === 'cart' ? (
              <button 
                disabled={cart.length === 0}
                onClick={() => setCheckoutStep('details')}
                className="w-full bg-accent disabled:bg-accent/20 disabled:text-text-dim text-black py-5 rounded-2xl font-black text-sm tracking-[0.2em] uppercase transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center shadow-xl shadow-accent/10 relative"
              >
                <span>CONTINUAR AL PAGO</span>
              </button>
            ) : checkoutStep === 'details' ? (
               <div className="flex flex-col gap-3 w-full">
                 <button 
                  onClick={() => {
                    if(!customerName.trim()){
                      alert("Por favor ingresa tu nombre.");
                      return;
                    }
                    localStorage.setItem('studioMenu_customerName', customerName.trim());
                    setCheckoutStep('payment')
                   }}
                  className="w-full bg-accent text-black py-5 rounded-2xl font-black text-sm tracking-[0.2em] uppercase transition-all shadow-xl shadow-accent/10"
                >
                  SIGUIENTE
                </button>
                <button 
                  onClick={() => setCheckoutStep('cart')}
                  className="w-full border border-border-dark text-white py-4 rounded-2xl font-bold text-sm transition-colors hover:bg-white/5"
                >
                  VOLVER AL CARRITO
                </button>
               </div>
            ) : checkoutStep === 'payment' && !isProcessing ? (
               <button 
                onClick={() => setCheckoutStep('details')}
                className="w-full border border-border-dark text-white py-4 rounded-2xl font-bold text-sm transition-colors hover:bg-white/5"
              >
                VOLVER ATRÁS
              </button>
            ) : checkoutStep === 'tracking' && ['delivered', 'completed'].includes(activeOrderStatus) ? (
               <button 
                onClick={() => {
                  setCart([]);
                  setCheckoutStep('cart');
                  setActiveOrderId(null);
                }}
                className="w-full bg-white text-black py-5 rounded-2xl font-black text-sm tracking-[0.2em] uppercase transition-all shadow-xl"
              >
                HACER NUEVO PEDIDO
              </button>
            ) : null}
          </div>
        </aside>

        {/* Mobile items remaining (Full list for mobile if not empty) */}
        <div className="md:hidden space-y-4 mt-4">
           {filteredProducts.filter(p => p.id !== featuredProduct.id).slice(2).map((product) => (
              <motion.div 
                key={product.id} 
                whileTap={{ scale: 0.98 }}
                className="bento-card flex flex-row items-center gap-4 bg-card-dark/50"
              >
                 <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                    <img src={product.image} className="w-full h-full object-cover" alt="" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{product.name}</h3>
                    <p className="text-accent font-bold">${product.price.toFixed(2)}</p>
                 </div>
                 <button 
                  onClick={() => addToCart(product)} 
                  className="w-10 h-10 rounded-full bg-accent text-black font-extrabold flex items-center justify-center shadow-lg"
                 >
                  +
                 </button>
              </motion.div>
           ))}
        </div>

      </div>

      {/* Cart Mobile Overlay - Re-implementing with Bento styling */}
      <AnimatePresence>
        {showCartMobile && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCartMobile(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.aside
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-[90%] bg-bg-dark flex flex-col shadow-2xl border-l border-border-dark"
            >
               <div className="p-6 border-b border-border-dark flex items-center justify-between">
                <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
                  <ShoppingBag size={24} className="text-accent" />
                  SU PEDIDO
                </h2>
                <button onClick={() => setShowCartMobile(false)} className="p-2 text-text-dim hover:text-white transition-colors">
                  <X size={28} />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-6 space-y-6">
                {checkoutStep === 'tracking' ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-6 text-white py-12 px-4">
                   {activeOrderStatus === 'on_the_way' ? (
                     <>
                        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                           <Clock size={80} className="text-orange-500 mb-4 mx-auto" />
                        </motion.div>
                        <h3 className="text-2xl font-bold text-white tracking-tight text-orange-500">¡Ve al mostrador!</h3>
                        <p className="text-sm text-text-dim">Te estamos esperando para entregarte tu pedido.</p>
                     </>
                   ) : activeOrderStatus === 'ready' ? (
                     <>
                        <motion.div 
                           initial={{ scale: 0.8 }}
                           animate={{ scale: [0.8, 1.2, 1] }} 
                           transition={{ duration: 0.5, type: 'spring' }}
                        >
                           <UtensilsCrossed size={80} className="text-accent mb-4 mx-auto drop-shadow-[0_0_15px_rgba(255,204,0,0.5)]" />
                        </motion.div>
                        <h3 className="text-3xl font-black text-accent tracking-tighter">¡PEDIDO LISTO<br/>PARA RETIRAR!</h3>
                        <p className="text-base text-gray-300 font-medium w-full">Acércate al mostrador indicando el nombre:<br/><span className="text-white font-black text-xl bg-[#222] px-4 py-2 rounded-xl inline-block mt-3 border border-border-dark w-full">{customerName}</span></p>
                        
                        <button 
                          onClick={handleOnTheWay}
                          className="mt-6 w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-xl shadow-orange-500/20 transition-all uppercase tracking-widest text-xs"
                        >
                          Estoy en camino a retirar
                        </button>
                     </>
                   ) : activeOrderStatus === 'preparing' ? (
                     <>
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}>
                           <UtensilsCrossed size={64} className="text-blue-400 mb-2 mx-auto" />
                        </motion.div>
                        <h3 className="text-2xl font-bold text-white tracking-tight">Preparando tu pedido</h3>
                        <p className="text-sm text-text-dim">¡El comercio ya está trabajando en lo tuyo!</p>
                     </>
                   ) : (
                     <>
                        <Clock size={64} className="text-yellow-500 mb-2 mx-auto animate-pulse" />
                        <h3 className="text-2xl font-bold text-white tracking-tight">Pedido Enviado</h3>
                        <p className="text-sm text-text-dim">Esperando que el comercio comience a prepararlo.</p>
                     </>
                   )}
                  </div>
                ) : cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-6 text-text-dim">
                    <div className="w-20 h-20 rounded-full bg-card-dark flex items-center justify-center">
                      <ShoppingBag size={40} strokeWidth={1} />
                    </div>
                    <p className="font-medium">Carrito vacío</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.product.id} className="flex flex-col gap-4 bg-card-dark p-4 rounded-2xl border border-border-dark shadow-xl">
                      <div className="flex gap-4 items-center">
                        <img src={item.product.image} className="w-16 h-16 rounded-xl object-cover" alt="" />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold truncate">{item.product.name}</h4>
                          <p className="text-accent font-bold">${(item.product.price).toFixed(2)}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="p-2 text-text-dim hover:text-red-500">
                          <Trash2 size={18} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 bg-bg-dark rounded-xl px-4 py-2 border border-border-dark flex-1 justify-center">
                          <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1">
                             <Minus size={16} />
                          </button>
                          <span className="text-base font-black min-w-[20px] text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1">
                             <Plus size={16} />
                          </button>
                        </div>
                        <span className="text-lg font-bold text-accent whitespace-nowrap">${(item.product.price * item.quantity).toFixed(2)}</span>
                      </div>
                      <textarea 
                        value={item.instructions}
                        onChange={(e) => updateInstructions(item.product.id, e.target.value)}
                        placeholder="Instrucciones..."
                        className="w-full text-xs p-3 rounded-xl bg-bg-dark border border-border-dark italic text-gray-400 focus:outline-none focus:border-accent transition-colors resize-none"
                        rows={1}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 bg-card-dark border-t border-border-dark space-y-6 shadow-2xl">
                <div className="flex justify-between items-center text-2xl font-black">
                  <span>TOTAL</span>
                  <span className="text-accent tracking-tighter">${total.toFixed(2)}</span>
                </div>
                {checkoutStep === 'cart' ? (
                  <button 
                    disabled={cart.length === 0}
                    onClick={() => setCheckoutStep('details')}
                    className="w-full bg-accent text-black py-5 rounded-2xl font-black text-lg tracking-widest uppercase shadow-xl shadow-accent/20 active:scale-[0.98] transition-transform"
                  >
                    CONTINUAR
                  </button>
                ) : checkoutStep === 'details' ? (
                  <div className="flex flex-col gap-3">
                    <input
                     type="text"
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                     placeholder="Tu Nombre / Apellido"
                     className="w-full bg-[#222] border border-border-dark text-white p-4 rounded-xl focus:border-accent focus:outline-none font-bold mb-2"
                    />
                    <button 
                      onClick={() => {
                        if(!customerName.trim()){ alert("Ingresa tu nombre."); return; }
                        localStorage.setItem('studioMenu_customerName', customerName.trim());
                        setCheckoutStep('payment');
                      }}
                      className="w-full bg-accent text-black py-4 rounded-xl font-bold uppercase"
                    >
                      Siguiente
                    </button>
                    <button 
                      onClick={() => setCheckoutStep('cart')}
                      className="w-full text-text-dim py-2 font-medium"
                    >
                      Volver
                    </button>
                  </div>
                ) : checkoutStep === 'payment' && !isProcessing ? (
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => handleCheckout('efectivo')}
                      className="w-full bg-[#333] text-white py-4 rounded-xl font-bold border border-border-dark"
                    >
                      Pagar en Efectivo
                    </button>
                    <button 
                      onClick={() => handleCheckout('tarjeta')}
                      className="w-full bg-[#333] text-white py-4 rounded-xl font-bold border border-border-dark"
                    >
                      Pagar con Tarjeta
                    </button>
                    <button 
                      onClick={() => setCheckoutStep('details')}
                      className="w-full text-text-dim py-2 font-medium"
                    >
                      Volver
                    </button>
                  </div>
                ) : checkoutStep === 'tracking' && ['delivered', 'completed'].includes(activeOrderStatus) ? (
                  <button 
                    onClick={() => {
                      setCart([]);
                      setCheckoutStep('cart');
                      setActiveOrderId(null);
                    }}
                    className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg uppercase"
                  >
                    NUEVO PEDIDO
                  </button>
                ) : (
                  <div className="w-full py-5 text-center text-accent font-bold animate-pulse">
                    Procesando...
                  </div>
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Tooltip Mobile */}
      {cart.length > 0 && !showCartMobile && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 md:hidden z-30 w-full px-6"
        >
          <button 
            onClick={() => setShowCartMobile(true)}
            className="w-full bg-accent text-black p-5 rounded-2xl shadow-2xl font-black flex items-center justify-between ring-4 ring-accent/20 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <ShoppingBag size={24} />
              <span className="text-sm tracking-widest">VER PEDIDO ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
            </div>
            <span className="text-lg tracking-tighter">${total.toFixed(2)}</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}

