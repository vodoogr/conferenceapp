const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
];

function getBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function getRedirectUri(req) {
  return process.env.GOOGLE_REDIRECT_URI || `${getBaseUrl(req)}/api/auth/callback`;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader('Location', location);
  res.end();
}

export default function handler(req, res) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    res.status(500).json({ error: 'Missing GOOGLE_CLIENT_ID' });
    return;
  }

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', getRedirectUri(req));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  redirect(res, authUrl.toString());
}
