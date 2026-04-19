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
      const apiKey = process.env.MENU;

      if (!apiKey) {
        return res.status(500).json({ error: "La API KEY de GROQ (MENU) no está configurada en los Secrets." });
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
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error("Groq API Error:", data);
        return res.status(500).json({ error: "La IA de verificación está ocupada o falló. Intenta de nuevo en unos segundos." });
      }

      const content = data.choices?.[0]?.message?.content;
      
      if (!content) {
        return res.status(500).json({ error: "La IA no devolvió una respuesta válida." });
      }

      try {
        const parsed = JSON.parse(content);
        res.json(parsed);
      } catch (e) {
        console.error("Failed to parse vision response:", content);
        res.status(500).json({ error: "La respuesta de la IA no fue en formato válido. Intenta subir una foto más clara." });
      }
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
