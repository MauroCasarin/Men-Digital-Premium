import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, expectedTotal, expectedDate, expectedTime, businessAlias, holderName } = req.body;
    
    // Usamos GOOGLE_AI_KEY para evitar bloqueos por nombres reservados
    const apiKey = process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Falta la clave GOOGLE_AI_KEY en Vercel." });
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    // Limpiar el base64 prefix si existe
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          role: "user",
          parts: [
            { 
              text: `Sos un sistema antifraude para un comercio argentino. Analizá este comprobante de pago con MÁXIMO RIGOR.

DATOS ESPERADOS:
- Monto exacto: $${expectedTotal}
- Fecha de hoy: ${expectedDate}
- Hora actual: ${expectedTime} (el comprobante debe ser de los últimos 30 minutos)
- Alias o CBU/CVU destino: ${businessAlias}
- Titular de la cuenta destino: ${holderName}

VERIFICACIONES OBLIGATORIAS (todas deben cumplirse para ser válido):
1. ¿El estado dice explícitamente "Comprobante de transferencia" o "Transferencia recibida"? Si dice "enviada", "en proceso" o no está claro: INVÁLIDO.
2. ¿El monto coincide exactamente con $${expectedTotal}? Tolerancia: $0.
3. ¿La fecha es de hoy ${expectedDate}? Si es de otro día: INVÁLIDO.
4. ¿La hora está dentro de los últimos 30 minutos respecto a ${expectedTime}? Si es más antigua: INVÁLIDO.
5. ¿El destinatario coincide con el alias "${businessAlias}" o el titular "${holderName}"? Buscar en el campo "Para" o "Destinatario".
6. ¿Tiene número de operación o ID de transacción visible?
7. ¿La imagen parece ser una captura real de una app bancaria o billetera virtual? Si parece editada, con fuentes inconsistentes, o datos superpuestos artificialmente: INVÁLIDO.

Extraé también:
- CUIT/CUIL del emisor (campo "De" o similar)
- Número de operación/transacción

Respondé ÚNICAMENTE con este JSON válido:
{
  "valid": true o false,
  "transaction_id": "string o null",
  "issuer_cuit_cuil": "string o null",
  "detected_amount": numero,
  "detected_datetime": "string",
  "reason": "Explicación clara de por qué es válido o cuál verificación falló"
}` 
            },
            { 
              inlineData: { 
                mimeType: "image/jpeg",
                data: base64Data
              } 
            }
          ]
        }
      ],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const content = response.text;
    
    if (!content) {
      return res.status(500).json({ error: "La IA no devolvió una respuesta válida." });
    }

    const parsed = JSON.parse(content);
    
    if (parsed.valid && parsed.transaction_id) {
       // Validate against duplicate
       const supabaseUrl = process.env.SUPABASE_URL;
       const supabaseKey = process.env.SUPABASE_ANON_KEY;
       if (supabaseUrl && supabaseKey) {
           const supabase = createClient(supabaseUrl, supabaseKey);
           const { data, error } = await supabase.from('orders').select('id').eq('receipt_id', parsed.transaction_id.trim());
           if (data && data.length > 0) {
              parsed.valid = false;
              parsed.reason = "Este código de identificación de comprobante ya fue utilizado en otro pedido.";
           }
       }
    }

    res.json(parsed);
    
  } catch (error) {
    console.error("Verify receipt error:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor Vercel" });
  }
}

