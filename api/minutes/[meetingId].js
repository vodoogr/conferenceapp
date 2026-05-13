import { sql } from '../../lib/db.js';
import { verifyAuth, jsonResponse, errorResponse } from '../../lib/auth.js';

export default async function handler(req, res) {
  try {
    const user = await verifyAuth(req);
    const { meetingId } = req.query;

    const meeting = await sql('SELECT id FROM meetings WHERE id = $1 AND user_id = $2', [meetingId, user.sub]);
    if (meeting.length === 0) return errorResponse(res, new Error('Not found'), 404);

    if (req.method === 'GET') {
      const rows = await sql('SELECT * FROM minutes WHERE meeting_id = $1', [meetingId]);
      if (rows.length === 0) return errorResponse(res, new Error('No minutes yet'), 404);
      return jsonResponse(res, { data: rows[0] });
    }

    res.setHeader('Allow', ['GET']);
    return errorResponse(res, new Error('Method Not Allowed'), 405);
  } catch (err) {
    return errorResponse(res, err, err.message.includes('Unauthorized') ? 401 : 500);
  }
}
