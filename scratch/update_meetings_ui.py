import sys

path = r'c:\conferenceapp\src\App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Mejorar el MeetingsScreen para que sea responsive y use Lucide mejor
new_meetings_screen = """const MeetingsScreen = ({ go, setMeeting }) => {
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
    <div style={{ flex:1, overflowY:'auto', paddingBottom:100 }} className="container">
      <div style={{ padding:'60px 0 32px' }}>
        <h1 style={{ fontSize:32, fontWeight:800, fontFamily:"'Outfit',sans-serif", marginBottom:24, letterSpacing:'-0.03em' }}>
          Mis <span style={{ color:C.accent }}>Reuniones</span>
        </h1>

        {/* Stats Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(100px, 1fr))', gap:12, marginBottom:24 }}>
          {[['Total',stats.total,C.text, ListChecks],['Listas',stats.ready,C.success, Check],['En curso',stats.processing,C.warning, RefreshCw]].map(([l,v,color, Icon]) => (
            <div key={l} className="premium-card" style={{ padding:'16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div style={{ fontSize:28, fontWeight:800, color, fontFamily:"'Outfit',sans-serif" }}>{v}</div>
                <Icon size={18} color={color} opacity={0.6} />
              </div>
              <div style={{ fontSize:12, color:C.muted, fontWeight:600, letterSpacing:'0.05em' }}>{l.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:8, paddingBottom:8, overflowX:'auto', scrollbarWidth:'none' }}>
          {['ALL','READY','PROCESSING','FAILED'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:'8px 20px', borderRadius:12, fontSize:13, fontWeight:600, whiteSpace:'nowrap', cursor:'pointer', background:filter===f?C.accent:C.surfaceEl, color:filter===f?'#fff':C.muted, border:`1px solid ${filter===f?C.accent:'rgba(255,255,255,0.05)'}`, transition:'all 0.2s' }}>
              {f==='ALL'?'Todas':f==='READY'?'Listas':f==='PROCESSING'?'Procesando':'Con error'}
            </button>
          ))}
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}><Spinner size={32}/></div>
      ) : data.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 20px', color:C.muted }}>
          <div style={{ width:80, height:80, borderRadius:24, background:C.surfaceEl, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 24px' }}>
            <Mic size={32} color={C.dim} />
          </div>
          <p style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:8 }}>Sin reuniones aún</p>
          <p style={{ fontSize:14, maxWidth:240, margin:'0 auto' }}>Pulsa el botón de grabar en el menú inferior para comenzar.</p>
        </div>
      ) : (
        <div className="grid-layout">
          {data.map((m, i) => (
            <div key={m.id} className="premium-card" onClick={() => { setMeeting(m); go('meeting_detail'); }} style={{ animation:`slideUp 0.4s ease ${i*0.05}s both`, cursor:'pointer' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
                {statusBadge(m.status)}
                <span style={{ fontSize:12, color:C.muted, fontWeight:500 }}>{fmtDate(m.recorded_at)}</span>
              </div>
              <h3 style={{ fontSize:17, fontWeight:700, marginBottom:12, lineHeight:1.4 }}>{m.title}</h3>
              <div style={{ display:'flex', alignItems:'center', gap:12, color:C.muted, fontSize:13 }}>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <RefreshCw size={14} />
                  <span>{m.duration_sec ? fmtDuration(m.duration_sec) : '--:--'}</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <MessageSquare size={14} />
                  <span>Acta</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};"""

# 2. Reemplazar el MeetingsScreen en el contenido
# Esta es una operación delicada, usaremos un marcador si es posible o simplemente reemplazaremos el bloque completo.
import re

# Intentar encontrar el bloque MeetingsScreen
pattern = r'const MeetingsScreen = \(\{ go, setMeeting \}\) => \{.*?^\};'
content = re.sub(pattern, new_meetings_screen, content, flags=re.DOTALL | re.MULTILINE)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("MeetingsScreen Updated")
