/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { CartItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateOrderSummary(cart: CartItem[], total: number): Promise<string> {
  if (cart.length === 0) return "El carrito está vacío.";

  const orderDetails = cart.map(item => 
    `- ${item.product.name} x${item.quantity} ($${(item.product.price).toFixed(2)} c/u)${item.instructions ? ` [Instrucciones: ${item.instructions}]` : ""}`
  ).join("\n");

  const prompt = `Eres un asistente de un restaurante de lujo. Tu tarea es generar un resumen profesional y elegante de un pedido de comida para un cliente. El resumen debe enviarse por WhatsApp.

DETALLES DEL PEDIDO:
${orderDetails}

TOTAL: $${total.toFixed(2)}

Por favor, genera un mensaje amigable y bien estructurado en español. Incluye confirmación de los artículos, las instrucciones especiales si las hay, y un saludo final cordial. Usa emojis de forma sutil y profesional. No incluyas el precio total en el cuerpo si ya está al final, asegúrate de que sea claro.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text || "Lo sentimos, no pudimos generar el resumen del pedido. Por favor, intenta de nuevo.";
  } catch (error) {
    console.error("Error generating summary:", error);
    return "Error al generar el resumen. Por favor contacta al restaurante directamente.";
  }
}
