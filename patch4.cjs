const fs = require('fs');
let c = fs.readFileSync('src/pages/ClientApp.tsx', 'utf8');

c = c.replace(/\{businessSettings\.theme\?\.show_cash[\s\S]*?Transferencia \(Subir Comprobante\)<\/span>\n\s*<ChevronRight size=\{18\} \/>\n\s*<\/button>\n\s*\)}/g, 
`{businessSettings.theme?.online_payments_hidden ? (
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
                       )}`);

fs.writeFileSync('src/pages/ClientApp.tsx', c);
