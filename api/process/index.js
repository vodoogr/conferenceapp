import { sql } from '../../lib/db.js';
import { verifyAuth, jsonResponse, errorResponse } from '../../lib/auth.js';
import { processAudioWithGemini } from '../../lib/gemini.js';

export default async function handler(req, res) {
  try {
    const user = await verifyAuth(req);
    const { meetingId } = req.query;

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return errorResponse(res, new Error('Method Not Allowed'), 405);
    }

    const { audioBase64, mimeType } = req.body;
    if (!audioBase64) return errorResponse(res, new Error('Falta el audioBase64'), 400);

    // 1. Marcar como PROCESSING
    await sql('UPDATE meetings SET status = $1 WHERE id = $2 AND user_id = $3', ['PROCESSING', meetingId, user.sub]);

    // --- PROCESAMIENTO REAL CON GEMINI ---
    console.log(`Enviando audio a Gemini para la reunión ${meetingId}...`);
    
    // Llamar a Gemini (Esto puede tardar hasta 60s)
    const result = await processAudioWithGemini(audioBase64, mimeType);

    // 2. Guardar Transcripción
    await sql(
      'INSERT INTO transcriptions (meeting_id, segments, speakers) VALUES ($1, $2, $3)',
      [meetingId, JSON.stringify(result.transcription || []), JSON.stringify(result.speakers || [])]
    );

    // 3. Guardar Acta
    const min = result.minutes || {};
    await sql(
      'INSERT INTO minutes (meeting_id, title, summary, decisions, action_items, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [meetingId, min.title || 'Acta sin título', min.summary || '', JSON.stringify(min.decisions || []), JSON.stringify(min.action_items || []), 'DRAFT']
    );

    // 4. Marcar como READY y actualizar título
    await sql('UPDATE meetings SET status = $1, title = $2 WHERE id = $3', ['READY', min.title || 'Reunión Procesada', meetingId]);

    console.log(`Reunión ${meetingId} procesada con éxito por Gemini.`);
    return jsonResponse(res, { success: true, status: 'READY' });

  } catch (err) {
    console.error('Process error:', err);
    // Si falla, marcamos como FAILED
    const { meetingId } = req.query;
    if (meetingId) {
      await sql('UPDATE meetings SET status = $1, error_message = $2 WHERE id = $3', ['FAILED', err.message, meetingId]);
    }
    return errorResponse(res, err, err.message.includes('Unauthorized') ? 401 : 500);
  }
}

