// src/utils/api.js
// Cliente HTTP centralizado — reemplaza todos los MOCK_* del frontend
// Maneja: auth headers, refresh de token, errores globales

const BASE_URL = import.meta.env.VITE_API_URL || '';

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

export const tokenStore = {
  get: ()        => localStorage.getItem('conference_token'),
  set: (token)   => localStorage.setItem('conference_token', token),
  clear: ()      => localStorage.removeItem('conference_token'),
};

// ============================================================
// FETCH BASE — añade Authorization header automáticamente
// ============================================================

async function apiFetch(path, options = {}) {
  const token = tokenStore.get();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Token expirado — limpiar y redirigir a login
  if (res.status === 401) {
    tokenStore.clear();
    window.location.href = '/';
    throw new Error('Sesión expirada');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status}`);
  }

  return data;
}

// ============================================================
// AUTH
// ============================================================

export const auth = {
  // Redirige a Google OAuth
  loginWithGoogle: () => {
    window.location.href = `${BASE_URL}/api/auth/google`;
  },

  // Procesa el token después del callback
  // Llamar en /auth/success?token=xxx
  handleCallback: () => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    if (token) {
      tokenStore.set(token);
      window.location.href = '/';
      return true;
    }
    return false;
  },

  logout: () => {
    tokenStore.clear();
    window.location.href = '/';
  },

  isAuthenticated: () => !!tokenStore.get(),
};

// ============================================================
// MEETINGS
// ============================================================

export const meetings = {
  list: ({ limit = 20, offset = 0, status } = {}) => {
    const params = new URLSearchParams({ limit, offset });
    if (status) params.set('status', status);
    return apiFetch(`/api/meetings?${params}`);
  },

  get: (id) => apiFetch(`/api/meetings/${id}`),

  create: ({ title, language = 'es-ES' }) =>
    apiFetch('/api/meetings', {
      method: 'POST',
      body:   JSON.stringify({ title, language }),
    }),

  update: (id, updates) =>
    apiFetch(`/api/meetings/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(updates),
    }),

  delete: (id) =>
    apiFetch(`/api/meetings/${id}`, { method: 'DELETE' }),
};

// ============================================================
// UPLOAD AUDIO
// ============================================================

export const upload = {
  // Paso 1: obtener URL de upload de Drive
  getPresignedUrl: ({ meetingId, fileName, mimeType, fileSize }) =>
    apiFetch('/api/upload/presigned', {
      method: 'POST',
      body:   JSON.stringify({ meetingId, fileName, mimeType, fileSize }),
    }),

  // Paso 2: subir el Blob directamente a Drive (sin pasar por nuestro servidor)
  uploadToDrive: async (uploadUrl, blob, onProgress) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', blob.type);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload  = () => resolve(xhr.status);
      xhr.onerror = () => reject(new Error('Upload falló'));
      xhr.send(blob);
    });
  },

  // Alternativa: enviar audio base64 directamente al pipeline
  // Para audios pequeños (<10MB) o cuando Drive no está conectado
  uploadBase64: async (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]); // solo base64
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },
};

// ============================================================
// PROCESS — pipeline completo
// ============================================================

export const process = {
  // Procesar reunión con audio base64 (para audios <10MB o sin Drive)
  run: (meetingId, { audioBase64, mimeType, driveFileId }) =>
    apiFetch(`/api/process/${meetingId}`, {
      method: 'POST',
      body:   JSON.stringify({ audioBase64, mimeType, driveFileId }),
    }),

  // Polling del status (cada 3s mientras está PROCESSING)
  pollStatus: (meetingId, onUpdate, maxAttempts = 60) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const { data } = await meetings.get(meetingId);
        onUpdate(data);

        if (data.status === 'READY' || data.status === 'FAILED' || attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval); // cleanup function
  },
};

// ============================================================
// TRANSCRIPTIONS
// ============================================================

export const transcriptions = {
  get: (meetingId) =>
    apiFetch(`/api/transcriptions/${meetingId}`),

  renameSpeaker: (meetingId, { label, name }) =>
    apiFetch(`/api/transcriptions/${meetingId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ label, name }),
    }),
};

// ============================================================
// MINUTES
// ============================================================

export const minutesApi = {
  get: (meetingId) =>
    apiFetch(`/api/minutes/${meetingId}`),

  update: (meetingId, updates) =>
    apiFetch(`/api/minutes/${meetingId}`, {
      method: 'PATCH',
      body:   JSON.stringify(updates),
    }),

  finalize: (meetingId) =>
    apiFetch(`/api/minutes/${meetingId}`, {
      method: 'PATCH',
      body:   JSON.stringify({ status: 'FINAL' }),
    }),

  exportToDrive: (meetingId) =>
    apiFetch(`/api/minutes/${meetingId}/export`, {
      method: 'POST',
    }),
};

// ============================================================
// ASSISTANT
// ============================================================

export const assistant = {
  chat: (meetingId, message) =>
    apiFetch('/api/assistant/chat', {
      method: 'POST',
      body:   JSON.stringify({ meetingId, message }),
    }),
};
