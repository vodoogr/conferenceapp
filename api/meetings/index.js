import { sql } from '../../lib/db.js';
import { verifyAuth, jsonResponse, errorResponse } from '../../lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await verifyAuth(req);

    if (req.method === 'GET') {
      const { status, id } = req.query;
      
      // Si piden un ID específico
      if (id) {
        const rows = await sql('SELECT * FROM meetings WHERE id = $1 AND user_id = $2', [id, user.sub]);
        if (rows.length === 0) return errorResponse(res, new Error('Not found'), 404);
        return jsonResponse(res, { data: rows[0] });
      }

      // Si piden la lista completa (con o sin filtro de status)
      let queryText = 'SELECT * FROM meetings WHERE user_id = $1 ORDER BY recorded_at DESC';
      let params = [user.sub];

      if (status) {
        queryText = 'SELECT * FROM meetings WHERE user_id = $1 AND status = $2 ORDER BY recorded_at DESC';
        params.push(status);
      }

      const rows = await sql(queryText, params);
      return jsonResponse(res, { data: rows });
    }

    if (req.method === 'POST') {
      const { title, language = 'es-ES' } = req.body;
      const row = await sql(
        'INSERT INTO meetings (user_id, title, status, language) VALUES ($1, $2, $3, $4) RETURNING *',
        [user.sub, title || 'Nueva Reunión', 'RECORDING', language]
      );
      return jsonResponse(res, { data: row[0] });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return errorResponse(res, new Error('ID requerido'), 400);
      await sql('DELETE FROM meetings WHERE id = $1 AND user_id = $2', [id, user.sub]);
      return jsonResponse(res, { success: true });
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      const { title } = req.body;
      if (!id) return errorResponse(res, new Error('ID requerido'), 400);
      const row = await sql(
        'UPDATE meetings SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
        [title, id, user.sub]
      );
      return jsonResponse(res, { data: row[0] });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE', 'PATCH']);
    return errorResponse(res, new Error(`Method ${req.method} Not Allowed`), 405);
  } catch (err) {
    return errorResponse(res, err, err.message.includes('Unauthorized') ? 401 : 500);
  }
}
