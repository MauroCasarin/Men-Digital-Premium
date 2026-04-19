import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UtensilsCrossed, Clock, CheckCircle, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Order } from '../types';

export default function CommerceApp() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  const updateOrderStatus = async (id: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
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

  return (
    <div className="min-h-screen bg-bg-dark text-white p-6 md:p-10 font-sans">
      <header className="bento-card mb-8 p-6 flex justify-between items-center bg-card-dark border-border-dark">
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-3">
          <UtensilsCrossed className="text-accent" size={32} />
          Panel de <span className="text-accent">Comercio</span>
        </h1>
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
                    <p className="text-xs text-text-dim mt-1">
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
                        className="col-span-2 w-full py-3 bg-accent hover:bg-yellow-400 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <CheckCircle size={18} /> Marcar Lista
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
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-6 text-gray-400 flex items-center gap-2">Historial de Turno</h2>
          <div className="flex flex-col gap-3">
            {pastOrders.map(order => {
              const isExpanded = expandedOrders.has(order.id);
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={order.id} 
                  className={`bento-card border transition-colors overflow-hidden ${order.status === 'completed' ? 'bg-[#111] border-border-dark opacity-50' : 'bg-card-dark/40 border-green-500/20 hover:bg-card-dark/60 cursor-pointer'}`}
                  onClick={() => toggleExpand(order.id)}
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-sm text-gray-500">#{order.id.split('-')[0].toUpperCase()}</span>
                      {order.customer_name && (
                         <span className="font-black text-white text-lg tracking-tight">{order.customer_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-accent">${order.total.toFixed(2)}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded border ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {isExpanded ? <ChevronUp size={20} className="text-text-dim" /> : <ChevronDown size={20} className="text-text-dim" />}
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

      <div className="mt-12 p-6 bento-card bg-[#111] border-t-4 border-accent flex justify-between items-center shadow-2xl">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Balance General</p>
          <h3 className="text-xl font-black text-white mt-1">Total Vendido</h3>
        </div>
        <div className="text-3xl font-black text-accent tracking-tighter">
          ${orders.reduce((acc, order) => acc + order.total, 0).toFixed(2)}
        </div>
      </div>
    </div>
  );
}
