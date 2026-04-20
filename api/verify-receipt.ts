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
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { 
              text: `Analiza este comprobante de pago de transferencia o billetera virtual. 
DATOS PARA COMPARAR (MUY ESTRICTO):
1. Monto a pagar: $${expectedTotal}
2. Fecha requerida: ${expectedDate}
3. Hora de hoy: ${expectedTime} (El comprobante debe ser de hace minutos).
4. Cuenta destino para verificar (Alias o CVU): ${businessAlias}
5. Titular de la cuenta: ${holderName}

TAREAS:
- Extrae el ID/Número de Operación o Transacción del comprobante (búscalo como "Número de operación", "ID", "Transacción").
- Extrae el monto exacto de la transferencia.
- Extrae la fecha y hora.
- Verifica que el estado sea exitoso / OK.
- Verifica que el destino sea "${businessAlias}" o el titular "${holderName}".

Responde ÚNICAMENTE un JSON válido:
{
  "valid": true o false,
  "transaction_id": "string",
  "detected_amount": numero,
  "detected_datetime": "fecha y hora",
  "reason": "Motivo breve"
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
    res.json(parsed);
    
  } catch (error) {
    console.error("Verify receipt error:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor Vercel" });
  }
}
