import { sql } from '../../lib/db.js';
import { verifyAuth, jsonResponse, errorResponse } from '../../lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await verifyAuth(req);

    if (req.method === 'GET') {
      const { status } = req.query;
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
        'INSERT INTO meetings (user_id, title, status, language, tenant_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [user.sub, title || 'Nueva Reunión', 'RECORDING', language, user.sub]
      );
      return jsonResponse(res, { data: row[0] });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return errorResponse(res, new Error(`Method ${req.method} Not Allowed`), 405);
  } catch (err) {
    return errorResponse(res, err, err.message.includes('Unauthorized') ? 401 : 500);
  }
}
