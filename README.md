# Camino hacia la paz · versión con IA generativa (DeepSeek)

La página es estática (`index.html`). El chat llama a `/api/chat`, una función serverless que guarda la API key y habla con DeepSeek. **La key nunca va en el HTML.** Si la IA falla, el chat responde por palabras clave (modo simulado).

```
index.html        la página (igual a ../Camino_hacia_la_paz_v2 + una línea que activa la IA)
api/chat.js       función serverless: valida, limita, llama a DeepSeek
api/_system.js    instrucciones del asistente (reglas)
api/_kb.js        base de conocimiento: el contenido y las fuentes de la página
```

## Desplegar en Vercel
1. Sube esta carpeta a un repositorio de GitHub (el `.gitignore` ya excluye `.env`). Alternativa: `npm i -g vercel` y `vercel` dentro de la carpeta.
2. En vercel.com: *Add New → Project* → elige el repositorio. No hace falta configurar el build.
3. *Settings → Environment Variables*: crea `DEEPSEEK_API_KEY` con tu key (Production, Preview y Development).
4. *Deploy*. Abre la URL, toca 💬: la cabecera debe decir «IA generativa · puede equivocarse».
5. Si cambias variables, vuelve a desplegar (*Redeploy*).

Variables opcionales: `DEEPSEEK_MODEL` (por defecto `deepseek-chat`; revisa el nombre vigente en la documentación de DeepSeek), `RATE_MAX` (mensajes por IP cada 10 min, por defecto 20), `ALLOWED_ORIGIN` (por ejemplo `https://tu-proyecto.vercel.app`, para aceptar solo ese origen).

## Probar la función
```
curl -s -X POST https://TU-URL/api/chat -H "content-type: application/json" \
  -d '{"messages":[{"role":"user","content":"¿Qué es la UBPD?"}]}'
```
Debe devolver `{"reply":"..."}`. Códigos: 503 sin key configurada, 429 demasiados mensajes, 502 falla del proveedor, 400 petición inválida.

## Mantenimiento
- **Cambiar o añadir contenido:** edita `api/_kb.js` (los números `[n]` son los de la lista de fuentes de la página) y vuelve a desplegar. Si el contenido de la página cambia y no se actualiza el KB, la IA contestará con datos viejos.
- **Cambiar el comportamiento:** reglas en `api/_system.js`.
- **Key filtrada o gasto raro:** revócala en el panel de DeepSeek, crea otra y actualízala en Vercel. Revisa el saldo y fija un límite de gasto.

## Qué hace y qué no hace
- Pasa al modelo solo los últimos 6 mensajes (máx. 500 caracteres cada uno), `max_tokens` 450, temperatura 0,3. Ignora roles `system` enviados desde el navegador.
- La respuesta se escapa antes de mostrarla: solo permite negrita, saltos de línea y citas `[n]` válidas (1–18) que enlazan a las fuentes.
- El límite por IP es de mejor esfuerzo (la memoria no se comparte entre instancias serverless). Para algo más estricto usa Vercel KV/Upstash.
- **No elimina las alucinaciones.** Las instrucciones piden usar solo la base y citar fuentes, pero el modelo puede equivocarse; por eso el chat lo avisa.
- Lo que escriben las personas viaja a los servidores de DeepSeek. Avisar que no escriban datos personales y declarar el uso de IA en la bitácora de IAG.

## Pruebas realizadas (con un servidor DeepSeek simulado, sin la key real)
Backend: 503 sin key, 405, 400 (vacío, JSON roto, último rol asistente), llamada correcta con `Bearer`, system prompt con la base, máximo 6 mensajes, truncado a 500, descarte de rol `system`, 502 sin filtrar detalles ni la key, límite 429, 403 por origen.
Frontend: modo IA, citas y escape de HTML, historial, respaldo por reglas al fallar, paso a modo simulado tras 2 fallos, sin servidor o sin key, y archivo local sin llamadas de red.
**No probado:** la API real de DeepSeek (formato y nombre del modelo tomados de su compatibilidad con OpenAI; confírmalo con la primera llamada), el despliegue en Vercel, la calidad real de las respuestas ni su fidelidad a la base.
