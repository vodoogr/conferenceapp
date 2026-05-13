import { sql } from '../../lib/db.js';
import { verifyAuth, jsonResponse, errorResponse } from '../../lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await verifyAuth(req);
    const { meetingId } = req.query;

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return errorResponse(res, new Error('Method Not Allowed'), 405);
    }

    // 1. Marcar como PROCESSING
    await sql('UPDATE meetings SET status = $1 WHERE id = $2 AND user_id = $3', ['PROCESSING', meetingId, user.sub]);

    // Responder inmediatamente para no hacer timeout
    jsonResponse(res, { success: true, status: 'PROCESSING' });

    // --- AQUI IRÍA LA LLAMADA REAL A GEMINI ---
    // Como esto es un entorno serverless, la llamada larga debería ir en un Background Function
    // o procesarse de forma asíncrona. Por ahora simularemos que Gemini tarda 5 segundos
    // y luego actualiza a READY.
    
    setTimeout(async () => {
      try {
        // Simulando transcripción
        const dummySegments = JSON.stringify([{
          id: '1', start_ms: 0, end_ms: 5000,
          speaker_label: 'S1', speaker_name: 'Speaker 1',
          text: 'Hola, esta es una transcripción de prueba generada automáticamente.'
        }]);
        const dummySpeakers = JSON.stringify([{ label: 'S1', name: 'Speaker 1' }]);

        await sql(
          'INSERT INTO transcriptions (meeting_id, segments, speakers) VALUES ($1, $2, $3)',
          [meetingId, dummySegments, dummySpeakers]
        );

        // Simulando Acta
        await sql(
          'INSERT INTO minutes (meeting_id, title, summary, status) VALUES ($1, $2, $3, $4)',
          [meetingId, 'Acta de Reunión (Demo)', 'Esta reunión fue procesada correctamente en modo demo.', 'DRAFT']
        );

        // Marcar como READY
        await sql('UPDATE meetings SET status = $1, duration_sec = $2 WHERE id = $3', ['READY', 5, meetingId]);
      } catch (err) {
        console.error('Error in background processing:', err);
        await sql('UPDATE meetings SET status = $1, error_message = $2 WHERE id = $3', ['FAILED', err.message, meetingId]);
      }
    }, 5000);

  } catch (err) {
    return errorResponse(res, err, err.message.includes('Unauthorized') ? 401 : 500);
  }
}
