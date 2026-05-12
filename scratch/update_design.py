import sys

path = r'c:\conferenceapp\src\App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Vamos a inyectar un CSS mucho más moderno y premium
new_css = """  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
  
  :root {
    --bg: #030407;
    --surface: #0A0C12;
    --surface-el: #12151C;
    --border: rgba(255,255,255,0.06);
    --accent: #3B82F6;
    --accent-glow: rgba(59,130,246,0.15);
    --text: #F8FAFC;
    --muted: #94A3B8;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  
  html, body { 
    height: 100%; 
    background: var(--bg); 
    color: var(--text); 
    font-family: 'Outfit', sans-serif; 
    -webkit-font-smoothing: antialiased;
    overflow-x: hidden;
  }

  /* Animaciones Premium */
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes glassPulse {
    0% { border-color: rgba(59,130,246,0.1); box-shadow: 0 0 0 0 rgba(59,130,246,0); }
    50% { border-color: rgba(59,130,246,0.3); box-shadow: 0 0 20px 0 rgba(59,130,246,0.1); }
    100% { border-color: rgba(59,130,246,0.1); box-shadow: 0 0 0 0 rgba(59,130,246,0); }
  }

  .premium-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 20px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(10px);
  }

  .premium-card:hover {
    transform: translateY(-4px);
    border-color: rgba(59,130,246,0.3);
    background: var(--surface-el);
    box-shadow: 0 12px 40px rgba(0,0,0,0.4);
  }

  /* Responsive Grid */
  .grid-layout {
    display: grid;
    gap: 16px;
    grid-template-columns: 1fr;
  }

  @media (min-width: 640px) { .grid-layout { grid-template-columns: repeat(2, 1fr); } }
  @media (min-width: 1024px) { .grid-layout { grid-template-columns: repeat(3, 1fr); } }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 20px;
  }
"""

# Aplicar cambios al archivo
# Buscamos la constante CSS y la reemplazamos
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if 'const CSS = `' in line:
        start_idx = i
    if start_idx != -1 and '`;' in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    lines[start_idx:end_idx+1] = [f"const CSS = `\n{new_css}\n`;\n"]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("CSS Updated")
