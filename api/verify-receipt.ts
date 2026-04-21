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
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { 
              text: `Analiza este comprobante de pago de transferencia o billetera virtual. 
DATOS PARA COMPARAR (ESTRICTO):
1. Monto a pagar: $${expectedTotal}
2. Fecha y hora de hoy: ${expectedDate} ${expectedTime}
3. Cuenta destino para verificar (Alias o CVU): ${businessAlias}
4. Titular de la cuenta: ${holderName}

TAREAS:
- Extrae el ID/Número de Operación o Transacción o Código de Identificación del comprobante. (No debe faltar).
- Extrae el monto de la transferencia.
- Verifica que el estado sea Transferencia recibida, exitoso, OK o similar.
- Verifica destino.

Responde ÚNICAMENTE un JSON válido:
{
  "valid": true o false,
  "transaction_id": "string",
  "detected_amount": numero,
  "detected_datetime": "fecha y hora",
  "reason": "Motivo"
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
       const supabaseUrl = process.env.VITE_SUPABASE_URL;
       const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
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

