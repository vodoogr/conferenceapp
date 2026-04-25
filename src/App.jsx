// src/App.jsx
// ConferenceApp — versión PRODUCCIÓN
// Reemplaza todos los MOCK_* por llamadas reales a la API
// Auth real con Google OAuth + JWT

import { useState, useEffect, useCallback } from 'react';
import { auth, meetings, transcriptions, minutesApi, assistant, process } from './utils/api.js';
import { useRecorder } from './hooks/useRecorder.js';

// ── Design System tokens (mismo que antes) ────────────────
const C = {
  bg:            '#0A0C10',
  surface:       '#111318',
  surfaceEl:     '#161B22',
  border:        '#21262D',
  accent:        '#3B82F6',
  accentDim:     '#1D4ED8',
  accentGlow:    'rgba(59,130,246,0.15)',
  success:       '#10B981',
  warning:       '#F59E0B',
  danger:        '#EF4444',
  text:          '#E6EDF3',
  muted:         '#8B949E',
  dim:           '#484F58',
  purple:        '#A78BFA',
  teal:          '#2DD4BF',
};

const SPEAKER_COLORS = ['#3B82F6','#A78BFA','#2DD4BF','#F59E0B','#EC4899','#10B981'];
const getSC = (label) => SPEAKER_COLORS[(parseInt(label?.replace('S','')) - 1) % SPEAKER_COLORS.length] || C.accent;

const fmtDuration = (sec) => {
  if (!sec) return '--:--';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' }) : '';
const fmtMs   = (ms) => { const s = Math.floor(ms/1000), m = Math.floor(s/60); return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };

// ── Global CSS ────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; background: #0A0C10; color: #E6EDF3; font-family: 'Instrument Sans', sans-serif; -webkit-font-smoothing: antialiased; }
  ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #21262D; border-radius: 2px; }
  @keyframes spin    { to { transform: rotate(360deg); } }
  @keyframes fadeIn  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse   { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(1.05); opacity:.8; } }
  @keyframes pring   { 0% { transform:scale(1); opacity:.8; } 100% { transform:scale(2); opacity:0; } }
  @keyframes dbounce { 0%,80%,100% { transform:scale(.5); opacity:.3; } 40% { transform:scale(1); opacity:1; } }
`;

// ── Micro components ──────────────────────────────────────
const Spinner = ({ size = 16 }) => (
  <div style={{ width:size, height:size, border:`2px solid currentColor`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
);

const Badge = ({ children, v = 'default' }) => {
  const map = {
    default: { bg: C.surfaceEl,                  color: C.muted,    border: C.border },
    success: { bg: 'rgba(16,185,129,.12)',        color: C.success,  border: 'rgba(16,185,129,.25)' },
    warning: { bg: 'rgba(245,158,11,.12)',        color: C.warning,  border: 'rgba(245,158,11,.25)' },
    danger:  { bg: 'rgba(239,68,68,.12)',         color: C.danger,   border: 'rgba(239,68,68,.25)' },
    accent:  { bg: C.accentGlow,                 color: C.accent,   border: 'rgba(59,130,246,.3)' },
    purple:  { bg: 'rgba(167,139,250,.12)',       color: C.purple,   border: 'rgba(167,139,250,.25)' },
  };
  const s = map[v] || map.default;
  return <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:99, fontSize:11, fontWeight:600, letterSpacing:'.04em', background:s.bg, color:s.color, border:`1px solid ${s.border}`, fontFamily:"'Syne',sans-serif" }}>{children}</span>;
};

const Btn = ({ children, onClick, v='primary', size='md', icon, disabled, loading, style={} }) => {
  const map = {
    primary: { bg:C.accent,    color:'#fff',    border:'transparent' },
    ghost:   { bg:'transparent',color:C.muted,  border:C.border },
    danger:  { bg:'rgba(239,68,68,.15)', color:C.danger, border:'rgba(239,68,68,.3)' },
    success: { bg:'rgba(16,185,129,.15)', color:C.success, border:'rgba(16,185,129,.3)' },
    surface: { bg:C.surfaceEl, color:C.text,    border:C.border },
  };
  const s = map[v] || map.primary;
  const p = size==='sm'?'6px 14px':size==='lg'?'12px 28px':'9px 20px';
  const fs = size==='sm'?13:size==='lg'?15:14;
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8, padding:p, fontSize:fs, fontWeight:600, fontFamily:"'Instrument Sans',sans-serif", background:s.bg, color:s.color, border:`1px solid ${s.border}`, borderRadius:8, cursor:(disabled||loading)?'not-allowed':'pointer', opacity:(disabled||loading)?.55:1, transition:'opacity .15s', outline:'none', ...style }}>
      {loading ? <Spinner size={13}/> : null}
      {children}
    </button>
  );
};

const Card = ({ children, style={}, onClick }) => (
  <div onClick={onClick} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20, cursor:onClick?'pointer':'default', animation:'fadeIn .2s ease', transition:'border-color .15s', ...style }}
    onMouseEnter={e => onClick && (e.currentTarget.style.borderColor = C.accent+'50')}
    onMouseLeave={e => onClick && (e.currentTarget.style.borderColor = C.border)}>
    {children}
  </div>
);

const Label = ({ children }) => (
  <div style={{ fontSize:11, fontWeight:700, color:C.muted, letterSpacing:'.1em', marginBottom:10, fontFamily:"'Syne',sans-serif" }}>{children}</div>
);

// ── Nav ───────────────────────────────────────────────────
const Nav = ({ screen, go }) => {
  const tabs = [
    { id:'meetings', label:'Reuniones', path:'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
    { id:'recorder', label:'Grabar',    path:'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8' },
    { id:'assistant',label:'Asistente', path:'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
  ];
  return (
    <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:C.surface, borderTop:`1px solid ${C.border}`, display:'flex', zIndex:100, paddingBottom:'env(safe-area-inset-bottom,8px)' }}>
      {tabs.map(t => {
        const active = screen === t.id || (t.id==='meetings' && ['meeting_detail','transcript','minutes_detail'].includes(screen));
        return (
          <button key={t.id} onClick={() => go(t.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'10px 4px 6px', background:'none', border:'none', cursor:'pointer', color:active?C.accent:C.dim, transition:'color .15s', fontSize:10, fontWeight:600, fontFamily:"'Syne',sans-serif" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={t.path}/>
            </svg>
            {t.label}
          </button>
        );
      })}
    </nav>
  );
};

// ── Error Banner ──────────────────────────────────────────
const ErrorBanner = ({ message, onDismiss }) => message ? (
  <div style={{ margin:'0 16px 12px', padding:'10px 14px', background:'rgba(239,68,68,.1)', border:`1px solid rgba(239,68,68,.3)`, borderRadius:10, display:'flex', alignItems:'center', gap:10, animation:'fadeIn .2s ease' }}>
    <span style={{ fontSize:13, color:C.danger, flex:1 }}>{message}</span>
    <button onClick={onDismiss} style={{ background:'none', border:'none', color:C.danger, cursor:'pointer', fontSize:16 }}>✕</button>
  </div>
) : null;

// ============================================================
// SCREEN: AUTH
// ============================================================
const AuthScreen = () => (
  <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:32, gap:32, background:`radial-gradient(ellipse at 50% 40%, ${C.accentGlow}, transparent 60%)` }}>
    <div style={{ textAlign:'center' }}>
      <div style={{ width:72, height:72, borderRadius:20, background:`linear-gradient(135deg,${C.accent},${C.purple})`, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px', boxShadow:`0 20px 60px ${C.accentGlow}` }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
      </div>
      <h1 style={{ fontSize:36, fontWeight:800, fontFamily:"'Syne',sans-serif", color:C.text, marginBottom:8, letterSpacing:'-.02em' }}>
        Conference<span style={{ color:C.accent }}>App</span>
      </h1>
      <p style={{ fontSize:15, color:C.muted, lineHeight:1.7 }}>Graba, transcribe y genera actas<br/>de tus reuniones con IA</p>
    </div>

    <div style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', maxWidth:300 }}>
      {[['🎙️','Grabación con diarización automática'],['📝','Transcripción en español con Gemini'],['✨','Actas generadas por IA'],['💾','Exportación a Google Drive']].map(([icon,text]) => (
        <div key={text} style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:18 }}>{icon}</span>
          <span style={{ fontSize:13, color:C.muted }}>{text}</span>
        </div>
      ))}
    </div>

    <button onClick={auth.loginWithGoogle} style={{ width:'100%', maxWidth:300, padding:'14px 24px', background:'#fff', color:'#1a1a2e', border:'none', borderRadius:12, cursor:'pointer', fontSize:15, fontWeight:700, fontFamily:"'Instrument Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:12, boxShadow:'0 4px 24px rgba(0,0,0,.3)', transition:'transform .15s' }}
      onMouseEnter={e => e.target.style.transform='translateY(-1px)'}
      onMouseLeave={e => e.target.style.transform='translateY(0)'}>
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Continuar con Google
    </button>
  </div>
);

// ============================================================
// SCREEN: MEETINGS LIST — datos reales
// ============================================================
const MeetingsScreen = ({ go, setMeeting }) => {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await meetings.list({ status: filter === 'ALL' ? undefined : filter });
      setData(res.data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const stats = {
    total:      data.length,
    ready:      data.filter(m => m.status === 'READY').length,
    processing: data.filter(m => m.status === 'PROCESSING').length,
  };

  const statusBadge = (s) => {
    const map = { READY:['success','Listo'], PROCESSING:['warning','Procesando'], RECORDING:['accent','Grabando'], FAILED:['danger','Error'] };
    const [v,l] = map[s] || ['default', s];
    return <Badge v={v}>{l}</Badge>;
  };

  return (
    <div style={{ flex:1, overflowY:'auto', paddingBottom:80 }}>
      <div style={{ padding:'48px 20px 0' }}>
        <h1 style={{ fontSize:26, fontWeight:800, fontFamily:"'Syne',sans-serif", marginBottom:16 }}>Mis Reuniones</h1>

        {/* Stats */}
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          {[['Total',stats.total,C.text],['Listas',stats.ready,C.success],['Procesando',stats.processing,C.warning]].map(([l,v,color]) => (
            <div key={l} style={{ flex:1, background:C.surfaceEl, border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 14px' }}>
              <div style={{ fontSize:22, fontWeight:800, color, fontFamily:"'Syne',sans-serif" }}>{v}</div>
              <div style={{ fontSize:11, color:C.muted }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:6, paddingBottom:16, overflowX:'auto' }}>
          {['ALL','READY','PROCESSING','FAILED'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 14px', borderRadius:99, fontSize:12, fontWeight:600, fontFamily:"'Syne',sans-serif", whiteSpace:'nowrap', cursor:'pointer', background:filter===f?C.accent:C.surfaceEl, color:filter===f?'#fff':C.muted, border:`1px solid ${filter===f?C.accent:C.border}`, transition:'all .15s' }}>
              {f==='ALL'?'Todas':f==='READY'?'Listas':f==='PROCESSING'?'Procesando':'Con error'}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner size={24}/></div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 20px', color:C.muted }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🎙️</div>
          <p style={{ fontSize:15, fontWeight:600, color:C.text }}>Sin reuniones aún</p>
          <p style={{ fontSize:13, marginTop:6 }}>Pulsa "Grabar" para empezar</p>
        </div>
      ) : (
        <div style={{ padding:'0 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {data.map((m, i) => (
            <Card key={m.id} onClick={() => { setMeeting(m); go('meeting_detail'); }} style={{ padding:16, animationDelay:`${i*.04}s` }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', gap:8, marginBottom:6 }}>{statusBadge(m.status)}</div>
                  <h3 style={{ fontSize:15, fontWeight:700, fontFamily:"'Syne',sans-serif", overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:8 }}>{m.title}</h3>
                  <div style={{ display:'flex', gap:12 }}>
                    <span style={{ fontSize:12, color:C.muted }}>{fmtDate(m.recorded_at)}</span>
                    {m.duration_sec && <span style={{ fontSize:12, color:C.muted }}>⏱ {fmtDuration(m.duration_sec)}</span>}
                  </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="1.8"><polyline points="9,18 15,12 9,6"/></svg>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ padding:16 }}>
        <Btn v="ghost" style={{ width:'100%' }} onClick={load}>↻ Actualizar</Btn>
      </div>
    </div>
  );
};

// ============================================================
// SCREEN: RECORDER — graba audio real
// ============================================================
const RecorderScreen = ({ go, setMeeting }) => {
  const [title, setTitle] = useState('');
  const rec = useRecorder();

  const handleStop = async () => {
    const result = await rec.stopAndProcess();
    if (result?.meetingId) {
      // Navegar al detalle cuando esté listo
      const { data } = await meetings.list();
      const m = data?.find(x => x.id === result.meetingId);
      if (m) { setMeeting(m); go('meeting_detail'); }
      else go('meetings');
    }
  };

  const stateLabel = { idle:'Nueva Reunión', requesting:'Activando micrófono...', recording:'Grabando...', paused:'En Pausa', uploading:'Subiendo audio...', processing:'Procesando con IA...' };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', paddingBottom:80, background:`radial-gradient(ellipse at 50% 30%, ${C.accentGlow}, transparent 60%)` }}>
      <div style={{ padding:'48px 20px 0', width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:11, fontWeight:700, color:C.muted, letterSpacing:'.12em', fontFamily:"'Syne',sans-serif", marginBottom:8 }}>GRABADORA EN VIVO</div>
        <h1 style={{ fontSize:24, fontWeight:800, fontFamily:"'Syne',sans-serif" }}>{stateLabel[rec.state] || rec.state}</h1>
      </div>

      {rec.state === 'idle' && (
        <div style={{ padding:'20px 24px 0', width:'100%' }}>
          <input placeholder="Título de la reunión" value={title} onChange={e => setTitle(e.target.value)}
            style={{ width:'100%', padding:'12px 16px', background:C.surfaceEl, border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:14, fontFamily:"'Instrument Sans',sans-serif", outline:'none' }}/>
        </div>
      )}

      {rec.error && <ErrorBanner message={rec.error} onDismiss={() => {}} />}

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:32, width:'100%', padding:'40px 24px' }}>
        {/* Waveform */}
        <div style={{ display:'flex', alignItems:'center', gap:4, height:80, width:'100%', maxWidth:300, justifyContent:'center' }}>
          {rec.amplitude.map((amp, i) => (
            <div key={i} style={{ width:4, borderRadius:2, height:`${amp*100}%`, background:rec.state==='recording'?`linear-gradient(to top,${C.accent},${C.purple})`:rec.state==='paused'?C.warning:C.border, transition:rec.state==='recording'?'height .1s ease':'height .4s ease' }}/>
          ))}
        </div>

        {/* Timer */}
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:56, fontWeight:500, color:rec.state==='recording'?C.text:rec.state==='paused'?C.warning:C.dim, letterSpacing:'-.02em', transition:'color .3s' }}>
          {fmtDuration(rec.elapsed)}
        </div>

        {/* Upload progress */}
        {rec.state === 'uploading' && rec.uploadProgress > 0 && (
          <div style={{ width:'100%', maxWidth:260 }}>
            <div style={{ height:4, background:C.border, borderRadius:2, overflow:'hidden' }}>
              <div style={{ height:'100%', background:C.accent, width:`${rec.uploadProgress}%`, transition:'width .3s', borderRadius:2 }}/>
            </div>
            <div style={{ fontSize:12, color:C.muted, textAlign:'center', marginTop:6 }}>{rec.uploadProgress}% subido</div>
          </div>
        )}

        {(rec.state === 'uploading' || rec.state === 'processing') && (
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Spinner size={18}/>
            <span style={{ fontSize:13, color:C.muted }}>{rec.state === 'uploading' ? 'Subiendo audio...' : 'Transcribiendo con Gemini...'}</span>
          </div>
        )}

        {/* Controls */}
        <div style={{ display:'flex', gap:20, alignItems:'center' }}>
          {['recording','paused'].includes(rec.state) && (
            <button onClick={rec.togglePause} style={{ width:52, height:52, borderRadius:'50%', background:C.surfaceEl, border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:C.text }}>
              {rec.state === 'paused' ? '▶' : '⏸'}
            </button>
          )}

          <button
            onClick={rec.state === 'idle' ? () => rec.startRecording(title) : ['recording','paused'].includes(rec.state) ? handleStop : undefined}
            disabled={['requesting','uploading','processing'].includes(rec.state)}
            style={{ width:80, height:80, borderRadius:'50%', background:rec.state==='idle'?`linear-gradient(135deg,${C.accent},${C.accentDim})`:`linear-gradient(135deg,${C.danger},#B91C1C)`, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:rec.state==='recording'?`0 0 30px rgba(239,68,68,.4)`:`0 0 30px ${C.accentGlow}`, transition:'all .3s', opacity:['requesting','uploading','processing'].includes(rec.state)?.5:1 }}>
            {['requesting','uploading','processing'].includes(rec.state) ? <Spinner size={28}/> : rec.state === 'idle' ? '🎙️' : '⏹'}
          </button>

          {['recording','paused'].includes(rec.state) && (
            <button onClick={rec.cancelRecording} style={{ width:52, height:52, borderRadius:'50%', background:C.surfaceEl, border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:C.muted }}>
              ✕
            </button>
          )}
        </div>

        <p style={{ fontSize:12, color:C.dim, textAlign:'center' }}>
          {rec.state === 'idle' ? 'Pulsa el botón para grabar' : ['recording','paused'].includes(rec.state) ? 'Pulsa el cuadrado para detener y procesar' : ''}
        </p>
      </div>
    </div>
  );
};

// ============================================================
// SCREEN: MEETING DETAIL
// ============================================================
const MeetingDetailScreen = ({ meeting, go, refreshMeeting }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!meeting?.id) return;
    meetings.get(meeting.id).then(r => { setDetail(r.data); setLoading(false); }).catch(() => setLoading(false));

    // Si está procesando, hacer polling
    if (meeting.status === 'PROCESSING') {
      const stop = process.pollStatus(meeting.id, (updated) => {
        setDetail(prev => ({ ...prev, ...updated }));
        if (updated.status === 'READY') refreshMeeting?.();
      });
      return stop;
    }
  }, [meeting?.id]);

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Spinner size={28}/></div>;
  const m = detail || meeting;

  return (
    <div style={{ flex:1, overflowY:'auto', paddingBottom:80 }}>
      <div style={{ padding:'48px 20px 20px', borderBottom:`1px solid ${C.border}` }}>
        <button onClick={() => go('meetings')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>← Volver</button>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <Badge v={m.status==='READY'?'success':m.status==='FAILED'?'danger':'warning'}>{m.status==='READY'?'Completa':m.status==='FAILED'?'Error':'Procesando'}</Badge>
        </div>
        <h1 style={{ fontSize:22, fontWeight:800, fontFamily:"'Syne',sans-serif", marginBottom:8 }}>{m.title}</h1>
        <div style={{ fontSize:13, color:C.muted }}>{fmtDate(m.recorded_at)} {m.duration_sec ? `· ${fmtDuration(m.duration_sec)}` : ''}</div>
      </div>

      {m.status === 'PROCESSING' && (
        <div style={{ padding:'20px 16px' }}>
          <Card style={{ textAlign:'center', padding:32 }}>
            <Spinner size={32}/>
            <p style={{ marginTop:16, color:C.muted, fontSize:14 }}>Transcribiendo con Gemini...<br/><span style={{ fontSize:12 }}>Esto puede tardar 1-3 minutos</span></p>
          </Card>
        </div>
      )}

      {m.status === 'READY' && (
        <div style={{ padding:'20px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
            {[['📄','Acta','minutes_detail'],['📝','Transcripción','transcript'],['🤖','Asistente','assistant']].map(([icon,label,screen]) => (
              <Card key={screen} onClick={() => go(screen)} style={{ padding:16, textAlign:'center' }}>
                <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
                <div style={{ fontSize:12, fontWeight:600, fontFamily:"'Syne',sans-serif" }}>{label}</div>
              </Card>
            ))}
          </div>

          {/* Speakers */}
          {m.speakers?.length > 0 && (
            <Card>
              <Label>PARTICIPANTES DETECTADOS</Label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {m.speakers.map(sp => (
                  <div key={sp.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:C.surfaceEl, borderRadius:8, border:`1px solid ${C.border}` }}>
                    <div style={{ width:32, height:32, borderRadius:'50%', background:getSC(sp.label), display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>{(sp.name||sp.label)[0]}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600 }}>{sp.name || sp.label}</div>
                      <div style={{ fontSize:11, color:C.muted }}>{sp.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {m.status === 'FAILED' && (
        <div style={{ padding:'20px 16px' }}>
          <Card style={{ border:`1px solid rgba(239,68,68,.3)`, background:'rgba(239,68,68,.05)' }}>
            <p style={{ color:C.danger, fontSize:14 }}>⚠️ Error procesando esta reunión</p>
            {m.error_message && <p style={{ fontSize:12, color:C.muted, marginTop:8 }}>{m.error_message}</p>}
          </Card>
        </div>
      )}
    </div>
  );
};

// ============================================================
// SCREEN: TRANSCRIPT
// ============================================================
const TranscriptScreen = ({ meeting, go }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editName,setEditName]= useState('');
  const [filter,  setFilter]  = useState('ALL');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    transcriptions.get(meeting.id).then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [meeting.id]);

  const saveSpeaker = async () => {
    if (!editing || !editName.trim()) return;
    setSaving(true);
    try {
      await transcriptions.renameSpeaker(meeting.id, { label: editing, name: editName.trim() });
      setData(prev => ({
        ...prev,
        speakers: prev.speakers.map(s => s.label === editing ? { ...s, name: editName.trim() } : s),
        segments: prev.segments.map(s => s.speaker_label === editing ? { ...s, speaker_name: editName.trim() } : s),
      }));
      setEditing(null); setEditName('');
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Spinner size={28}/></div>;
  if (!data)   return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted }}>Transcripción no disponible</div>;

  const filtered = filter === 'ALL' ? data.segments : data.segments.filter(s => s.speaker_label === filter);

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', paddingBottom:80 }}>
      <div style={{ padding:'48px 20px 0', borderBottom:`1px solid ${C.border}` }}>
        <button onClick={() => go('meeting_detail')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:13, marginBottom:16 }}>← Volver</button>
        <h1 style={{ fontSize:18, fontWeight:800, fontFamily:"'Syne',sans-serif", marginBottom:16 }}>Transcripción</h1>

        <Label>SPEAKERS — Pulsa el lápiz para renombrar</Label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', paddingBottom:16 }}>
          <button onClick={() => setFilter('ALL')} style={{ padding:'6px 14px', borderRadius:99, fontSize:12, fontWeight:600, background:filter==='ALL'?C.accent:C.surfaceEl, color:filter==='ALL'?'#fff':C.muted, border:`1px solid ${filter==='ALL'?C.accent:C.border}`, cursor:'pointer' }}>Todos</button>
          {data.speakers.map(sp => (
            <div key={sp.label} style={{ display:'flex', gap:4, alignItems:'center' }}>
              <button onClick={() => setFilter(sp.label === filter ? 'ALL' : sp.label)} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:99, fontSize:12, fontWeight:600, background:filter===sp.label?getSC(sp.label)+'30':C.surfaceEl, color:filter===sp.label?getSC(sp.label):C.muted, border:`1px solid ${filter===sp.label?getSC(sp.label)+'60':C.border}`, cursor:'pointer' }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:getSC(sp.label) }}/>
                {sp.name || sp.label}
              </button>
              <button onClick={() => { setEditing(sp.label); setEditName(sp.name || ''); }} style={{ background:'none', border:'none', cursor:'pointer', color:C.dim, padding:2, fontSize:12 }}>✏️</button>
            </div>
          ))}
        </div>

        {editing && (
          <div style={{ display:'flex', gap:8, paddingBottom:16, animation:'fadeIn .2s ease' }}>
            <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key==='Enter' && saveSpeaker()} autoFocus placeholder={`Nombre para ${editing}`}
              style={{ flex:1, padding:'8px 12px', borderRadius:8, background:C.surfaceEl, border:`1px solid ${C.accent}`, color:C.text, fontSize:13, fontFamily:"'Instrument Sans',sans-serif", outline:'none' }}/>
            <Btn v="primary" size="sm" onClick={saveSpeaker} loading={saving}>Guardar</Btn>
            <Btn v="ghost" size="sm" onClick={() => setEditing(null)}>✕</Btn>
          </div>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {filtered.map((seg, i) => (
          <div key={seg.id} style={{ display:'flex', gap:12, marginBottom:20, animation:`fadeIn .2s ease ${i*.03}s both` }}>
            <div style={{ width:36, height:36, borderRadius:'50%', flexShrink:0, background:getSC(seg.speaker_label), display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff' }}>
              {(seg.speaker_name||seg.speaker_label)[0]}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:5 }}>
                <span style={{ fontSize:13, fontWeight:700, color:getSC(seg.speaker_label), fontFamily:"'Syne',sans-serif" }}>{seg.speaker_name || seg.speaker_label}</span>
                <span style={{ fontSize:11, color:C.dim, fontFamily:"'JetBrains Mono',monospace" }}>{fmtMs(seg.start_ms)} — {fmtMs(seg.end_ms)}</span>
              </div>
              <div style={{ background:C.surfaceEl, border:`1px solid ${C.border}`, borderRadius:'0 10px 10px 10px', padding:'10px 14px' }}>
                <p style={{ fontSize:14, color:C.text, lineHeight:1.65 }}>{seg.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================
// SCREEN: MINUTES DETAIL
// ============================================================
const MinutesDetailScreen = ({ meeting, go }) => {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form,    setForm]    = useState({});

  useEffect(() => {
    minutesApi.get(meeting.id).then(r => { setData(r.data); setForm(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [meeting.id]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await minutesApi.update(meeting.id, { summary: form.summary, decisions: form.decisions, action_items: form.action_items });
      setData(r.data); setEditing(false);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const finalize = async () => {
    if (!confirm('¿Finalizar el acta? No podrá volver a borrador.')) return;
    setSaving(true);
    try {
      const r = await minutesApi.finalize(meeting.id);
      setData(r.data);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const exportDrive = async () => {
    setExporting(true);
    try {
      const r = await minutesApi.exportToDrive(meeting.id);
      if (r.data?.webViewLink) window.open(r.data.webViewLink, '_blank');
      setData(prev => ({ ...prev, drive_export_id: r.data.docId }));
    } catch (e) { alert(e.message); }
    finally { setExporting(false); }
  };

  if (loading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}><Spinner size={28}/></div>;
  if (!data)   return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:C.muted }}>Acta no disponible</div>;

  return (
    <div style={{ flex:1, overflowY:'auto', paddingBottom:80 }}>
      <div style={{ padding:'48px 20px 20px', borderBottom:`1px solid ${C.border}` }}>
        <button onClick={() => go('meeting_detail')} style={{ background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:13, marginBottom:16 }}>← Volver</button>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <Badge v={data.status==='FINAL'?'success':'warning'}>{data.status==='FINAL'?'Acta Final':'Borrador'}</Badge>
        </div>
        <h1 style={{ fontSize:20, fontWeight:800, fontFamily:"'Syne',sans-serif" }}>{data.title}</h1>
      </div>

      <div style={{ padding:'20px 16px', display:'flex', flexDirection:'column', gap:14 }}>
        {/* Actions */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {data.status === 'DRAFT' && (
            editing
              ? <><Btn v="primary" size="sm" onClick={save} loading={saving}>Guardar</Btn><Btn v="ghost" size="sm" onClick={() => setEditing(false)}>Cancelar</Btn></>
              : <Btn v="surface" size="sm" onClick={() => setEditing(true)}>✏️ Editar</Btn>
          )}
          <Btn v="ghost" size="sm" onClick={exportDrive} loading={exporting}>💾 Exportar a Drive</Btn>
          {data.status === 'DRAFT' && !editing && <Btn v="success" size="sm" onClick={finalize} loading={saving}>✓ Finalizar Acta</Btn>}
        </div>

        {data.drive_export_id && <Badge v="success">✓ Guardado en Google Drive</Badge>}

        {/* Summary */}
        <Card>
          <Label>RESUMEN EJECUTIVO</Label>
          {editing
            ? <textarea value={form.summary||''} onChange={e => setForm(p=>({...p,summary:e.target.value}))} style={{ width:'100%', minHeight:100, padding:12, borderRadius:8, background:C.surfaceEl, border:`1px solid ${C.accent}`, color:C.text, fontSize:14, lineHeight:1.6, fontFamily:"'Instrument Sans',sans-serif", outline:'none', resize:'vertical' }}/>
            : <p style={{ fontSize:14, color:C.text, lineHeight:1.7 }}>{data.summary}</p>
          }
        </Card>

        {/* Decisions */}
        {data.decisions?.length > 0 && (
          <Card>
            <Label>DECISIONES TOMADAS</Label>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {(form.decisions || data.decisions).map((d, i) => (
                <div key={i} style={{ display:'flex', gap:10, padding:'10px 12px', borderRadius:8, background:C.surfaceEl, border:`1px solid ${C.border}` }}>
                  <div style={{ width:20, height:20, borderRadius:'50%', background:C.accentGlow, border:`1px solid ${C.accent}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:C.accent, flexShrink:0 }}>{i+1}</div>
                  {editing
                    ? <input value={d} onChange={e => { const next=[...form.decisions]; next[i]=e.target.value; setForm(p=>({...p,decisions:next})); }} style={{ flex:1, background:'none', border:'none', color:C.text, fontSize:14, fontFamily:"'Instrument Sans',sans-serif", outline:'none' }}/>
                    : <span style={{ fontSize:14, color:C.text, flex:1, lineHeight:1.5 }}>{d}</span>
                  }
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Action items */}
        {data.action_items?.length > 0 && (
          <Card>
            <Label>COMPROMISOS Y TAREAS</Label>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {data.action_items.map((ai, i) => (
                <div key={i} style={{ padding:'12px 14px', borderRadius:10, background:C.surfaceEl, border:`1px solid ${C.border}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:600, flex:1 }}>{ai.task}</span>
                    {ai.due_date && <Badge v="accent">{ai.due_date}</Badge>}
                  </div>
                  <div style={{ fontSize:12, color:C.muted }}>👤 {ai.owner}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

// ============================================================
// SCREEN: ASSISTANT — Gemini real con contexto de reunión
// ============================================================
const AssistantScreen = ({ meeting, go }) => {
  const [msgs,    setMsgs]    = useState([{ role:'assistant', content:`Hola! Soy tu asistente para la reunión "${meeting?.title || ''}". ¿Qué quieres saber sobre ella?` }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = React.useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading || !meeting?.id) return;
    const msg = input.trim(); setInput('');
    setMsgs(prev => [...prev, { role:'user', content:msg }]);
    setLoading(true);
    try {
      const r = await assistant.chat(meeting.id, msg);
      setMsgs(prev => [...prev, { role:'assistant', content:r.data.response }]);
    } catch (e) {
      setMsgs(prev => [...prev, { role:'assistant', content:`Error: ${e.message}` }]);
    } finally { setLoading(false); }
  };

  const suggestions = ['¿Qué compromisos se tomaron?','Resume los puntos clave','¿Qué se decidió sobre el presupuesto?','¿Cuáles son los próximos pasos?'];

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', paddingBottom:80 }}>
      <div style={{ padding:'48px 20px 16px', borderBottom:`1px solid ${C.border}` }}>
        <h1 style={{ fontSize:18, fontWeight:800, fontFamily:"'Syne',sans-serif" }}>🤖 Asistente IA</h1>
        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{meeting?.title || 'Sin reunión seleccionada'}</div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display:'flex', gap:10, marginBottom:16, flexDirection:m.role==='user'?'row-reverse':'row', animation:'fadeIn .2s ease' }}>
            {m.role==='assistant' && <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${C.purple}30,${C.accent}20)`, border:`1px solid ${C.purple}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✨</div>}
            <div style={{ maxWidth:'82%', padding:'10px 14px', borderRadius:m.role==='user'?'12px 12px 4px 12px':'12px 12px 12px 4px', background:m.role==='user'?C.accent:C.surfaceEl, border:`1px solid ${m.role==='user'?'transparent':C.border}`, fontSize:14, color:C.text, lineHeight:1.65, whiteSpace:'pre-wrap' }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${C.purple}30,${C.accent}20)`, display:'flex', alignItems:'center', justifyContent:'center' }}>✨</div>
            <div style={{ padding:'12px 16px', borderRadius:'12px 12px 12px 4px', background:C.surfaceEl, border:`1px solid ${C.border}`, display:'flex', gap:6 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background:C.purple, animation:`dbounce 1.2s ease-in-out ${i*.2}s infinite` }}/>)}
            </div>
          </div>
        )}

        {msgs.length === 1 && !meeting?.id && (
          <div style={{ textAlign:'center', color:C.muted, fontSize:13, marginTop:20 }}>
            Selecciona una reunión para usar el asistente
          </div>
        )}

        {msgs.length === 1 && meeting?.id && (
          <div style={{ marginTop:8 }}>
            <Label>SUGERENCIAS</Label>
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setInput(s)} style={{ width:'100%', textAlign:'left', padding:'10px 14px', borderRadius:10, background:C.surfaceEl, border:`1px solid ${C.border}`, color:C.muted, fontSize:13, cursor:'pointer', fontFamily:"'Instrument Sans',sans-serif", marginBottom:7, transition:'all .15s' }}
                onMouseEnter={e => { e.target.style.borderColor=C.accent+'50'; e.target.style.color=C.text; }}
                onMouseLeave={e => { e.target.style.borderColor=C.border; e.target.style.color=C.muted; }}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.border}`, background:C.surface, display:'flex', gap:10, alignItems:'flex-end' }}>
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} }} placeholder="Pregunta sobre esta reunión..." rows={1}
          style={{ flex:1, padding:'10px 14px', borderRadius:12, background:C.surfaceEl, border:`1px solid ${input?C.accent+'60':C.border}`, color:C.text, fontSize:14, fontFamily:"'Instrument Sans',sans-serif", outline:'none', resize:'none', maxHeight:100 }}/>
        <button onClick={send} disabled={!input.trim()||loading||!meeting?.id} style={{ width:42, height:42, borderRadius:12, background:(input.trim()&&!loading&&meeting?.id)?C.accent:C.surfaceEl, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .15s', flexShrink:0 }}>
          {loading ? <Spinner size={16}/> : <span style={{ fontSize:16 }}>➤</span>}
        </button>
      </div>
    </div>
  );
};

// ============================================================
// ROOT
// ============================================================
export default function App() {
  const [authed,  setAuthed]  = useState(auth.isAuthenticated());
  const [screen,  setScreen]  = useState('meetings');
  const [meeting, setMeeting] = useState(null);

  // Manejar callback de OAuth
  useEffect(() => {
    if (!document.getElementById('app-css')) {
      const s = document.createElement('style'); s.id='app-css'; s.textContent=CSS; document.head.appendChild(s);
    }
    if (window.location.pathname === '/auth/success') {
      const ok = auth.handleCallback();
      if (ok) setAuthed(true);
    }
    if (window.location.pathname === '/auth/error') {
      alert('Error de autenticación. Inténtalo de nuevo.');
    }
  }, []);

  const go = (s) => setScreen(s);

  const refreshMeeting = () => {
    if (meeting?.id) {
      meetings.get(meeting.id).then(r => setMeeting(r.data)).catch(() => {});
    }
  };

  const screenProps = { go, meeting, setMeeting, refreshMeeting };

  const renderScreen = () => {
    if (!authed) return <AuthScreen/>;
    switch (screen) {
      case 'meetings':       return <MeetingsScreen {...screenProps}/>;
      case 'recorder':       return <RecorderScreen {...screenProps}/>;
      case 'meeting_detail': return <MeetingDetailScreen {...screenProps}/>;
      case 'transcript':     return <TranscriptScreen {...screenProps}/>;
      case 'minutes_detail': return <MinutesDetailScreen {...screenProps}/>;
      case 'assistant':      return <AssistantScreen {...screenProps}/>;
      default:               return <MeetingsScreen {...screenProps}/>;
    }
  };

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:C.bg, maxWidth:480, margin:'0 auto', position:'relative', overflow:'hidden' }}>
      {renderScreen()}
      {authed && !['recorder'].includes(screen) && (
        <Nav screen={screen} go={(s) => {
          if (s === 'assistant' && !meeting) { go('meetings'); return; }
          go(s);
        }}/>
      )}
    </div>
  );
}
