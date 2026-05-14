import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function processAudioWithGemini(audioBase64, mimeType) {
  const base64Data = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;

  const prompt = `
Eres un asistente de reuniones experto y preciso. Analiza el siguiente audio de una reunión.
Debes identificar a los diferentes hablantes (S1, S2...) y generar tanto la transcripción como el acta (resumen).
Devuelve tu respuesta basándote estrictamente en el esquema JSON proporcionado.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType || 'audio/webm' } },
            { text: prompt }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: {
              type: Type.ARRAY,
              description: "Lista de segmentos de voz detectados.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  start_ms: { type: Type.INTEGER },
                  end_ms: { type: Type.INTEGER },
                  speaker_label: { type: Type.STRING },
                  speaker_name: { type: Type.STRING },
                  text: { type: Type.STRING }
                },
                required: ["id", "start_ms", "end_ms", "speaker_label", "speaker_name", "text"]
              }
            },
            speakers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  name: { type: Type.STRING }
                },
                required: ["label", "name"]
              }
            },
            minutes: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                decisions: { type: Type.ARRAY, items: { type: Type.STRING } },
                action_items: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "summary", "decisions", "action_items"]
            }
          },
          required: ["transcription", "speakers", "minutes"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error en Gemini:", error);
    throw new Error("Fallo al procesar con la IA: " + error.message);
  }
}
