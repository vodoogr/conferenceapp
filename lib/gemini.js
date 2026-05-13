import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function processAudioWithGemini(audioBase64, mimeType) {
  // Asegurar que solo pasamos el raw base64 (quitamos el prefijo "data:audio/webm;base64," si existe)
  const base64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;

  const prompt = `
Eres un asistente de reuniones experto y preciso. Analiza el siguiente audio de una reunión.
Debes identificar a los diferentes hablantes (S1, S2...) y generar tanto la transcripción como el acta (resumen).

Devuelve tu respuesta EXACTAMENTE en este formato JSON, sin texto adicional ni formato de código (sin \`\`\`json):
{
  "transcription": [
    {
      "id": "1",
      "start_ms": 0,
      "end_ms": 5000,
      "speaker_label": "S1",
      "speaker_name": "Speaker 1",
      "text": "Texto transcrito aquí"
    }
  ],
  "speakers": [
    { "label": "S1", "name": "Speaker 1" }
  ],
  "minutes": {
    "title": "Título sugerido para la reunión",
    "summary": "Un resumen ejecutivo claro de lo que se ha hablado.",
    "decisions": ["Decisión importante 1", "Decisión 2"],
    "action_items": ["Tarea que alguien debe hacer", "Otra tarea"]
  }
}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType || 'audio/webm'
              }
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        temperature: 0.2,
      }
    });

    const text = response.text;
    const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Error en Gemini:", error);
    throw new Error("Fallo al procesar con la IA: " + error.message);
  }
}
