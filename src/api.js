// Cliente del backend interno (/api). Nunca maneja el token de Google.
export async function api(action, payload = {}) {
  let r;
  try {
    r = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error('Sin conexión con el servidor.');
  }
  let data;
  try { data = await r.json(); } catch { throw new Error('Respuesta inválida del servidor.'); }
  if (!data.ok) throw new Error(data.error || 'Error desconocido');
  return data;
}

/** Convierte una fila de la hoja "Encuestas" al formato que usa analytics.js */
export function filaADoc(f) {
  const enfermedades = {};
  Object.keys(f).filter((k) => k.startsWith('Enf: ')).forEach((k, i) => { enfermedades[i] = { padece: f[k] === 'SI' ? 'SI' : 'NO' }; });
  const dolorZonas = {};
  Object.keys(f).filter((k) => k.startsWith('Dolor: ')).forEach((k, i) => {
    const n = Number(f[k]) || 0;
    dolorZonas[i + 1] = { siente: n > 0 ? 'si' : 'no', severidad: n || null };
  });
  const [fecha, hora = '00:00:00'] = String(f.Fecha_Registro).split(' ');
  return {
    id: f.ID_Encuesta, nombre: f.Nombre, cc: f.CC, cargo: f.Cargo, sede: f.Area, idUsuario: f.ID_Usuario,
    fechaNacimiento: f.Fecha_Nacimiento, fechaIngreso: f.Fecha_Ingreso,
    createdAt: new Date(`${fecha}T${hora}`), enfermedades, dolorZonas,
  };
}
