/**
 * BACKEND DE LA ENCUESTA (Google Apps Script) — pegar en Extensiones > Apps Script del Sheet "DatosEncuesta".
 * Pasos: 1) pegar este código  2) cambiar TOKEN  3) ejecutar setup() una vez  4) Implementar > Aplicación web.
 */
const TOKEN = 'CAMBIA_ESTE_TEXTO_POR_UNO_LARGO_Y_SECRETO';
const PIN_INICIAL = '1234';          // se guarda cifrado; cámbialo luego desde Configuración
const ZONA_HORARIA = 'America/Bogota';

const ENFERMEDADES = ['Hernia discal','Lumbalgia','Síndrome de manguito rotador','Tendinitis bicipital','Bursitis hombro','Epicondilitis','Enfermedad de quervain','Síndrome de túnel del carpo','Tendinitis de flexo extensores'];
const ZONAS = ['Cuello','Hombros','Brazos','Codos','Antebrazos','Muñecas','Manos','Espalda dorsal','Espalda lumbar','Nalgas/caderas','Muslos','Rodillas','Piernas','Pies'];

const H_USUARIOS = ['ID','Nombre','Area','Activo'];
const H_ENCUESTAS = ['ID_Encuesta','Fecha_Registro','Año','Mes','ID_Usuario','Nombre','Area','CC','Fecha_Nacimiento','Fecha_Ingreso','Cargo']
  .concat(ENFERMEDADES.map(e => 'Enf: ' + e), ['Observaciones_Enfermedades'], ZONAS.map(z => 'Dolor: ' + z), ['Severidad_Max','Nivel']);
const H_CONFIG = ['Clave','Valor'];
const TEXTO = ['Fecha_Registro','CC','Fecha_Nacimiento','Fecha_Ingreso'];   // columnas que deben quedar como texto

const USUARIOS_INICIALES = [[1, "BARRIOS PAYARES EDUARDO ANDRES", "CALIDAD", "SI"], [2, "CORPAS ULLOA ARTURO FERNANDO", "CALIDAD", "SI"], [3, "ESCOBAR VILLAR JUAN PABLO", "CALIDAD", "SI"], [4, "MARRIAGA PABON ABRAHAM ALBERTO", "CALIDAD", "SI"], [5, "MERIÑO FONTALVO ALFRED ESTEBAN", "CALIDAD", "SI"], [6, "NUÑEZ ROJAS KENER ALEXANDER", "CALIDAD", "SI"], [7, "VIDES TORRES JESUS DAVID", "CALIDAD", "SI"], [8, "ARAQUE GUTIERREZ MARIA JOSE", "CALL CENTER", "SI"], [9, "AVENDAÑO CASTRO YAINI ANDREA", "CALL CENTER", "SI"], [10, "BARRIENTOS GARCIA LAURA DANIELA", "CALL CENTER", "SI"], [11, "BOLAÑO CARRILLO KATERIN PAOLA", "CALL CENTER", "SI"], [12, "CAMACHO RODRIGUEZ CAMILA NORIETH", "CALL CENTER", "SI"], [13, "CEBALLO CANO HAIDI MILENA", "CALL CENTER", "SI"], [14, "DIAZ ALVAREZ CLLELY YANETH", "CALL CENTER", "SI"], [15, "GAÑAN GOMEZ SUSANA", "CALL CENTER", "SI"], [16, "HERNANDEZ QUINTERO ADRIANA DEL PILAR", "CALL CENTER", "SI"], [17, "HERNANDEZ ZAPATA LUISA FERNANDA", "CALL CENTER", "SI"], [18, "JIMENEZ ALMANZA MARIA FERNANDA", "CALL CENTER", "SI"], [19, "KARLA BRIYITH NUÑEZ VEGA", "CALL CENTER", "SI"], [20, "KEIRYS VANESA ACUÑA AHUMADA", "CALL CENTER", "SI"], [21, "PEREZ VELASQUEZ JENIFER DASNEY", "CALL CENTER", "SI"], [22, "VELASQUEZ ACOSTA PATRICIA MERCEDES", "CALL CENTER", "SI"], [23, "YANCE LACERA PAOLA ANDREA", "CALL CENTER", "SI"], [24, "ZAMBRANO SOLANO MADIS MILENA", "CALL CENTER", "SI"], [25, "ACOSTA CUCUNUBA EDWIN EDUARDO", "CONTABILIDAD", "SI"], [26, "AMADOR LOPEZ YALEIDIS ESTER", "CONTABILIDAD", "SI"], [27, "BROCHERO CARRILLO RUTH ELENA", "CONTABILIDAD", "SI"], [28, "CAMILO ANDRES REBOLLEDO NIEBLES", "CONTABILIDAD", "SI"], [29, "CARBALLO SANTANA ALDEIR SAITH", "CONTABILIDAD", "SI"], [30, "GONZALEZ RIVAS HYLENNE BEATRIZ", "CONTABILIDAD", "SI"], [31, "PAEZ LOPEZ LISETH CAROLINA", "CONTABILIDAD", "SI"], [32, "PEREA GONZALEZ KARELIS", "CONTABILIDAD", "SI"], [33, "VASQUEZ GUTIERREZ ZAIDIR", "CONTABILIDAD", "SI"], [34, "ARANGO ALBA YETZELI LAUDITH", "FACTURACION", "SI"], [35, "CABARCAS ZUÑIGA IDALADITH JOANNA", "FACTURACION", "SI"], [36, "CASTRO LOZANO FERNANDO JOSE", "FACTURACION", "SI"], [37, "CELIS VARGAS LUCIRYS", "FACTURACION", "SI"], [38, "CORDOBA ROMO JENIFER", "FACTURACION", "SI"], [39, "CORONEL CUBILLOS LUZ MILA", "FACTURACION", "SI"], [40, "ORELLANO MOLINA MARIA JOSE", "FACTURACION", "SI"], [41, "OSPINO PERALTA RAUL JOSE", "FACTURACION", "SI"], [42, "PRADA ENSUNCHO JUAN DAVID", "FACTURACION", "SI"], [43, "QUINTO LAGUNA MALKA IRINA", "FACTURACION", "SI"], [44, "RAMIREZ TOLEDO NAYDUTH", "FACTURACION", "SI"], [45, "GRIMALDOS MENDEZ MARIA CRISTINA", "RECURSOS HUMANOS", "SI"], [46, "PERALTA NOGUERA VERONICA", "RECURSOS HUMANOS", "SI"], [47, "ARIZA MONTERROSA NEIRYS JOHANNA", "TRANSCRIPCION", "SI"], [48, "BEJARANO BARCELO KEILIM MICHELL", "TRANSCRIPCION", "SI"], [49, "MUÑOZ NAVARRO MILENA MARGARITA", "TRANSCRIPCION", "SI"], [50, "TORREGROZA CORREDOR DANILO JOSE", "TRANSCRIPCION", "SI"]];

/* ---------------------------- Preparación (ejecutar una sola vez) ---------------------------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const hoja = (n, h) => {
    let s = ss.getSheetByName(n) || ss.insertSheet(n);
    if (s.getLastRow() === 0) s.getRange(1, 1, 1, h.length).setValues([h]);
    s.getRange(1, 1, 1, h.length).setFontWeight('bold').setBackground('#1F3A5F').setFontColor('#FFFFFF');
    s.setFrozenRows(1);
    return s;
  };
  const u = hoja('Usuarios', H_USUARIOS);
  const e = hoja('Encuestas', H_ENCUESTAS);
  const c = hoja('Configuracion', H_CONFIG);
  TEXTO.forEach(n => { const i = H_ENCUESTAS.indexOf(n) + 1; e.getRange(2, i, e.getMaxRows() - 1, 1).setNumberFormat('@'); });
  if (u.getLastRow() === 1) u.getRange(2, 1, USUARIOS_INICIALES.length, 4).setValues(USUARIOS_INICIALES);
  if (c.getLastRow() === 1) {
    c.getRange(2, 1, 5, 2).setValues([
      ['frecuencia_modo', 'MES_CALENDARIO'],   // MES_CALENDARIO o DIAS_MINIMOS
      ['dias_minimos', 30],
      ['ventana_dia_inicio', 0],               // 0 = sin restricción
      ['ventana_dia_fin', 0],
      ['pin_hash', hashPin_(PIN_INICIAL)],
    ]);
  }
  const vieja = ss.getSheetByName('Hoja 1');
  if (vieja && vieja.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(vieja);
}

/* ---------------------------- Entrada HTTP ---------------------------- */
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'JSON inválido' }); }
  if (req.token !== TOKEN) return out_({ ok: false, error: 'No autorizado' });
  const acciones = {
    listarUsuarios, estadoUsuario, guardarEncuesta,                       // públicas (formulario)
    verificarPin, listarTodosUsuarios, crearUsuario, editarUsuario, cambiarActivo,
    listarEncuestas, pendientes, obtenerConfig, guardarConfig, cambiarPin  // requieren PIN
  };
  const soloPin = ['verificarPin','listarTodosUsuarios','crearUsuario','editarUsuario','cambiarActivo','listarEncuestas','pendientes','obtenerConfig','guardarConfig','cambiarPin'];
  const fn = acciones[req.action];
  if (!fn) return out_({ ok: false, error: 'Acción desconocida' });
  if (soloPin.indexOf(req.action) >= 0 && !pinValido_(req.pin)) return out_({ ok: false, error: 'PIN incorrecto' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);                      // evita duplicados si dos personas envían a la vez
  try { return out_(Object.assign({ ok: true }, fn(req))); }
  catch (err) { return out_({ ok: false, error: String(err.message || err) }); }
  finally { lock.releaseLock(); }
}
function doGet() { return out_({ ok: true, mensaje: 'API de encuestas activa' }); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------------------------- Utilidades ---------------------------- */
function leer_(nombre) {
  const s = SpreadsheetApp.getActive().getSheetByName(nombre);
  const v = s.getDataRange().getDisplayValues();
  const h = v.shift();
  return { sheet: s, headers: h, rows: v.map(r => { const o = {}; h.forEach((k, i) => o[k] = r[i]); return o; }) };
}
function hashPin_(pin) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(pin))
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
function config_() { const o = {}; leer_('Configuracion').rows.forEach(r => o[r.Clave] = r.Valor); return o; }
function pinValido_(pin) { return !!pin && hashPin_(pin) === config_().pin_hash; }
function ahora_() { return Utilities.formatDate(new Date(), ZONA_HORARIA, 'yyyy-MM-dd HH:mm:ss'); }
function fechaDe_(s) { const p = String(s).split(/[- :]/).map(Number); return new Date(p[0], p[1] - 1, p[2], p[3] || 0, p[4] || 0); }

/* ---------------------------- Regla: una encuesta por período ---------------------------- */
function estadoUsuario(req) {
  const id = String(req.idUsuario), cfg = config_();
  const hoy = new Date();
  const anio = Number(Utilities.formatDate(hoy, ZONA_HORARIA, 'yyyy')), mes = Number(Utilities.formatDate(hoy, ZONA_HORARIA, 'M'));
  const dia = Number(Utilities.formatDate(hoy, ZONA_HORARIA, 'd'));
  const ini = Number(cfg.ventana_dia_inicio) || 0, fin = Number(cfg.ventana_dia_fin) || 0;
  if ((ini && dia < ini) || (fin && dia > fin))
    return { puede: false, motivo: 'La encuesta solo está habilitada del día ' + (ini || 1) + ' al día ' + (fin || 31) + ' de cada mes.' };
  const previas = leer_('Encuestas').rows.filter(r => String(r.ID_Usuario) === id);
  if (!previas.length) return { puede: true };
  const ultima = previas.map(r => r.Fecha_Registro).sort().pop();
  if (cfg.frecuencia_modo === 'DIAS_MINIMOS') {
    const dias = Math.floor((hoy - fechaDe_(ultima)) / 86400000), min = Number(cfg.dias_minimos) || 30;
    if (dias < min) return { puede: false, ultimaFecha: ultima, motivo: 'Ya realizó la encuesta el día ' + ultima.slice(0, 10) + '. Podrá volver a responder en ' + (min - dias) + ' día(s).' };
    return { puede: true };
  }
  const delMes = previas.filter(r => Number(r['Año']) === anio && Number(r.Mes) === mes);
  if (delMes.length) { const f = delMes.map(r => r.Fecha_Registro).sort().pop(); return { puede: false, ultimaFecha: f, motivo: 'Ya realizó la encuesta el día ' + f.slice(0, 10) + '.' }; }
  return { puede: true };
}

/* ---------------------------- Formulario ---------------------------- */
function listarUsuarios() {
  return { usuarios: leer_('Usuarios').rows.filter(u => u.Activo !== 'NO').map(u => ({ id: Number(u.ID), nombre: u.Nombre, area: u.Area })) };
}

function guardarEncuesta(req) {
  const est = estadoUsuario(req);
  if (!est.puede) throw new Error(est.motivo);                         // se valida otra vez en el servidor
  const u = leer_('Usuarios').rows.find(x => String(x.ID) === String(req.idUsuario) && x.Activo !== 'NO');
  if (!u) throw new Error('Usuario no encontrado o inactivo');
  const t = leer_('Encuestas');
  const ultimoId = t.rows.reduce((m, r) => Math.max(m, Number(r.ID_Encuesta) || 0), 0);
  const d = req.datos || {}, fecha = ahora_();
  const zonas = ZONAS.map((_, i) => { const z = (d.dolorZonas || {})[i + 1] || {}; return z.siente === 'si' ? Math.min(10, Math.max(1, parseInt(z.severidad || 1, 10) || 1)) : 0; });
  const maxSev = Math.max.apply(null, zonas);
  const enf = ENFERMEDADES.map((_, i) => ((d.enfermedades || {})[i] || {}).padece === 'SI' ? 'SI' : 'NO');
  const obs = ENFERMEDADES.map((n, i) => { const o = ((d.enfermedades || {})[i] || {}).observaciones; return o ? n + ': ' + o : ''; }).filter(String).join(' | ');
  const nivel = maxSev >= 7 ? 'Crítico' : (maxSev > 0 || enf.indexOf('SI') >= 0) ? 'Con síntomas' : 'Sano';
  const fila = [ultimoId + 1, fecha, Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)), Number(u.ID), u.Nombre, u.Area,
    d.cc || '', d.fechaNacimiento || '', d.fechaIngreso || '', d.cargo || ''].concat(enf, [obs], zonas, [maxSev, nivel]);
  t.sheet.appendRow(fila);
  return { idEncuesta: ultimoId + 1, fecha: fecha };
}

/* ---------------------------- Administración (requieren PIN) ---------------------------- */
function verificarPin() { return {}; }
function listarTodosUsuarios() { return { usuarios: leer_('Usuarios').rows.map(u => ({ id: Number(u.ID), nombre: u.Nombre, area: u.Area, activo: u.Activo !== 'NO' })) }; }
function crearUsuario(req) {
  const t = leer_('Usuarios'), nombre = String(req.nombre || '').trim().toUpperCase(), area = String(req.area || '').trim().toUpperCase();
  if (!nombre || !area) throw new Error('Nombre y área son obligatorios');
  if (t.rows.some(u => u.Nombre.trim().toUpperCase() === nombre)) throw new Error('Ya existe un usuario con ese nombre');
  const id = t.rows.reduce((m, u) => Math.max(m, Number(u.ID) || 0), 0) + 1;   // último ID + 1
  t.sheet.appendRow([id, nombre, area, 'SI']);
  return { id: id };
}
function filaUsuario_(id) {
  const s = SpreadsheetApp.getActive().getSheetByName('Usuarios'), ids = s.getRange(1, 1, s.getLastRow(), 1).getDisplayValues().map(r => r[0]);
  const i = ids.indexOf(String(id)); if (i < 1) throw new Error('Usuario no encontrado'); return { s: s, fila: i + 1 };
}
function editarUsuario(req) {
  const r = filaUsuario_(req.id);
  r.s.getRange(r.fila, 2, 1, 2).setValues([[String(req.nombre).trim().toUpperCase(), String(req.area).trim().toUpperCase()]]);
  return {};
}
function cambiarActivo(req) { const r = filaUsuario_(req.id); r.s.getRange(r.fila, 4).setValue(req.activo ? 'SI' : 'NO'); return {}; }

function listarEncuestas() { return { encuestas: leer_('Encuestas').rows }; }

// Usuarios activos que NO tienen encuesta en el mes/año indicado (por defecto el actual)
function pendientes(req) {
  const hoy = new Date();
  const anio = Number(req.anio) || Number(Utilities.formatDate(hoy, ZONA_HORARIA, 'yyyy'));
  const mes = Number(req.mes) || Number(Utilities.formatDate(hoy, ZONA_HORARIA, 'M'));
  const hechas = {};
  leer_('Encuestas').rows.filter(r => Number(r['Año']) === anio && Number(r.Mes) === mes).forEach(r => hechas[r.ID_Usuario] = r.Fecha_Registro);
  const lista = leer_('Usuarios').rows.filter(u => u.Activo !== 'NO').map(u => ({
    id: Number(u.ID), nombre: u.Nombre, area: u.Area, realizada: !!hechas[u.ID], fecha: hechas[u.ID] || ''
  }));
  return { anio: anio, mes: mes, usuarios: lista };
}

function obtenerConfig() { const c = config_(); delete c.pin_hash; return { config: c }; }
function guardarConfig(req) {
  const permitidas = ['frecuencia_modo', 'dias_minimos', 'ventana_dia_inicio', 'ventana_dia_fin'];
  const s = SpreadsheetApp.getActive().getSheetByName('Configuracion'), claves = s.getRange(1, 1, s.getLastRow(), 1).getValues().map(r => r[0]);
  Object.keys(req.config || {}).filter(k => permitidas.indexOf(k) >= 0).forEach(k => s.getRange(claves.indexOf(k) + 1, 2).setValue(req.config[k]));
  return {};
}
function cambiarPin(req) {
  if (!/^\d{4,8}$/.test(String(req.pinNuevo))) throw new Error('El PIN debe tener de 4 a 8 dígitos');
  const s = SpreadsheetApp.getActive().getSheetByName('Configuracion'), claves = s.getRange(1, 1, s.getLastRow(), 1).getValues().map(r => r[0]);
  s.getRange(claves.indexOf('pin_hash') + 1, 2).setValue(hashPin_(req.pinNuevo));
  return {};
}
