
const PUBLICAS = ['listarUsuarios', 'estadoUsuario', 'guardarEncuesta'];
const CON_PIN = ['verificarPin', 'listarTodosUsuarios', 'crearUsuario', 'editarUsuario', 'cambiarActivo',
  'listarEncuestas', 'pendientes', 'obtenerConfig', 'guardarConfig', 'cambiarPin'];

// Límite de PIN fallidos por IP (en memoria: se reinicia cuando la función "se enfría",
// es una protección básica, no estricta).
const fallos = new Map();
const VENTANA = 10 * 60 * 1000, MAX_FALLOS = 8;
const recientes = (ip) => (fallos.get(ip) || []).filter((t) => Date.now() - t < VENTANA);
const bloqueada = (ip) => recientes(ip).length >= MAX_FALLOS;
const registrarFallo = (ip) => fallos.set(ip, [...recientes(ip), Date.now()]);

const json = (status, body) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Método no permitido' });

  const { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN } = process.env;
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_TOKEN)
    return json(500, { ok: false, error: 'Servidor sin configurar (faltan variables de entorno).' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { action, ...resto } = body;
  const requierePin = CON_PIN.includes(action);
  if (!PUBLICAS.includes(action) && !requierePin) return json(400, { ok: false, error: 'Acción no permitida' });

  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'desconocida';
  if (requierePin && bloqueada(ip))
    return json(429, { ok: false, error: 'Demasiados intentos. Espera unos minutos.' });

  try {
    const r = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...resto, action, token: APPS_SCRIPT_TOKEN }),
      redirect: 'follow',
    });
    const data = await r.json();
    if (requierePin && data.error === 'PIN incorrecto') registrarFallo(ip);
    return json(200, data);
  } catch (err) {
    console.error('Error llamando a Apps Script:', err.message);
    return json(502, { ok: false, error: 'No se pudo conectar con la base de datos (Google Sheets).' });
  }
}
