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

    // --- PROCESAMIENTO SIMULADO (Síncrono para Vercel Serverless) ---
    // En producción con audios largos, esto requeriría Vercel Background Functions o Inngest.
    
    // Simulando una pequeña pausa (1 segundo) para que se vea la UI de procesando
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulando transcripción
    const dummySegments = JSON.stringify([{
      id: '1', start_ms: 0, end_ms: 5000,
      speaker_label: 'S1', speaker_name: 'Speaker 1',
      text: 'Hola, esta es una transcripción de prueba generada automáticamente. El sistema de procesamiento ya está funcionando perfectamente en el servidor.'
    }]);
    const dummySpeakers = JSON.stringify([{ label: 'S1', name: 'Speaker 1' }]);

    await sql(
      'INSERT INTO transcriptions (meeting_id, segments, speakers) VALUES ($1, $2, $3)',
      [meetingId, dummySegments, dummySpeakers]
    );

    // Simulando Acta
    await sql(
      'INSERT INTO minutes (meeting_id, title, summary, status) VALUES ($1, $2, $3, $4)',
      [meetingId, 'Acta de Reunión (Demo)', 'Esta reunión fue procesada correctamente y el servidor guardó los datos en NeonDB.', 'DRAFT']
    );

    // Marcar como READY
    await sql('UPDATE meetings SET status = $1, duration_sec = $2 WHERE id = $3', ['READY', 5, meetingId]);

    // Responder que ya está listo
    return jsonResponse(res, { success: true, status: 'READY' });

  } catch (err) {
    console.error('Process error:', err);
    return errorResponse(res, err, err.message.includes('Unauthorized') ? 401 : 500);
  }
}

