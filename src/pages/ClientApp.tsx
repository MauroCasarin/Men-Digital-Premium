/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactCrop, { type Crop as CropType, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  X,
  PlusCircle,
  Clock,
  ChevronRight,
  CheckCircle,
  UtensilsCrossed,
  Crop
} from 'lucide-react';
import { Product, CartItem, Order } from '../types';
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
  const [toastNotification, setToastNotification] = useState<{title: string, body: string, status: string} | null>(null);
  
  // New states for payment / AI verification
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropType>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verdict, setVerdict] = useState<{valid: boolean, reason: string} | null>(null);
  const [paymentMode, setPaymentMode] = useState<'select' | 'transfer'>('select');
  const [originalReceiptImage, setOriginalReceiptImage] = useState<string | null>(null);
  const [businessSettings, setBusinessSettings] = useState({ alias: '', cbu: '', holder_name: '', name: 'TU NOMBRE.MENU', logo_url: '', categories: ['Menú', 'Bebidas'], theme: { accent: '#FFCC00', bg: '#0A0A0A', card: '#141414' } });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (businessSettings.theme) {
      document.documentElement.style.setProperty('--color-accent', businessSettings.theme.accent);
      document.documentElement.style.setProperty('--color-bg-dark', businessSettings.theme.bg);
      document.documentElement.style.setProperty('--color-card-dark', businessSettings.theme.card);
    }
  }, [businessSettings.theme]);

  // Safe global audio context to prevent creating >6 contexts per session (which crashes iOS/Safari).
  const getAudioContext = (() => {
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

  const playNotificationSound = () => {
    try {
      const audioCtx = getAudioContext();
      if (!audioCtx) return;
      
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(e => console.warn(e));
      }
      
      const theme = businessSettings.theme || {};
      const sType = theme.client_sound_type || 'square';
      const sVol = theme.client_sound_volume !== undefined ? theme.client_sound_volume : 0.3;
      const freqMult = theme.client_sound_freq_mult || 1.0;
      
      if (sVol <= 0) return; // Muted

      const playBeep = (freq: number, startTime: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = sType as OscillatorType;
        oscillator.frequency.setValueAtTime(freq * freqMult, startTime);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(sVol, startTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);
        oscillator.start(startTime);
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
    let removeTimer: NodeJS.Timeout;
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    };

    if (activeOrderStatus && activeOrderStatus !== 'completed' && activeOrderStatus !== 'delivered') {
      requestWakeLock();
    } else if (activeOrderStatus === 'completed' || activeOrderStatus === 'delivered') {
       setCustomerName(''); // Liberar nombre si ya se le entregó
       localStorage.removeItem('studioMenu_customerName');
    }
    
    // Configurar notificaciones visuales/toast basadas en el cambio de estado
    if (activeOrderStatus && activeOrderStatus !== 'pending') {
      let title = '';
      let body = '';
      
      switch(activeOrderStatus) {
        case 'preparing':
          title = '👨‍🍳 Preparando';
          body = 'El comercio ha empezado a preparar tu orden.';
          break;
        case 'ready':
          title = '✅ ¡Listo para retirar!';
          body = 'Acércate al mostrador para entregarte tu orden.';
          break;
        case 'on_the_way':
          title = '🚶‍♂️ Te vemos en camino';
          body = '¡Ya sacamos tu pedido al mostrador!';
          break;
        case 'delivered':
          title = '🛍️ Pedido Entregado';
          body = '¡Esperamos que lo disfrutes!';
          break;
        case 'completed':
           title = '👋 Pedido Finalizado';
           body = 'Gracias por tu compra.';
           break;
      }
      
      if (title) {
        setToastNotification({ title, body, status: activeOrderStatus });
        
        // Native browser notification if permitted
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Tu Pedido: ${title}`, { body });
          }
        } catch (e) { console.warn('Native notification failed', e); }
        
        removeTimer = setTimeout(() => {
          setToastNotification(null);
        }, 5000); // 5 segundos de popup visual
      }
    }
    
    if (activeOrderStatus === 'ready') {
      // Tocar y vibrar inmediatamente al cambiar a ready
      playNotificationSound();
      try {
        if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
      } catch (e) {}
      
      // Configurar loop cada 3 segundos hasta que cambie el estado
      alertInterval = setInterval(() => {
        playNotificationSound();
        try {
          if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
        } catch (e) {}
      }, 3000);
    }

    return () => {
      if (removeTimer) clearTimeout(removeTimer);
      if (alertInterval) clearInterval(alertInterval);
      if (wakeLock !== null) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [activeOrderStatus]);

  // Restoring order listener when mounting if actively shopping in tracking view but lost WS
  useEffect(() => {
    if (activeOrderId && checkoutStep === 'tracking') {
      const channelId = `order-tracker-${activeOrderId}-${Date.now()}`;
      const channel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${activeOrderId}` },
          (payload) => {
            setActiveOrderStatus(payload.new.status);
          }
        )
        .subscribe();
        
      return () => { supabase.removeChannel(channel); }
    }
  }, [activeOrderId, checkoutStep]);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['Menú', 'Bebidas']);

  useEffect(() => {
    // Attempt to load products from Supabase
    const fetchProducts = async () => {
      try {
        const { data } = await supabase.from('menu_items').select('*').order('category', { ascending: false });
        if (data) {
          setProducts(data as Product[]);
        }
      } catch (err) {
        console.warn('Failed to load menu items:', err);
      }
    };

    const fetchBizSettings = async () => {
      try {
        const { data } = await supabase.from('business_settings').select('*').single();
        if (data) {
          setBusinessSettings({ 
            alias: data.alias || '', 
            cbu: data.cbu || '',
            holder_name: data.holder_name || '',
            name: data.name || 'TU NOMBRE.MENU',
            logo_url: data.logo_url || '',
            categories: data.categories || ['Menú', 'Bebidas'],
            theme: {
              accent: data.theme?.accent || '#FFCC00',
              bg: data.theme?.bg || '#0A0A0A',
              card: data.theme?.card || '#141414',
              hidden_categories: data.theme?.hidden_categories || data.hidden_categories || []
            }
          });
          if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
            // Also override categories state so the navigation pill menu takes custom ones if needed
            // Only if they exist to prevent breaking
            setCategories(data.categories);
            
            const visibleCats = data.categories.filter((c: string) => !(data.theme?.hidden_categories || data.hidden_categories || []).includes(c));
            if (visibleCats.length > 0) {
                setActiveCategory(visibleCats[0]);
            } else {
                setActiveCategory(data.categories[0]);
            }
          }
        }
      } catch (e) {}
    };

    fetchProducts();
    fetchBizSettings();

    // Subscribe to backend changes to sync design and items in real time
    const channel = supabase
      .channel('client-config-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'business_settings' }, (payload) => {
        const data = payload.new as any;
        if (data) {
          setBusinessSettings({ 
            alias: data.alias || '', 
            cbu: data.cbu || '',
            holder_name: data.holder_name || '',
            name: data.name || 'TU NOMBRE.MENU',
            logo_url: data.logo_url || '',
            categories: data.categories || ['Menú', 'Bebidas'],
            theme: {
              accent: data.theme?.accent || '#FFCC00',
              bg: data.theme?.bg || '#0A0A0A',
              card: data.theme?.card || '#141414',
              hidden_categories: data.theme?.hidden_categories || data.hidden_categories || []
            }
          });
          if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
             setCategories(data.categories);
             
             const visibleCats = data.categories.filter((c: string) => !(data.theme?.hidden_categories || data.hidden_categories || []).includes(c));
             setActiveCategory(prev => {
                if (visibleCats.includes(prev)) return prev;
                return visibleCats.length > 0 ? visibleCats[0] : data.categories[0];
             });
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchProducts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.category === activeCategory);
  }, [activeCategory, products]);

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

  const removeFromCart = (id: string | number) => {
    setCart(prev => prev.filter(item => item.product.id !== id));
  };

  const updateQuantity = (id: string | number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const updateInstructions = (id: string | number, instructions: string) => {
    setCart(prev => prev.map(item => 
      item.product.id === id ? { ...item, instructions } : item
    ));
  };

  const clearCart = () => {
    if (window.confirm('¿Estás seguro de que deseas vaciar el carrito?')) {
      setCart([]);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, width / height, width, height),
      width, height
    );
    setCrop(initialCrop);
  };

  const showCroppedImage = () => {
    if (!imgRef.current || !crop) return;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    
    let x, y, width, height;
    if (crop.unit === '%') {
      x = (crop.x / 100) * image.naturalWidth;
      y = (crop.y / 100) * image.naturalHeight;
      width = (crop.width / 100) * image.naturalWidth;
      height = (crop.height / 100) * image.naturalHeight;
    } else {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      x = crop.x * scaleX;
      y = crop.y * scaleY;
      width = crop.width * scaleX;
      height = crop.height * scaleY;
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(
      image,
      x,
      y,
      width,
      height,
      0, 0, width, height
    );
    setReceiptImage(canvas.toDataURL('image/jpeg', 0.9));
    setImageToCrop(null);
    setOriginalReceiptImage(null);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (paymentMode === 'transfer' && !receiptImage && !imageToCrop) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              if (file.size > 15 * 1024 * 1024) {
                alert("La imagen es excesivamente grande. Intenta con una captura de pantalla.");
                return;
              }
              const reader = new FileReader();
              reader.onload = (event) => {
                setImageToCrop(event.target?.result as string);
                setRawImage(event.target?.result as string);
              };
              reader.readAsDataURL(file);
            }
            break;
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [paymentMode, receiptImage, imageToCrop]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        alert("La imagen es excesivamente grande. Intenta con una captura de pantalla.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setImageToCrop(event.target?.result as string);
        setRawImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const verifyReceipt = async () => {
    if (!receiptImage) return;
    setIsVerifying(true);
    setVerdict(null);
    try {
      const now = new Date();
      const response = await fetch('/api/verify-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: receiptImage,
          expectedTotal: total,
          expectedDate: now.toLocaleDateString('es-AR'),
          expectedTime: now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
          businessAlias: businessSettings.alias,
          holderName: businessSettings.holder_name
        })
      });

      let data;
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Server raw response:", text);
        throw new Error("El sistema de verificación no respondió correctamente. Esto suele pasar si la imagen no se subió bien o el servidor tardó demasiado.");
      }
      
      if (!response.ok) {
        throw new Error(data.error || "Error verificando comprobante");
      }

      setVerdict({
        valid: data.valid,
        reason: data.reason
      });

      if (data.valid) {
         await handleCheckout('Transferencia / Pago Online - VERIFICADO ✅', data.transaction_id, data.issuer_cuit_cuil);
      }
    } catch (err: any) {
      alert(err.message);
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCheckout = async (paymentMethod: string, receiptId?: string, cuit?: string) => {
    if (cart.length === 0 || !customerName.trim()) return;

    setIsProcessing(true);
    try {
      // 1. Verify if the name is already taken by a currently active order
      const { data: existingOrders, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .ilike('customer_name', customerName.trim()) // Use ilike for case-insensitive match
        .in('status', ['pending', 'preparing', 'ready', 'on_the_way']);
        
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
        customer_name: customerName.trim(),
        receipt_id: receiptId || null,
        customer_cuit: cuit || null
      }]);

      if (error) throw error;
      
      // 4. Setup state for tracking view
      setActiveOrderId(orderId);
      setActiveOrderStatus('pending');
      setCheckoutStep('tracking');
      
      // We do not clear the cart yet so they don't lose it if they refresh before we're fully tracking, 
      // but essentially they are in tracking mode now.
      
      // Pedir permisos de notificación de escritorio/movil si no se pidieron antes
      if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
      
    } catch (error: any) {
      console.error(error);
      alert('Hubo un error al procesar el pedido. Comprueba la conexión a Supabase o revisa que hayas creado la tabla "orders": ' + error.message);
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
      
      {/* Toast Notification Container */}
      <AnimatePresence>
        {toastNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm rounded-2xl shadow-2xl p-4 flex items-start gap-4 border ring-4 border-border-dark bg-[#111]
              ${toastNotification.status === 'ready' ? 'ring-accent/40 shadow-accent/20' : 
                toastNotification.status === 'delivered' ? 'ring-green-500/40 shadow-green-500/20' : 
                'ring-transparent'}`}
          >
            <div className="flex-1">
              <h4 className="font-bold text-white text-lg leading-tight mb-1">{toastNotification.title}</h4>
              <p className="text-sm text-gray-400 leading-snug">{toastNotification.body}</p>
            </div>
            <button 
              onClick={() => setToastNotification(null)}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`w-full max-w-[1400px] flex flex-col md:grid md:grid-cols-[1fr_1fr_360px] md:grid-rows-[auto_1fr_1fr_auto] gap-5 ${(cart.length > 0) || (activeOrderId && activeOrderStatus !== 'completed' && activeOrderStatus !== 'delivered' && !showCartMobile) ? 'pb-24 md:pb-0' : ''}`}>
        
        {/* Header Bento Item */}
        <header className="bento-card md:col-span-2 flex flex-col gap-4 bg-linear-to-r from-card-dark to-[#1a1810] p-6">
          <div className="flex items-center justify-between">
            <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-3 cursor-default">
              {businessSettings.logo_url && <img src={businessSettings.logo_url} alt="Logo" className="h-10 w-auto rounded object-cover" />}
              <span className="text-xl sm:text-2xl font-extrabold tracking-tighter">{businessSettings.name}</span>
            </motion.div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  if (cart.length > 0) setShowCartMobile(true);
                }} 
                className="p-3 bg-transparent border border-[#333] rounded-xl text-white hover:bg-[#222] transition-colors relative md:hidden flex items-center justify-center"
              >
                <ShoppingBag size={20} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-accent text-black text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold">
                    {cart.reduce((a, b) => a + b.quantity, 0)}
                  </span>
                )}
              </button>
            </div>
          </div>
          
          {/* Categories - Auto-scaling, just below title */}
          <div className="flex flex-wrap gap-2">
            {categories.filter(cat => !(businessSettings.theme?.hidden_categories || []).includes(cat)).map(cat => (
              <motion.button
                key={cat}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all ${
                  activeCategory === cat ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'bg-[#222] text-white border border-[#333] hover:bg-[#333]'
                }`}
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </header>

        {/* Product Detail Modal */}
        <AnimatePresence>
          {selectedProduct && (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedProduct(null)}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="bg-[#1a1810] border border-[#333] p-4 sm:p-6 rounded-3xl w-full max-w-sm sm:max-w-lg max-h-[85vh] overflow-y-auto relative shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                 <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 text-white p-2 bg-black/50 rounded-full hover:bg-black/80 transition-colors z-10"><X size={20}/></button>
                 <div className="relative">
                   <img src={selectedProduct.image} className="w-full h-48 sm:h-64 object-cover rounded-2xl mb-4" referrerPolicy="no-referrer" />
                   <div className="absolute inset-0 bg-linear-to-t from-[#1a1810] via-transparent to-transparent rounded-2xl" />
                 </div>
                 <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">{selectedProduct.name}</h2>
                 <p className="text-sm sm:text-base text-gray-400 mb-6">{selectedProduct.description}</p>
                 
                 <div className="flex justify-between items-center mb-6">
                    <span className="text-xl sm:text-2xl font-bold text-accent">${selectedProduct.price.toFixed(2)}</span>
                    <div className="flex items-center gap-4 bg-[#222] p-2 rounded-xl">
                      <button onClick={() => {
                        const currentQuantity = cart.find(c => c.product.id === selectedProduct.id)?.quantity || 0;
                        if (currentQuantity > 1) {
                            updateQuantity(selectedProduct.id, -1);
                        } else if (currentQuantity === 1) {
                            removeFromCart(selectedProduct.id);
                            setSelectedProduct(null); // Close modal when completely removed
                        }
                      }} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg"><Minus size={20}/></button>
                      <span className="font-bold text-lg w-4 text-center">{cart.find(c => c.product.id === selectedProduct.id)?.quantity || 0}</span>
                      <button onClick={() => addToCart(selectedProduct)} className="p-2 text-accent hover:bg-accent/10 rounded-lg"><Plus size={20}/></button>
                    </div>
                 </div>

                 <button 
                      onClick={() => setSelectedProduct(null)}
                      className="w-full bg-transparent border border-[#444] text-white font-bold py-3 rounded-xl hover:bg-[#222] transition-colors"
                    >
                      Volver al Menú
                 </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Dynamic Product Grid Items */}
        {filteredProducts.map((product) => (
           <motion.div 
            key={product.id}
            whileHover={{ scale: 1.01 }}
            className={`overflow-hidden group h-[110px] cursor-pointer relative border border-[#222] bg-[#0A0A0A] flex items-center p-4 gap-4 rounded-2xl mb-3 shadow-lg`}
            onClick={() => setSelectedProduct(product)}
          >
            {/* Background Image with Blur and Parallax effect */}
            <div 
              className="absolute inset-0 z-0 bg-cover bg-fixed opacity-30 saturate-50"
              style={{ backgroundImage: `url(${product.image || `https://picsum.photos/seed/${product.name}/500/300?blur=5`})`, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} 
            />
            <div className="absolute inset-0 bg-black/70 mix-blend-multiply" />
            
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 relative z-10 border border-white/10 shadow-lg">
               <img 
                src={product.image || `https://picsum.photos/seed/${product.name}/500/300?blur=2`} 
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover" 
              />
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center relative z-10">
              <h3 className="text-sm font-bold text-white group-hover:text-accent transition-colors truncate">{product.name}</h3>
              <p className="text-[10px] text-gray-300 truncate mt-0.5">{product.description}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-black text-accent">${product.price.toFixed(2)}</span>
                <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-md text-gray-200 font-bold border border-white/10 backdrop-blur-sm">
                  {cart.find(c => c.product.id === product.id)?.quantity || 0} en carrito
                </span>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Sidebar Cart Bento Item - Restore to original location */}
        <aside className="bento-card md:row-span-4 bg-[#0F0F0F] flex flex-col p-6 h-full md:max-h-[90vh] sticky top-5 shadow-2xl overflow-hidden min-h-[400px] border border-border-dark hidden md:flex">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-dark">
            <h2 className="text-2xl font-extrabold tracking-tight">Tu Pedido</h2>
            {cart.length > 0 && checkoutStep === 'cart' && (
              <button onClick={clearCart} className="text-text-dim hover:text-red-400 transition-colors p-1">
                <Trash2 size={18} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto relative space-y-6 pr-2 scrollbar-thin scrollbar-thumb-accent/20">
            <AnimatePresence mode="popLayout" initial={false}>
              {checkoutStep === 'tracking' ? (
                 <motion.div 
                   key="desktop-tracking"
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
                   key="desktop-details"
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
                   key="desktop-payment"
                   initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                   className="flex flex-col gap-4 py-4"
                 >
                   <h3 className="text-lg font-bold text-white mb-2">Método de pago</h3>
                   
                   {paymentMode === 'select' ? (
                     <>
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
                         <span className="font-bold">Tarjeta de Crédito / Débito presencial</span>
                         <ChevronRight size={18} className="text-text-dim" />
                       </button>
                       {!businessSettings.theme?.online_payments_hidden && (businessSettings.alias || businessSettings.cbu) && (
                         <button 
                           onClick={() => setPaymentMode('transfer')}
                           disabled={isProcessing}
                           className="w-full bg-accent hover:bg-yellow-400 text-black p-4 rounded-xl flex items-center justify-between transition-colors mt-2"
                         >
                           <span className="font-bold">Transferencia / MercadoPago (Subir Comprobante)</span>
                           <ChevronRight size={18} />
                         </button>
                       )}
                       {isProcessing && (
                         <div className="flex items-center justify-center gap-2 mt-4 text-accent">
                           <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                             <Clock size={16} />
                           </motion.div>
                           <span className="text-sm font-bold animate-pulse">Procesando pedido...</span>
                         </div>
                       )}
                     </>
                   ) : (
                     <div className="flex flex-col gap-4">
                        <div className="bg-[#111] border border-[#333] p-4 rounded-xl relative">
                           <button 
                             onClick={() => setPaymentMode('select')}
                             className="absolute top-2 right-2 text-gray-500 hover:text-white"
                           >
                              <X size={20} />
                           </button>
                           <h4 className="font-bold text-accent mb-2">Datos de Transferencia</h4>
                           <div className="space-y-2 mb-4 bg-black/40 p-3 rounded-lg border border-white/5">
                             <div className="flex justify-between items-center text-xs">
                               <span className="text-gray-400">Titular:</span>
                               <div className="flex items-center gap-2">
                                 <strong className="text-white">{businessSettings.holder_name || 'No configurado'}</strong>
                                 <button onClick={() => { if(businessSettings.holder_name) { navigator.clipboard.writeText(businessSettings.holder_name); alert('Nombre copiado'); } }} className="bg-accent/10 text-accent p-1 rounded hover:bg-accent hover:text-black transition-colors">Copiar</button>
                               </div>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                               <span className="text-gray-400">Alias:</span>
                               <div className="flex items-center gap-2">
                                 <strong className="text-white">{businessSettings.alias || 'Cargando...'}</strong>
                                 <button 
                                   onClick={() => {
                                      navigator.clipboard.writeText(businessSettings.alias);
                                      alert('Alias copiado');
                                   }}
                                   className="bg-accent/10 text-accent p-1 rounded hover:bg-accent hover:text-black transition-colors"
                                 >
                                   Copiar
                                 </button>
                               </div>
                             </div>
                             <div className="flex justify-between items-center text-xs">
                               <span className="text-gray-400">CBU:</span>
                               <div className="flex items-center gap-2 font-mono">
                                 <strong className="text-white">{businessSettings.cbu || 'Cargando...'}</strong>
                                 <button 
                                   onClick={() => {
                                      navigator.clipboard.writeText(businessSettings.cbu);
                                      alert('CBU copiado');
                                   }}
                                   className="bg-accent/10 text-accent p-1 rounded hover:bg-accent hover:text-black transition-colors"
                                 >
                                   Copiar
                                 </button>
                               </div>
                             </div>
                           </div>
                           
                           {!receiptImage ? (
                             <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-[#444] hover:border-accent hover:bg-accent/5 rounded-xl cursor-pointer transition-all text-gray-400 hover:text-accent group">
                               <div className="bg-[#1a1a1a] p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
                                 <PlusCircle size={32} />
                               </div>
                               <span className="text-sm font-bold">Adjuntar Comprobante</span>
                               <p className="text-[10px] opacity-60 mt-1">Soporta Capturas, PNG, JPG, WEBP</p>
                               <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                             </label>
                           ) : (
                             <div className="flex flex-col gap-3">
                               <div className="relative rounded-xl overflow-hidden border border-[#444] bg-black group flex justify-center items-center">
                                 <img 
                                   src={receiptImage} 
                                   alt="Comprobante" 
                                   className="w-full h-auto max-h-[400px] object-contain cursor-pointer group-hover:opacity-75 transition-opacity" 
                                   onClick={() => { setOriginalReceiptImage(receiptImage); setImageToCrop(rawImage || receiptImage); setReceiptImage(null); setVerdict(null); }}
                                 />
                                 <div className="absolute top-2 right-2 flex gap-2">
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); setReceiptImage(null); setRawImage(null); setVerdict(null); setOriginalReceiptImage(null); }}
                                     className="bg-red-500/90 hover:bg-red-600 text-white rounded-lg p-2 flex items-center shadow-xl transition-colors"
                                     title="Elegir otro comprobante"
                                   >
                                     <Trash2 size={16} />
                                   </button>
                                   <button 
                                     onClick={(e) => { e.stopPropagation(); setOriginalReceiptImage(receiptImage); setImageToCrop(rawImage || receiptImage); setReceiptImage(null); setVerdict(null); }}
                                     className="bg-[#222]/90 hover:bg-[#333] text-white rounded-lg px-3 py-1.5 flex items-center gap-1 shadow-xl text-xs font-bold transition-colors"
                                     title="Editar recorte"
                                   >
                                     ✏️ Editar
                                   </button>
                                 </div>
                               </div>
                               
                               {verdict ? (
                                 <div className={`p-3 rounded-xl border ${verdict.valid ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-red-500/10 border-red-500 text-red-400'}`}>
                                    <h5 className="font-bold text-sm mb-1">{verdict.valid ? '¡Pago Verificado!' : 'Comprobante Rechazado'}</h5>
                                    <p className="text-xs">{verdict.reason}</p>
                                    {!verdict.valid && (
                                       <button onClick={() => { setReceiptImage(null); setVerdict(null); }} className="mt-2 text-white bg-red-500/20 hover:bg-red-500/40 px-3 py-1 rounded text-xs font-bold transition-colors">Volver a intentar</button>
                                    )}
                                 </div>
                               ) : (
                                 <button 
                                   onClick={verifyReceipt}
                                   disabled={isVerifying}
                                   className="w-full bg-accent hover:bg-yellow-400 text-black py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                                 >
                                   {isVerifying ? (
                                      <>
                                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                          <UtensilsCrossed size={18} />
                                        </motion.div>
                                        VERIFICANDO CON IA...
                                      </>
                                   ) : (
                                      <>
                                        <CheckCircle size={18} /> VERIFICAR PAGO
                                      </>
                                   )}
                                 </button>
                               )}
                             </div>
                           )}
                        </div>
                     </div>
                   )}
                 </motion.div>
              ) : cart.length === 0 ? (
                <motion.div 
                  key="desktop-empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center gap-6 text-text-dim py-12"
                >
                  <div className="w-20 h-20 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                    <ShoppingBag size={40} strokeWidth={1} />
                  </div>
                  <p className="text-sm font-medium">Su carrito está esperando<br/>una selección.</p>
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



      </div>

          {/* Render cropper outside to cover everything when cropping */}
          {imageToCrop && (
            <div className="fixed inset-0 z-[100] bg-black flex flex-col">
              <div className="relative flex-1 overflow-auto flex items-center justify-center p-4">
                <ReactCrop
                  crop={crop}
                  onChange={c => setCrop(c)}
                  style={{ maxHeight: '80vh' }}
                >
                  <img
                    ref={imgRef}
                    src={imageToCrop}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '75vh', maxWidth: '100%' }}
                    alt="Comprobante"
                  />
                </ReactCrop>
              </div>
              <div className="bg-[#111] p-6 flex justify-between items-center z-[101]">
                <button onClick={() => { setImageToCrop(null); if (originalReceiptImage) { setReceiptImage(originalReceiptImage); setOriginalReceiptImage(null); } }} className="px-6 py-3 bg-red-500 rounded-xl text-white font-bold">Cancelar</button>
                <button onClick={showCroppedImage} className="px-6 py-3 bg-accent rounded-xl text-black font-bold flex gap-2 items-center"><Crop size={18}/> Recortar</button>
              </div>
            </div>
          )}

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
              
              <div className="flex-1 overflow-auto relative p-6 space-y-6 scrollbar-hide">
                <AnimatePresence mode="popLayout" initial={false}>
                  {checkoutStep === 'tracking' ? (
                    <motion.div 
                      key="tracking"
                      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="h-full flex flex-col items-center justify-center text-center gap-6 text-white py-12 px-4"
                    >
                      {activeOrderStatus === 'on_the_way' ? (
                        <>
                           <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                              <Clock size={80} className="text-orange-500 mb-4 mx-auto" />
                           </motion.div>
                           <h3 className="text-2xl font-bold tracking-tight text-orange-500">¡Ve al mostrador!</h3>
                           <p className="text-sm text-text-dim text-center">Te estamos esperando para entregarte tu pedido.</p>
                        </>
                      ) : activeOrderStatus === 'ready' ? (
                        <>
                           <motion.div 
                              initial={{ scale: 0.8 }}
                              animate={{ scale: [0.8, 1.2, 1] }} 
                              transition={{ duration: 0.5, type: 'spring' }}
                           >
                              <UtensilsCrossed size={80} className="text-accent mb-4 mx-auto" />
                           </motion.div>
                           <h3 className="text-3xl font-black text-accent tracking-tighter">¡PEDIDO LISTO!</h3>
                           <p className="text-base text-gray-300 font-medium">Acércate al mostrador indicando:<br/><span className="text-white font-black text-xl bg-[#222] px-4 py-2 rounded-xl inline-block mt-3 border border-border-dark">{customerName}</span></p>
                           
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
                           <h3 className="text-2xl font-bold text-white tracking-tight">Preparando pedido</h3>
                           <p className="text-sm text-text-dim">¡El comercio ya está trabajando en lo tuyo!</p>
                        </>
                      ) : (
                        <>
                           <Clock size={64} className="text-yellow-500 mb-2 mx-auto animate-pulse" />
                           <h3 className="text-2xl font-bold text-white tracking-tight">Pedido Enviado</h3>
                           <p className="text-sm text-text-dim"></p>
                        </>
                      )}
                    </motion.div>
                  ) : checkoutStep === 'details' ? (
                    <motion.div 
                      key="details"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="flex flex-col gap-6 py-6"
                    >
                      <div className="bg-card-dark border border-border-dark p-6 rounded-2xl">
                        <h3 className="text-xl font-bold text-white mb-2 tracking-tight italic">¿A nombre de quién?</h3>
                        <p className="text-xs text-text-dim mb-4 leading-relaxed">Necesitamos un nombre para identificarte cuando vengas al local a retirar tu pedido.</p>
                        <input
                         type="text"
                         value={customerName}
                         onChange={(e) => setCustomerName(e.target.value)}
                         placeholder="Tu Nombre o Apellido"
                         className="w-full bg-[#111] border border-[#333] text-white p-5 rounded-2xl focus:border-accent focus:outline-none font-bold text-lg shadow-inner"
                        />
                      </div>
                      
                      <button 
                        onClick={() => {
                          if(!customerName.trim()){ alert("Por favor ingresa tu nombre."); return; }
                          localStorage.setItem('studioMenu_customerName', customerName.trim());
                          setCheckoutStep('payment');
                        }}
                        className="w-full bg-accent text-black py-5 rounded-2xl font-black text-sm tracking-[0.2em] uppercase transition-all shadow-xl shadow-accent/20"
                      >
                        Siguiente
                      </button>
                      <button 
                        onClick={() => setCheckoutStep('cart')}
                        className="w-full text-text-dim py-2 font-bold text-xs uppercase opacity-60"
                      >
                        Volver al Carrito
                      </button>
                    </motion.div>
                  ) : checkoutStep === 'payment' ? (
                    <motion.div 
                      key="payment"
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      className="flex flex-col gap-6 py-6"
                    >
                      <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Método de pago</h3>
                      {paymentMode === 'select' ? (
                        <>
                          <button 
                            onClick={() => handleCheckout('efectivo')}
                            disabled={isProcessing}
                            className="w-full bg-[#1a1a1a] border border-border-dark text-white p-5 rounded-2xl flex items-center justify-between transition-colors active:bg-[#222]"
                          >
                            <span className="font-bold">Efectivo al recibir</span>
                            <ChevronRight size={18} className="text-text-dim" />
                          </button>
                          <button 
                            onClick={() => handleCheckout('tarjeta')}
                            disabled={isProcessing}
                            className="w-full bg-[#1a1a1a] border border-border-dark text-white p-5 rounded-2xl flex items-center justify-between transition-colors active:bg-[#222]"
                          >
                            <span className="font-bold">Tarjeta presencial</span>
                            <ChevronRight size={18} className="text-text-dim" />
                          </button>
                          {!businessSettings.theme?.online_payments_hidden && (businessSettings.alias || businessSettings.cbu) && (
                            <button 
                              onClick={() => setPaymentMode('transfer')}
                              disabled={isProcessing}
                              className="w-full bg-accent text-black p-5 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] shadow-xl shadow-accent/10"
                            >
                              <span className="font-black">TRANSFERENCIA / MP</span>
                              <ChevronRight size={18} />
                            </button>
                          )}
                          {isProcessing && (
                            <div className="w-full py-5 text-center text-accent font-bold animate-pulse flex items-center justify-center gap-2">
                               <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                 <Clock size={18} />
                               </motion.div>
                               Procesando...
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-[#0a0a0a] border border-[#222] p-5 rounded-2xl relative shadow-2xl">
                            <button 
                              onClick={() => setPaymentMode('select')}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 shadow-lg z-10"
                            >
                               <X size={16} />
                            </button>
                            <h4 className="font-black text-accent text-xl mb-4 tracking-tighter">Datos de Transferencia</h4>
                            
                            <div className="space-y-4 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-black text-gray-500">Titular</span>
                                <div className="flex items-center justify-between">
                                  <strong className="text-white text-base truncate pr-2">{businessSettings.holder_name || 'No configurado'}</strong>
                                  <button 
                                    onClick={() => {
                                       if (navigator.clipboard && businessSettings.holder_name) {
                                          navigator.clipboard.writeText(businessSettings.holder_name);
                                          alert('Nombre copiado');
                                       }
                                    }}
                                    className="bg-accent/20 text-accent px-3 py-1 rounded-lg text-[10px] font-black"
                                  >
                                    COPIAR
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 border-t border-white/5 pt-4">
                                <span className="text-[10px] uppercase font-black text-gray-500">Alias</span>
                                <div className="flex items-center justify-between">
                                  <strong className="text-white text-base truncate pr-2">{businessSettings.alias || 'No configurado'}</strong>
                                  <button 
                                    onClick={() => {
                                       if (navigator.clipboard && businessSettings.alias) {
                                          navigator.clipboard.writeText(businessSettings.alias);
                                          alert('Alias copiado');
                                       }
                                    }}
                                    className="bg-accent/20 text-accent px-3 py-1 rounded-lg text-[10px] font-black"
                                  >
                                    COPIAR
                                  </button>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 border-t border-white/5 pt-4">
                                <span className="text-[10px] uppercase font-black text-gray-500">CBU / CVU</span>
                                <div className="flex items-center justify-between">
                                  <strong className="text-white text-sm font-mono truncate pr-2">{businessSettings.cbu || 'No configurado'}</strong>
                                  <button 
                                    onClick={() => {
                                       if (navigator.clipboard && businessSettings.cbu) {
                                          navigator.clipboard.writeText(businessSettings.cbu);
                                          alert('CBU copiado');
                                       }
                                    }}
                                    className="bg-accent/20 text-accent px-3 py-1 rounded-lg text-[10px] font-black"
                                  >
                                    COPIAR
                                  </button>
                                </div>
                              </div>
                            </div>
                            
                            {!receiptImage ? (
                              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-[#333] hover:border-accent hover:bg-accent/5 rounded-2xl cursor-pointer transition-all text-gray-400 group">
                                <PlusCircle size={32} className="mb-2 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-black tracking-widest uppercase">Subir Comprobante</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                              </label>
                            ) : (
                              <div className="flex flex-col gap-4">
                                <div className="relative rounded-xl overflow-hidden border border-[#222] bg-black group flex justify-center items-center">
                                  <img 
                                    src={receiptImage} 
                                    alt="Recibo" 
                                    className="w-full h-auto max-h-[400px] object-contain cursor-pointer group-hover:opacity-75 transition-opacity" 
                                    onClick={() => { setOriginalReceiptImage(receiptImage); setImageToCrop(rawImage || receiptImage); setReceiptImage(null); setVerdict(null); }}
                                  />
                                  <div className="absolute top-2 right-2 flex gap-2">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setReceiptImage(null); setRawImage(null); setVerdict(null); setOriginalReceiptImage(null); }}
                                      className="bg-red-500/90 hover:bg-red-600 text-white rounded-lg p-2 shadow-xl transition-colors"
                                      title="Elegir otro comprobante"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setOriginalReceiptImage(receiptImage); setImageToCrop(rawImage || receiptImage); setReceiptImage(null); setVerdict(null); }}
                                      className="bg-[#222]/90 hover:bg-[#333] text-white rounded-lg px-3 py-1.5 shadow-xl flex items-center gap-1 text-xs font-bold transition-colors"
                                    >
                                      ✏️ Editar
                                    </button>
                                  </div>
                                </div>

                                {verdict ? (
                                  <div className={`p-4 rounded-xl border ${verdict.valid ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-300'}`}>
                                    <h5 className="font-black text-sm mb-1">{verdict.valid ? '¡PAGO VERIFICADO!' : 'ERROR EN PAGO'}</h5>
                                    <p className="text-xs leading-relaxed">{verdict.reason}</p>
                                    {!verdict.valid && (
                                      <button onClick={() => { setReceiptImage(null); setVerdict(null); }} className="w-full mt-3 bg-red-500 text-white py-2 rounded-lg text-xs font-bold">Volver a intentar</button>
                                    )}
                                  </div>
                                ) : (
                                  <button onClick={verifyReceipt} disabled={isVerifying} className="w-full bg-accent text-black py-4 rounded-xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-accent/20">
                                    {isVerifying ? 'VERIFICANDO...' : 'VERIFICAR PAGO'}
                                  </button>
                                )}
                              </div>
                            )}
                        </div>
                      )}
                      
                      {checkoutStep === 'payment' && !isProcessing && (
                        <button 
                          onClick={() => setCheckoutStep('details')}
                          className="w-full text-text-dim py-2 font-bold text-xs uppercase opacity-60"
                        >
                          Volver
                        </button>
                      )}
                    </motion.div>
                  ) : cart.length === 0 ? (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center gap-6 text-text-dim py-12"
                    >
                      <div className="w-20 h-20 rounded-full bg-[#1a1a1a] flex items-center justify-center">
                        <ShoppingBag size={40} strokeWidth={1} />
                      </div>
                      <p className="font-medium">Carrito vacío</p>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="items"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      {cart.map(item => (
                        <div key={item.product.id} className="flex flex-col gap-4 bg-card-dark p-4 rounded-2xl border border-border-dark shadow-xl">
                          <div className="flex gap-4 items-center">
                            <img src={item.product.image} className="w-16 h-16 rounded-xl object-cover shadow-lg" alt="" referrerPolicy="no-referrer" />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold truncate text-white">{item.product.name}</h4>
                              <p className="text-accent font-black text-base">${(item.product.price).toFixed(2)}</p>
                            </div>
                            <button onClick={() => removeFromCart(item.product.id)} className="p-2 text-text-dim hover:text-red-500 transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 bg-[#111] rounded-xl px-4 py-2 border border-border-dark flex-1 justify-center shadow-inner">
                              <button onClick={() => updateQuantity(item.product.id, -1)} className="p-1 text-gray-400 hover:text-white"><Minus size={16} /></button>
                              <span className="text-base font-black min-w-[24px] text-center">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.product.id, 1)} className="p-1 text-gray-400 hover:text-white"><Plus size={16} /></button>
                            </div>
                            <span className="text-lg font-black text-accent tracking-tighter">${(item.product.price * item.quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6 bg-card-dark border-t border-border-dark space-y-6 shadow-2xl">
                <div className="flex justify-between items-center text-2xl font-black tracking-tighter">
                  <span>TOTAL</span>
                  <span className="text-accent">${(total || 0).toFixed(2)}</span>
                </div>
                {checkoutStep === 'cart' && cart.length > 0 && (
                  <button 
                    onClick={() => setCheckoutStep('details')}
                    className="w-full bg-accent text-black py-5 rounded-2xl font-black text-lg tracking-widest uppercase shadow-xl shadow-accent/20 transition-all active:scale-[0.98]"
                  >
                    CONTINUAR
                  </button>
                )}
                {checkoutStep === 'tracking' && ['delivered', 'completed'].includes(activeOrderStatus) && (
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
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Tooltip / Floating Active Order Mobile */}
      <AnimatePresence>
        {activeOrderId && activeOrderStatus !== 'completed' && activeOrderStatus !== 'delivered' && checkoutStep !== 'tracking' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            className="fixed bottom-24 right-4 z-40 md:hidden"
          >
            <button
               onClick={() => {
                 setCheckoutStep('tracking');
                 setShowCartMobile(true);
               }}
               className="bg-orange-500 hover:bg-orange-400 text-white p-4 rounded-full shadow-[0_0_20px_rgba(249,115,22,0.4)] flex items-center justify-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 animate-ping rounded-full"></div>
              <Clock size={24} className="relative z-10" />
            </button>
          </motion.div>
        ) : cart.length > 0 && !showCartMobile && checkoutStep !== 'tracking' && (
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
                <span className="text-sm tracking-widest">VER CARRITO ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
              </div>
              <span className="text-lg tracking-tighter">${total.toFixed(2)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Overlay is removed entirely */}
    </div>
  );
}

