import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware extra to handle large images
  app.use(express.json({ limit: "20mb" }));

  // API for Groq Analysis
  app.post("/api/verify-receipt", async (req, res) => {
    try {
      const { imageBase64, expectedTotal, expectedDate, expectedTime, businessAlias, holderName } = req.body;
      const apiKey = process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Falta la clave GOOGLE_AI_KEY en Vercel." });
      }

      const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { 
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

Responde ÚNICAMENTE un JSON válido:
{
  "valid": true o false,
  "detected_amount": numero,
  "detected_datetime": "fecha y hora",
  "reason": "Motivo breve"
}` 
                },
                { 
                  inline_data: { 
                    mime_type: "image/jpeg",
                    data: base64Data
                  } 
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            response_mime_type: "application/json"
          }
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error("Gemini API Error:", data);
        const errorMsg = data?.error?.message || JSON.stringify(data);
        return res.status(500).json({ error: `Fallo Gemini: ${errorMsg}` });
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        return res.status(500).json({ error: "La IA no devolvió una respuesta válida." });
      }

      const parsed = JSON.parse(content);
      res.json(parsed);
      
    } catch (error: any) {
      console.error("Verify receipt error:", error);
      res.status(500).json({ error: error.message || "Error interno del servidor" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
