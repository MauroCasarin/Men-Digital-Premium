export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, expectedTotal, expectedDate, expectedTime, businessAlias, holderName } = req.body;
    const apiKey = process.env.GROQ_API_KEY || process.env.MENU;

    if (!apiKey) {
      return res.status(500).json({ error: "La API KEY de GROQ no está configurada en los Secrets de Vercel." });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: `Analiza este comprobante de pago de transferencia o billetera virtual. 
DATOS PARA COMPARAR (MUY ESTRICTO):
1. Monto a pagar: $${expectedTotal}
2. Fecha requerida: ${expectedDate}
3. Hora de hoy: ${expectedTime} (El comprobante debe ser de hace minutos).
4. Cuenta destino para verificar (Alias): ${businessAlias}
5. Titular de la cuenta: ${holderName}

TAREAS:
- Extrae el monto de la transferencia.
- Extrae la fecha y hora.
- Verifica que el estado sea exitoso.
- Verifica que el destino sea "${businessAlias}" o el titular "${holderName}".

Responde ÚNICAMENTE un JSON:
{
  "valid": true o false,
  "detected_amount": numero,
  "detected_datetime": "fecha y hora",
  "reason": "Motivo breve"
}` 
              },
              { 
                type: "image_url", 
                image_url: { 
                  url: imageBase64 
                } 
              }
            ]
          }
        ],
        temperature: 0.1
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Groq API Error:", data);
      return res.status(500).json({ error: "La IA de verificación falló. Intenta de nuevo." });
    }

    let content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      return res.status(500).json({ error: "La IA no devolvió una respuesta válida." });
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (e) {
      console.error("Failed to parse vision response:", content);
      res.status(500).json({ error: "La respuesta de la IA no fue válida." });
    }
  } catch (error) {
    console.error("Verify receipt error:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor Vercel" });
  }
}
