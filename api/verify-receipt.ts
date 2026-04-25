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
      model: "gemini-2.0-flash-exp",
      contents: [
        {
          role: "user",
          parts: [
            { 
              text: `Analiza este comprobante de pago de transferencia o billetera virtual de Argentina. 
DATOS PARA COMPARAR (ESTRICTO):
1. Monto a pagar: $${expectedTotal}
2. Fecha y hora de hoy: ${expectedDate} ${expectedTime}
3. Cuenta destino para verificar (Alias o CVU/CBU): ${businessAlias}
4. Titular de la cuenta destino: ${holderName}

TAREAS EXCLUYENTES:
- Extrae el ID/Número de Operación o Transacción (ej. 155262852608 o 44642124).
- Extrae el CUIT/CUIL del emisor (ej. 20-24788214-7 o 27266872637).
- Verifica estrictamente que el Estado del Pago sea "Transferencia recibida" o "Comprobante de transferencia". Si dice "Transferencia enviada", "En proceso", o no lo especifica claramente como recibida/comprobante, es inválido.
- Extrae el monto de la transferencia y verifica destino.

Responde ÚNICAMENTE un JSON válido con esta estructura:
{
  "valid": true o false,
  "transaction_id": "string",
  "issuer_cuit_cuil": "string (o null si no lo encuentra)",
  "detected_amount": numero,
  "detected_datetime": "fecha y hora",
  "reason": "Explicación breve de por qué es válido o inválido"
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

