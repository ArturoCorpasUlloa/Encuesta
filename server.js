import os from 'node:os';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN, PORT = 3001 } = process.env;
if (!APPS_SCRIPT_URL || !APPS_SCRIPT_TOKEN) {
  console.error('Falta APPS_SCRIPT_URL o APPS_SCRIPT_TOKEN en el archivo .env');
  process.exit(1);
}

const PUBLICAS = ['listarUsuarios', 'estadoUsuario', 'guardarEncuesta'];
const CON_PIN = ['verificarPin', 'listarTodosUsuarios', 'crearUsuario', 'editarUsuario', 'cambiarActivo',
  'listarEncuestas', 'pendientes', 'obtenerConfig', 'guardarConfig', 'cambiarPin'];

// Limita intentos de PIN fallidos por IP: 8 errores en 10 minutos => bloqueo temporal
const fallos = new Map();
const VENTANA = 10 * 60 * 1000, MAX_FALLOS = 8;
const bloqueada = (ip) => (fallos.get(ip) || []).filter((t) => Date.now() - t < VENTANA).length >= MAX_FALLOS;
const registrarFallo = (ip) => fallos.set(ip, [...(fallos.get(ip) || []).filter((t) => Date.now() - t < VENTANA), Date.now()]);

const app = express();
app.use(express.json({ limit: '200kb' }));

app.post('/api', async (req, res) => {
  const { action, ...resto } = req.body || {};
  const requierePin = CON_PIN.includes(action);
  if (!PUBLICAS.includes(action) && !requierePin) return res.status(400).json({ ok: false, error: 'Acción no permitida' });
  if (requierePin && bloqueada(req.ip))
    return res.status(429).json({ ok: false, error: 'Demasiados intentos. Espera unos minutos.' });
  try {
    const r = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...resto, action, token: APPS_SCRIPT_TOKEN }),
      redirect: 'follow',
    });
    const data = await r.json();
    if (requierePin && data.error === 'PIN incorrecto') registrarFallo(req.ip);
    res.json(data);
  } catch (err) {
    console.error('Error llamando a Apps Script:', err.message);
    res.status(502).json({ ok: false, error: 'No se pudo conectar con la base de datos (Google Sheets).' });
  }
});

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
app.use(express.static(dist));
app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));

app.listen(PORT, () => {
  console.log(`Servidor listo en http://localhost:${PORT}`);
  Object.values(os.networkInterfaces()).flat()
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .forEach((i) => console.log(`  Desde la red: http://${i.address}:${PORT}`));
});