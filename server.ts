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
      const { imageBase64, expectedTotal, expectedDate, expectedTime, businessAlias } = req.body;
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
                  text: `Analiza este comprobante de pago. 
DATOS DE VERIFICACIÓN (ESTRICTO):
1. Monto exacto: $${expectedTotal}
2. Fecha actual: ${expectedDate}
3. Hora aproximada: ${expectedTime} (+/- 30 min)
4. Cuenta destino: ${businessAlias}

TAREAS:
- Identifica el monto transferido.
- Identifica la fecha y hora de la operación en el comprobante.
- Identifica si el estado es "Exitoso", "Aprobado", "Transferencia enviada", etc.
- Verifica que NO sea un comprobante viejo (de otro día u otra hora lejana).
- Verifica que el destinatario coincida con el negocio (si el dato es visible).

Devuelve tu respuesta ÚNICA Y ESTRICTAMENTE en este formato JSON:
{
  "valid": true o false,
  "detected_amount": numero,
  "detected_datetime": "fecha y hora que viste",
  "reason": "explicación detallada de por qué es válido o por qué se rechazó (monto incorrecto, fecha vieja, imagen ilegible, etc)"
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

      const data = await response.json();

      if (!response.ok) {
        console.error("Groq API Error:", data);
        return res.status(500).json({ error: data.error?.message || "Error al comunicarse con la IA." });
      }

      const content = data.choices?.[0]?.message?.content;
      res.json(JSON.parse(content));
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
