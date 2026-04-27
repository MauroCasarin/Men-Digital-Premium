const fs = require('fs');

let c = fs.readFileSync('src/pages/ClientApp.tsx', 'utf8');

const targetDesktop = `                   {paymentMode === 'select' ? (
                     <>
                       {businessSettings.theme?.show_cash !== false && (
                         <button 
                           onClick={() => handleCheckout('efectivo')}
                           disabled={isProcessing}
                           className="w-full bg-[#222] hover:bg-[#333] border border-border-dark text-white p-4 rounded-xl flex items-center justify-between transition-colors"
                         >
                           <span className="font-bold">Efectivo al retirar</span>
                           <ChevronRight size={18} className="text-text-dim" />
                         </button>
                       )}
                       {businessSettings.theme?.show_card !== false && (
                         <button 
                           onClick={() => handleCheckout('tarjeta')}
                           disabled={isProcessing}
                           className="w-full bg-[#222] hover:bg-[#333] border border-border-dark text-white p-4 rounded-xl flex items-center justify-between transition-colors"
                         >
                           <span className="font-bold">Tarjeta presencial</span>
                           <ChevronRight size={18} className="text-text-dim" />
                         </button>
                       )}
                       {businessSettings.theme?.show_transfer !== false && (businessSettings.alias || businessSettings.cbu) && (
                         <button 
                           onClick={() => setPaymentMode('transfer')}
                           disabled={isProcessing}
                           className="w-full bg-accent hover:bg-yellow-400 text-black p-4 rounded-xl flex items-center justify-between transition-colors mt-2"
                         >
                           <span className="font-bold">Transferencia (Subir Comprobante)</span>
                           <ChevronRight size={18} />
                         </button>
                       )}
                     </>`;

const targetMobile = `                      {paymentMode === 'select' ? (
                        <>
                          {businessSettings.theme?.show_cash !== false && (
                            <button 
                              onClick={() => handleCheckout('efectivo')}
                              disabled={isProcessing}
                              className="w-full bg-[#1a1a1a] border border-border-dark text-white p-5 rounded-2xl flex items-center justify-between transition-colors active:bg-[#222]"
                            >
                              <span className="font-bold">Efectivo al retirar</span>
                              <ChevronRight size={18} className="text-text-dim" />
                            </button>
                          )}
                          {businessSettings.theme?.show_card !== false && (
                            <button 
                              onClick={() => handleCheckout('tarjeta')}
                              disabled={isProcessing}
                              className="w-full bg-[#1a1a1a] border border-border-dark text-white p-5 rounded-2xl flex items-center justify-between transition-colors active:bg-[#222]"
                            >
                              <span className="font-bold">Tarjeta presencial</span>
                              <ChevronRight size={18} className="text-text-dim" />
                            </button>
                          )}
                          {businessSettings.theme?.show_transfer !== false && (businessSettings.alias || businessSettings.cbu) && (
                            <button 
                              onClick={() => setPaymentMode('transfer')}
                              disabled={isProcessing}
                              className="w-full bg-accent text-black p-5 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] shadow-xl shadow-accent/10 mt-2"
                            >
                              <span className="font-bold">Transferencia (Subir Comprobante)</span>
                              <ChevronRight size={18} />
                            </button>
                          )}
                        </>`;

const repDesktop = `                   {paymentMode === 'select' ? (
                     <>
                       {businessSettings.theme?.online_payments_hidden ? (
                         <>
                           <button 
                             onClick={() => handleCheckout('efectivo')}
                             disabled={isProcessing}
                             className="w-full bg-[#222] hover:bg-[#333] border border-border-dark text-white p-4 rounded-xl flex items-center justify-between transition-colors"
                           >
                             <span className="font-bold">Efectivo al retirar</span>
                             <ChevronRight size={18} className="text-text-dim" />
                           </button>
                           <button 
                             onClick={() => handleCheckout('tarjeta')}
                             disabled={isProcessing}
                             className="w-full bg-[#222] hover:bg-[#333] border border-border-dark text-white p-4 rounded-xl flex items-center justify-between transition-colors mt-2"
                           >
                             <span className="font-bold">Tarjeta presencial</span>
                             <ChevronRight size={18} className="text-text-dim" />
                           </button>
                         </>
                       ) : (
                         (businessSettings.alias || businessSettings.cbu) && (
                           <button 
                             onClick={() => setPaymentMode('transfer')}
                             disabled={isProcessing}
                             className="w-full bg-accent hover:bg-yellow-400 text-black p-4 rounded-xl flex items-center justify-between transition-colors mt-2"
                           >
                             <span className="font-bold">Transferencia (Subir Comprobante)</span>
                             <ChevronRight size={18} />
                           </button>
                         )
                       )}
                     </>`;

const repMobile = `                      {paymentMode === 'select' ? (
                        <>
                          {businessSettings.theme?.online_payments_hidden ? (
                            <>
                              <button 
                                onClick={() => handleCheckout('efectivo')}
                                disabled={isProcessing}
                                className="w-full bg-[#1a1a1a] border border-border-dark text-white p-5 rounded-2xl flex items-center justify-between transition-colors active:bg-[#222]"
                              >
                                <span className="font-bold">Efectivo al retirar</span>
                                <ChevronRight size={18} className="text-text-dim" />
                              </button>
                              <button 
                                onClick={() => handleCheckout('tarjeta')}
                                disabled={isProcessing}
                                className="w-full bg-[#1a1a1a] border border-border-dark text-white p-5 rounded-2xl flex items-center justify-between transition-colors active:bg-[#222] mt-2"
                              >
                                <span className="font-bold">Tarjeta presencial</span>
                                <ChevronRight size={18} className="text-text-dim" />
                              </button>
                            </>
                          ) : (
                            (businessSettings.alias || businessSettings.cbu) && (
                              <button 
                                onClick={() => setPaymentMode('transfer')}
                                disabled={isProcessing}
                                className="w-full bg-accent text-black p-5 rounded-2xl flex items-center justify-between transition-all active:scale-[0.98] shadow-xl shadow-accent/10 mt-2"
                              >
                                <span className="font-bold">Transferencia (Subir Comprobante)</span>
                                <ChevronRight size={18} />
                              </button>
                            )
                          )}
                        </>`;

if(c.includes(targetDesktop)) c = c.replace(targetDesktop, repDesktop);
if(c.includes(targetMobile)) c = c.replace(targetMobile, repMobile);
fs.writeFileSync('src/pages/ClientApp.tsx', c);
