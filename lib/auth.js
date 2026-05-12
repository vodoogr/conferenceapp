import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;

export async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: No token provided');
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload; // { sub, email, name, ... }
  } catch (err) {
    throw new Error('Unauthorized: Invalid token');
  }
}

export function jsonResponse(res, data, status = 200) {
  res.status(status).json(data);
}

export function errorResponse(res, err, status = 500) {
  console.error(err);
  res.status(status).json({ error: err.message || 'Internal Server Error' });
}
