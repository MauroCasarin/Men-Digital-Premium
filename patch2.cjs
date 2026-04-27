const fs = require('fs');
let c = fs.readFileSync('src/pages/ClientApp.tsx', 'utf8');

c = c.replace(/show_cash: data\.theme\?\.show_cash !== false,\n\s*show_card: data\.theme\?\.show_card !== false,\n\s*show_transfer: data\.theme\?\.show_transfer !== false/g, "online_payments_hidden: data.theme?.online_payments_hidden || false");

fs.writeFileSync('src/pages/ClientApp.tsx', c);
