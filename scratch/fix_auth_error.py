import sys
import os

path = r'c:\conferenceapp\src\App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = "      alert('Error de autenticación. Inténtalo de nuevo.');"
new = """      const params = new URLSearchParams(window.location.search);
      const reason = params.get('reason') || 'desconocido';
      alert(`Error de autenticación: ${reason}\\n\\nVerifica las variables de entorno en Vercel.`);"""

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Success")
else:
    print("Not found")
