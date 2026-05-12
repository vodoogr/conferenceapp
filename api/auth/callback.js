import { SignJWT } from 'jose';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function getBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function getFrontendUrl(req) {
  return process.env.FRONTEND_URL || getBaseUrl(req);
}

function getRedirectUri(req) {
  return process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(req)}/api/auth/callback`;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export default async function handler(req, res) {
  const frontendUrl = getFrontendUrl(req);

  try {
    const { code, error } = req.query || {};

    if (error) {
      redirect(res, `${frontendUrl}/auth/error?reason=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      redirect(res, `${frontendUrl}/auth/error?reason=missing_code`);
      return;
    }

    const params = new URLSearchParams({
      code,
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      redirect_uri: getRedirectUri(req),
      grant_type: 'authorization_code',
    });

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'Google token exchange failed');
    }

    const userResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const user = await userResponse.json();
    if (!userResponse.ok) {
      throw new Error(user.error_description || user.error || 'Google userinfo failed');
    }

    const secret = new TextEncoder().encode(requireEnv('JWT_SECRET'));
    const jwt = await new SignJWT({
      sub: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    redirect(res, `${frontendUrl}/auth/success?token=${encodeURIComponent(jwt)}`);
  } catch (err) {
    redirect(res, `${frontendUrl}/auth/error?reason=${encodeURIComponent(err.message)}`);
  }
}
