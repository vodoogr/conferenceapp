import sys

path = r'c:\conferenceapp\src\App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

new_nav = """const Nav = ({ screen, go }) => {
  const tabs = [
    { id:'meetings', label:'Reuniones', Icon:ListChecks },
    { id:'recorder', label:'Grabar',    Icon:Mic },
    { id:'assistant',label:'Asistente', Icon:Sparkles },
  ];
  return (
    <nav style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)', background:'rgba(10,12,18,0.8)', border:'1px solid rgba(255,255,255,0.08)', display:'flex', zIndex:100, padding:'8px', borderRadius:24, backdropFilter:'blur(20px)', boxShadow:'0 20px 40px rgba(0,0,0,0.4)', gap:8, width:'calc(100% - 40px)', maxWidth:400 }}>
      {tabs.map(t => {
        const active = screen === t.id || (t.id==='meetings' && ['meeting_detail','transcript','minutes_detail'].includes(screen));
        const Icon = t.Icon;
        return (
          <button key={t.id} onClick={() => go(t.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4, padding:'10px 0', background:active?C.accentGlow:'none', border:'none', cursor:'pointer', color:active?C.accent:C.muted, borderRadius:16, transition:'all 0.3s', fontSize:11, fontWeight:active?700:500, fontFamily:"'Outfit',sans-serif" }}>
            <Icon size={20} strokeWidth={active?2.2:1.8} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
};"""

import re
pattern = r'const Nav = \(\{ screen, go \}\) => \{.*?^\};'
content = re.sub(pattern, new_nav, content, flags=re.DOTALL | re.MULTILINE)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Nav Updated")
