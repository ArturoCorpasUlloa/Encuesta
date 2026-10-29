import React, { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Lock, CheckCircle2, Home, Eye, EyeOff, Sun, Moon, Loader2, ShieldAlert } from 'lucide-react';
import { api } from './api';
import Combobox from './Combobox';
import Admin from './Admin';
import { enfermedadesList, zonasCuerpo } from './constants';
import logoEmpresa from './logo.jpg';

export default function App() {
  const [view, setView] = useState('form');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isDarkPref, setIsDark] = useState(true);
  const [printing, setPrinting] = useState(false); // al imprimir se fuerza el tema claro
  const isDark = isDarkPref && !printing;
  const [adminPin, setAdminPin] = useState(''); // PIN validado; solo vive en memoria
  const [verificando, setVerificando] = useState(false);
  const [errorPinMsg, setErrorPinMsg] = useState('');
  // Recuperación de PIN (código de emergencia guardado en Netlify)
  const [recuperando, setRecuperando] = useState(false);
  const [recForm, setRecForm] = useState({ codigo: '', pinNuevo: '', pinNuevo2: '' });
  const [recMsg, setRecMsg] = useState(null);           // { ok, msg }
  const [recCargando, setRecCargando] = useState(false);
  const [pinRestablecido, setPinRestablecido] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [errorUsuarios, setErrorUsuarios] = useState('');
  const [usuarioSel, setUsuarioSel] = useState(null);
  const [estadoUsuario, setEstadoUsuario] = useState(null); // { puede, motivo }
  const [consultando, setConsultando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null); // { ok: boolean, msg: string }
  const [formKey, setFormKey] = useState(0); // al cambiar, reinicia los campos no controlados

  const formVacio = {
    cc: '', fechaNacimiento: '', fechaIngreso: '', cargo: '',
    enfermedades: {}, dolorZonas: {}
  };
  const [formData, setFormData] = useState(formVacio);
  const [intentado, setIntentado] = useState(false); // true tras pulsar "Registrar" con campos vacíos

  // Campos obligatorios sin valor (se recalcula en vivo mientras el usuario completa)
  const CAMPOS_OBLIGATORIOS = [['cc', 'Cédula'], ['fechaNacimiento', 'Fecha de nacimiento'], ['fechaIngreso', 'Fecha de ingreso'], ['cargo', 'Cargo']];
  const camposFaltantes = CAMPOS_OBLIGATORIOS.filter(([c]) => !String(formData[c] || '').trim()).map(([c]) => c);
  const zonasFaltantes = zonasCuerpo.filter((z) => !['si', 'no'].includes(formData.dolorZonas[z.paramId]?.siente)).map((z) => z.paramId);
  const hayFaltantes = camposFaltantes.length > 0 || zonasFaltantes.length > 0;
  const errCampo = (c) => intentado && camposFaltantes.includes(c);
  const errZona = (id) => intentado && zonasFaltantes.includes(id);

  const cargarUsuarios = async () => {
    setCargandoUsuarios(true); setErrorUsuarios('');
    try { setUsuarios((await api('listarUsuarios')).usuarios); }
    catch (err) { setErrorUsuarios(err.message); }
    finally { setCargandoUsuarios(false); }
  };
  useEffect(() => { if (view === 'form') cargarUsuarios(); }, [view]);

  // Al elegir un usuario se consulta si ya respondió en el período configurado
  const elegirUsuario = async (u) => {
    setUsuarioSel(u); setEstadoUsuario(null); setResultado(null); setIntentado(false);
    if (!u) return;
    setConsultando(true);
    try { setEstadoUsuario(await api('estadoUsuario', { idUsuario: u.id })); }
    catch (err) { setEstadoUsuario({ puede: false, motivo: err.message }); }
    finally { setConsultando(false); }
  };

  const registrarEncuesta = async (e) => {
    e.preventDefault();
    setResultado(null);
    if (!usuarioSel) { setResultado({ ok: false, msg: 'Selecciona tu nombre de la lista.' }); return; }
    if (!estadoUsuario?.puede) return;
    if (hayFaltantes) {
      setIntentado(true);
      setTimeout(() => document.querySelector('[data-falta="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
      return;
    }
    // Completa los valores por defecto de los campos que el usuario no tocó
    const enfermedades = {};
    enfermedadesList.forEach((_, i) => {
      enfermedades[i] = {
        padece: formData.enfermedades[i]?.padece === 'SI' ? 'SI' : 'NO',
        observaciones: formData.enfermedades[i]?.observaciones || '',
      };
    });
    const dolorZonas = {};
    zonasCuerpo.forEach((z) => {
      const d = formData.dolorZonas[z.paramId];
      dolorZonas[z.paramId] = {
        siente: d?.siente === 'si' || d?.siente === 'no' ? d.siente : '--',
        severidad: d?.siente === 'si' ? parseInt(d.severidad || 1, 10) : null,
      };
    });
    setEnviando(true);
    try {
      await api('guardarEncuesta', {
        idUsuario: usuarioSel.id,
        datos: { ...formData, enfermedades, dolorZonas },
      });
      setResultado({ ok: true, msg: 'Encuesta registrada exitosamente. ¡Gracias por responder!' });
      setFormData(formVacio); setIntentado(false);
      setUsuarioSel(null); setEstadoUsuario(null);
      setFormKey((k) => k + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setResultado({ ok: false, msg: err.message });
      if (/Ya realiz/.test(err.message)) setEstadoUsuario({ puede: false, motivo: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const restablecerPin = async (e) => {
    e.preventDefault();
    setRecMsg(null);
    if (!recForm.codigo.trim()) return setRecMsg({ ok: false, msg: 'Ingresa el código de recuperación.' });
    if (!/^\d{4,8}$/.test(recForm.pinNuevo)) return setRecMsg({ ok: false, msg: 'El PIN nuevo debe tener de 4 a 8 dígitos.' });
    if (recForm.pinNuevo !== recForm.pinNuevo2) return setRecMsg({ ok: false, msg: 'Los dos PIN no coinciden.' });
    setRecCargando(true);
    try {
      await api('restablecerPin', { codigo: recForm.codigo.trim(), pinNuevo: recForm.pinNuevo });
      setRecForm({ codigo: '', pinNuevo: '', pinNuevo2: '' });
      setRecuperando(false); setErrorPinMsg(''); setPinRestablecido(true);
    } catch (err) { setRecMsg({ ok: false, msg: err.message }); }
    finally { setRecCargando(false); }
  };

  const ingresarAdmin = async (e) => {
    e.preventDefault();
    setVerificando(true); setErrorPinMsg(''); setPinRestablecido(false);
    try {
      await api('verificarPin', { pin });
      setAdminPin(pin); setPin(''); setView('admin');
    } catch (err) { setErrorPinMsg(err.message); }
    finally { setVerificando(false); }
  };

  // Impresión: se pasa a tema claro, se espera el re-render y se abre el diálogo de impresión
  const imprimir = () => { setPrinting(true); setTimeout(() => window.print(), 600); };
  useEffect(() => {
    const antes = () => flushSync(() => setPrinting(true)), despues = () => setPrinting(false);
    window.addEventListener('beforeprint', antes); window.addEventListener('afterprint', despues);
    return () => { window.removeEventListener('beforeprint', antes); window.removeEventListener('afterprint', despues); };
  }, []);

  const theme = {
    mainBg: isDark ? 'bg-[#242b3d]' : 'bg-slate-100',
    cardBg: isDark ? 'bg-[#323b4f]' : 'bg-white',
    sectionBg: isDark ? 'bg-[#2a3245]' : 'bg-slate-50',
    navBg: isDark ? 'bg-[#1e2433]' : 'bg-white shadow-md',
    text: isDark ? 'text-slate-200' : 'text-slate-800',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-500',
    border: isDark ? 'border-slate-600' : 'border-slate-300',
    inputBg: isDark ? 'bg-[#404b61] text-white border-transparent' : 'bg-white text-slate-800 border-slate-300',
    tableBorder: isDark ? 'border-slate-700/50' : 'border-slate-200'
  };

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  
  const handleEnfermedad = (id, campo, valor) => {
    setFormData({ ...formData, enfermedades: { ...formData.enfermedades, [id]: { ...formData.enfermedades[id], [campo]: valor } } });
  };

  const handleDolor = (zona, campo, valor) => {
    setFormData({ ...formData, dolorZonas: { ...formData.dolorZonas, [zona]: { ...formData.dolorZonas[zona], [campo]: valor } } });
  };

  const getZoneColor = (zonaId) => {
    const dolor = formData.dolorZonas[zonaId];
    if (!dolor || dolor.siente === '--' || !dolor.siente) return "#4f627a"; 
    if (dolor.siente === 'no') return "#4ade80";
    if (dolor.siente === 'si') {
      const severidad = parseInt(dolor.severidad || 1);
      if (severidad >= 1 && severidad <= 3) return "#facc15";
      if (severidad >= 4 && severidad <= 6) return "#f97316";
      if (severidad >= 7) return "#ef4444";
    }
    return "#4f627a";
  };

  const Navbar = () => (
    <nav className={`no-print ${theme.navBg} border-b ${theme.border} px-6 py-4 flex justify-between items-center transition-colors duration-300`}>
      <div className="flex items-center gap-3">
        <div className="bg-white rounded-full shadow-md w-14 h-14 flex items-center justify-center overflow-hidden border-2 border-orange-500">
          <img 
            src={logoEmpresa} 
            alt="Logo Empresa" 
            className="w-[90%] h-[90%] object-contain"
          />
        </div>
        <span className={`text-xl font-bold tracking-wider ${isDark ? 'text-white' : 'text-slate-800'}`}>
          SEGURIDAD Y SALUD EN EL TRABAJO <span className="text-cyan-500">(SST)</span>
        </span>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={() => setIsDark(!isDarkPref)} className={`p-2 rounded-full transition-colors ${isDark ? 'text-yellow-400 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-200'}`} title="Cambiar Tema">
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button onClick={() => { setAdminPin(''); setView('form'); }} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${view === 'form' ? 'bg-orange-500 text-white' : `${theme.textMuted} hover:text-orange-500`}`}>
          <Home className="w-4 h-4" /> Encuesta
        </button>
        <button onClick={() => setView(adminPin ? 'admin' : 'login')} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${view === 'login' || view === 'admin' ? (isDark ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-800') : `${theme.textMuted} hover:text-cyan-500`}`}>
          <Lock className="w-4 h-4" /> Admin
        </button>
      </div>
    </nav>
  );

  if (view === 'form') {
    return (
      <div className={`min-h-screen ${theme.mainBg} ${theme.text} font-sans transition-colors duration-300`}>
        <Navbar />
        <div className="max-w-5xl mx-auto py-10 px-4">
          <div className={`${theme.cardBg} rounded-lg shadow-xl overflow-hidden border ${theme.border}`}>
            
            <div className={`text-center py-10 px-6 border-b ${theme.border}`}>
              <h1 className="text-3xl md:text-4xl font-bold text-orange-500 mb-2">ENCUESTA DE SINTOMATOLOGÍA</h1>
              <p className={`${theme.textMuted} text-lg`}>Sistema de Gestión de Seguridad y Salud en el Trabajo</p>
            </div>

            <form key={formKey} noValidate className="p-6 md:p-10 space-y-8" onSubmit={registrarEncuesta}>
              {resultado && (
                <div className={`rounded-lg p-4 text-sm font-semibold border ${resultado.ok ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-red-500/10 border-red-500 text-red-500'}`}>
                  {resultado.msg}
                </div>
              )}
              
              {/* DATOS GENERALES */}
              <section>
                <h2 className={`text-cyan-500 font-bold mb-6 text-lg border-b ${theme.border} pb-2`}>DATOS GENERALES</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label htmlFor="usuario-combobox" className={`block text-sm ${theme.textMuted} mb-1`}>Nombre (escribe tu apellido o nombre y selecciónalo de la lista):</label>
                    <Combobox items={usuarios} selected={usuarioSel} onSelect={elegirUsuario} loading={cargandoUsuarios} theme={theme} />
                    {errorUsuarios && (
                      <p className="text-red-500 text-sm mt-2 font-semibold">
                        No se pudo cargar la lista de usuarios: {errorUsuarios}{' '}
                        <button type="button" onClick={cargarUsuarios} className="underline">Reintentar</button>
                      </p>
                    )}
                    {consultando && <p className={`${theme.textMuted} text-sm mt-2 flex items-center gap-2`}><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</p>}
                  </div>
                  {usuarioSel && (
                    <div>
                      <label className={`block text-sm ${theme.textMuted} mb-1`}>Área:</label>
                      <input readOnly value={usuarioSel.area} className={`w-full ${theme.inputBg} rounded p-3 border opacity-80`} />
                    </div>
                  )}
                  {[['cc', 'Cédula'], ['fechaNacimiento', 'Fecha de nacimiento'], ['fechaIngreso', 'Fecha de ingreso'], ['cargo', 'Cargo']].map(([campo, etiqueta]) => (
                    <div key={campo}>
                      <label className={`block text-sm ${theme.textMuted} mb-1`}>{etiqueta}: <span className="text-red-500">*</span></label>
                      <input
                        type={campo.includes('fecha') ? 'date' : 'text'} name={campo} value={formData[campo]} onChange={handleInputChange} required
                        data-falta={errCampo(campo) ? 'true' : undefined} aria-invalid={errCampo(campo) || undefined}
                        className={`w-full ${theme.inputBg} rounded p-3 focus:ring-2 focus:ring-cyan-500 outline-none border transition-colors ${errCampo(campo) ? '!border-red-500 ring-2 ring-red-500/60' : ''}`}
                        style={{colorScheme: isDark ? 'dark' : 'light'}}
                      />
                    </div>
                  ))}
                </div>

                {estadoUsuario && !estadoUsuario.puede && (
                  <div role="alert" className="mt-6 rounded-lg p-4 border border-amber-500 bg-amber-500/10 text-amber-500 flex gap-3 items-start">
                    <ShieldAlert className="w-6 h-6 shrink-0" />
                    <div>
                      <p className="font-bold">No puedes realizar la encuesta ahora</p>
                      <p className="text-sm">{estadoUsuario.motivo}</p>
                    </div>
                  </div>
                )}
              </section>

              <div className={usuarioSel && estadoUsuario?.puede ? 'space-y-8' : 'hidden'}>
              {/* ENFERMEDADES DIAGNOSTICADAS */}
              <section className={`${theme.sectionBg} rounded-xl overflow-hidden border ${theme.border}`}>
                <div className="bg-cyan-500 p-4 text-center">
                  <h2 className="text-white font-bold text-lg uppercase drop-shadow-md">¿Padece Alguna Enfermedad Diagnosticada?</h2>
                </div>
                <div className="p-6 overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className={`${isDark ? 'text-slate-300' : 'text-slate-600'} border-b ${theme.border} text-sm`}>
                        <th className="pb-3 w-12 text-center">N°</th>
                        <th className="pb-3 w-1/3">Enfermedad</th>
                        <th className="pb-3 w-32 text-center">SI / NO</th>
                        <th className="pb-3 pl-4">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${theme.tableBorder}`}>
                      {enfermedadesList.map((enf, idx) => (
                        <tr key={idx} className="text-sm">
                          <td className={`py-3 text-center ${theme.textMuted} font-medium`}>{idx + 1}</td>
                          <td className="py-3 font-medium">{enf}</td>
                          <td className="py-3 text-center">
                            <select 
                              className={`${theme.inputBg} border rounded p-1.5 w-full text-center outline-none focus:ring-1 focus:ring-cyan-500`}
                              onChange={(e) => handleEnfermedad(idx, 'padece', e.target.value)} defaultValue="NO"
                            >
                              <option value="NO">NO</option><option value="SI">SI</option>
                            </select>
                          </td>
                          <td className="py-3 pl-4">
                            <input type="text" className={`w-full ${theme.inputBg} border rounded p-2 focus:ring-2 focus:ring-cyan-500 outline-none`} onChange={(e) => handleEnfermedad(idx, 'observaciones', e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* SINTOMATOLOGIA DOLOROSA */}
              <section className={`${theme.sectionBg} rounded-xl overflow-hidden border ${theme.border}`}>
                <div className="bg-cyan-500 p-4 flex flex-wrap justify-between items-center">
                  <h2 className="text-white font-bold text-lg drop-shadow-md">SINTOMATOLOGÍA DOLOROSA</h2>
                  <div className="flex gap-4 text-sm font-semibold text-slate-800 bg-white/90 px-3 py-1 rounded-full shadow-sm">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#4ade80]"></span> NO</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#facc15]"></span> LEVE</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f97316]"></span> MEDIO</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#ef4444]"></span> ALTO</span>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row">
                  <div className="flex-1 p-6">
                    <div className={`grid grid-cols-[2fr_1fr_2fr] gap-4 mb-4 ${theme.textMuted} text-sm font-semibold border-b ${theme.border} pb-2`}>
                      <div>Zona Corporal</div><div className="text-center">Último Mes</div><div className="text-center">Severidad (1-10)</div>
                    </div>
                    <div className="space-y-4">
                      {zonasCuerpo.map((zona) => (
                        <div key={zona.id} className="grid grid-cols-[2fr_1fr_2fr] gap-4 items-center">
                          <div className={`text-sm font-medium ${errZona(zona.paramId) ? 'text-red-500' : ''}`}>{zona.nombre} <span className="text-red-500">*</span></div>
                          <div className="flex justify-center">
                            <select 
                              data-falta={errZona(zona.paramId) ? 'true' : undefined} aria-invalid={errZona(zona.paramId) || undefined}
                              className={`${theme.inputBg} border rounded p-1.5 w-full text-center outline-none focus:ring-1 focus:ring-cyan-500 ${errZona(zona.paramId) ? '!border-red-500 ring-2 ring-red-500/60' : ''}`}
                              onChange={(e) => handleDolor(zona.paramId, 'siente', e.target.value)} defaultValue="--"
                            >
                              <option value="--">--</option><option value="si">SI</option><option value="no">NO</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              type="range" min="1" max="10" defaultValue="1" disabled={formData.dolorZonas[zona.paramId]?.siente !== 'si'}
                              onChange={(e) => handleDolor(zona.paramId, 'severidad', e.target.value)}
                              className="w-full accent-cyan-500 disabled:opacity-30 cursor-pointer"
                            />
                            <span className="text-xs w-4 text-center text-cyan-500 font-bold">
                              {formData.dolorZonas[zona.paramId]?.siente === 'si' ? (formData.dolorZonas[zona.paramId]?.severidad || 1) : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* MAPA CORPORAL */}
                  <div className={`w-full lg:w-1/3 bg-[#2a3245] p-6 flex flex-col items-center justify-center border-l ${theme.border}`}>
                    <h3 className={`text-slate-300 font-bold mb-6 text-sm tracking-widest uppercase`}>Mapa Corporal</h3>
                    
                    <svg viewBox="0 0 200 500" className="w-full max-w-[260px] h-auto drop-shadow-2xl">
                      <style>{`.bp { stroke: #1e293b; stroke-width: 2.5; stroke-linejoin: round; transition: fill 0.3s; }`}</style>
                      
                      <rect x="88" y="70" width="24" height="15" fill={getZoneColor(1)} className="bp" />
                      <circle cx="100" cy="40" r="28" fill="#4f627a" className="bp" />
                      
                      <polygon points="60,87 140,87 128,155 72,155" fill={getZoneColor(8)} className="bp" />
                      <polygon points="72,157 128,157 128,205 72,205" fill={getZoneColor(9)} className="bp" />
                      <polygon points="72,207 128,207 132,250 100,270 68,250" fill={getZoneColor(10)} className="bp" />

                      <polygon points="58,87 28,87 31,123 55,123" fill={getZoneColor(2)} className="bp" />
                      <polygon points="31,125 55,125 52,163 34,163" fill={getZoneColor(3)} className="bp" />
                      <polygon points="34,165 52,165 53,176 35,176" fill={getZoneColor(4)} className="bp" />
                      <polygon points="35,178 53,178 56,238 39,238" fill={getZoneColor(5)} className="bp" />
                      <polygon points="39,240 56,240 57,248 38,248" fill={getZoneColor(6)} className="bp" />
                      <polygon points="38,250 57,250 57,268 47,285 36,268" fill={getZoneColor(7)} className="bp" />

                      <polygon points="142,87 172,87 169,123 145,123" fill={getZoneColor(2)} className="bp" />
                      <polygon points="145,125 169,125 166,163 148,163" fill={getZoneColor(3)} className="bp" />
                      <polygon points="148,165 166,165 165,176 147,176" fill={getZoneColor(4)} className="bp" />
                      <polygon points="147,178 165,178 161,238 144,238" fill={getZoneColor(5)} className="bp" />
                      <polygon points="144,240 161,240 162,248 143,248" fill={getZoneColor(6)} className="bp" />
                      <polygon points="143,250 162,250 164,268 153,285 143,268" fill={getZoneColor(7)} className="bp" />

                      <polygon points="68,253 98,272 98,353 73,353" fill={getZoneColor(11)} className="bp" />
                      <polygon points="73,355 98,355 98,370 75,370" fill={getZoneColor(12)} className="bp" />
                      <polygon points="75,372 98,372 98,445 78,445" fill={getZoneColor(13)} className="bp" />
                      <polygon points="78,447 98,447 98,472 72,460" fill={getZoneColor(14)} className="bp" />

                      <polygon points="132,253 102,272 102,353 127,353" fill={getZoneColor(11)} className="bp" />
                      <polygon points="127,355 102,355 102,370 125,370" fill={getZoneColor(12)} className="bp" />
                      <polygon points="125,372 102,372 102,445 122,445" fill={getZoneColor(13)} className="bp" />
                      <polygon points="122,447 102,447 102,472 128,460" fill={getZoneColor(14)} className="bp" />
                    </svg>

                  </div>
                </div>
              </section>

              </div>

              {intentado && hayFaltantes && (
                <div role="alert" className="rounded-lg p-4 text-sm font-semibold border bg-red-500/10 border-red-500 text-red-500">
                  Debes completar todos los campos obligatorios antes de registrar la encuesta.
                  <span className="block font-normal mt-1">
                    Falta: {[
                      ...CAMPOS_OBLIGATORIOS.filter(([c]) => camposFaltantes.includes(c)).map(([, e]) => e),
                      ...(zonasFaltantes.length ? [`Sintomatología dolorosa (${zonasFaltantes.length} ${zonasFaltantes.length === 1 ? 'zona sin responder' : 'zonas sin responder'}: SI / NO)`] : []),
                    ].join(', ')}.
                  </span>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <button type="submit" disabled={enviando || !usuarioSel || !estadoUsuario?.puede} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-12 py-4 rounded-lg font-bold text-lg shadow-lg shadow-orange-500/20 flex items-center gap-3 transition-transform hover:scale-105">
                  {enviando ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle2 className="w-6 h-6" />} {enviando ? 'Registrando…' : 'Registrar Encuesta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // VISTA DE LOGIN Y DASHBOARD
  if (view === 'login') {
    return (
      <div className={`min-h-screen ${theme.mainBg} font-sans transition-colors duration-300`}>
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-76px)] p-4">
          <div className={`${theme.cardBg} p-8 rounded-xl shadow-2xl max-w-md w-full border ${theme.border} text-center`}>
            <div className={`${theme.mainBg} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner`}>
              <Lock className="w-10 h-10 text-cyan-500" />
            </div>
            {recuperando ? (
              <>
                <h2 className={`text-2xl font-bold ${theme.text} mb-2`}>Restablecer PIN</h2>
                <p className={`${theme.textMuted} mb-6 text-sm`}>Ingresa el código de recuperación (lo conservan los administradores del sitio) y define un PIN nuevo de 4 a 8 dígitos.</p>
                <form onSubmit={restablecerPin} className="space-y-3 text-left">
                  <input type="password" autoComplete="off" placeholder="Código de recuperación" value={recForm.codigo}
                    onChange={(e) => setRecForm({ ...recForm, codigo: e.target.value })}
                    className={`w-full ${isDark ? 'bg-[#1e2433] text-white' : 'bg-slate-100 text-slate-800'} rounded-lg p-3 focus:ring-2 focus:ring-orange-500 outline-none border ${theme.border}`} />
                  <input type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={8} autoComplete="new-password" placeholder="PIN nuevo (4 a 8 dígitos)" value={recForm.pinNuevo}
                    onChange={(e) => setRecForm({ ...recForm, pinNuevo: e.target.value.replace(/\D/g, '') })}
                    className={`w-full ${isDark ? 'bg-[#1e2433] text-white' : 'bg-slate-100 text-slate-800'} rounded-lg p-3 focus:ring-2 focus:ring-orange-500 outline-none border ${theme.border}`} />
                  <input type={showPin ? 'text' : 'password'} inputMode="numeric" maxLength={8} autoComplete="new-password" placeholder="Repite el PIN nuevo" value={recForm.pinNuevo2}
                    onChange={(e) => setRecForm({ ...recForm, pinNuevo2: e.target.value.replace(/\D/g, '') })}
                    className={`w-full ${isDark ? 'bg-[#1e2433] text-white' : 'bg-slate-100 text-slate-800'} rounded-lg p-3 focus:ring-2 focus:ring-orange-500 outline-none border ${theme.border}`} />
                  <button type="button" onClick={() => setShowPin(!showPin)} className={`text-xs ${theme.textMuted} hover:text-cyan-500 flex items-center gap-1`}>
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />} {showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                  </button>
                  {recMsg && <p role="alert" className={`${recMsg.ok ? 'text-green-500' : 'text-red-500'} text-sm font-semibold`}>{recMsg.msg}</p>}
                  <button type="submit" disabled={recCargando} className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white p-4 rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
                    {recCargando && <Loader2 className="w-5 h-5 animate-spin" />} Restablecer PIN
                  </button>
                </form>
                <button type="button" onClick={() => { setRecuperando(false); setRecMsg(null); }} className={`mt-4 text-sm ${theme.textMuted} hover:text-cyan-500 underline`}>
                  Volver
                </button>
              </>
            ) : (
              <>
            <h2 className={`text-2xl font-bold ${theme.text} mb-2`}>Acceso Administrador</h2>
            <p className={`${theme.textMuted} mb-8`}>Ingrese el PIN de seguridad para acceder.</p>
            <form onSubmit={ingresarAdmin}>
              <div className="relative mb-4">
                <input 
                  type={showPin ? "text" : "password"} 
                  placeholder="PIN" 
                  value={pin} onChange={(e) => setPin(e.target.value)}
                  className={`w-full ${isDark ? 'bg-[#1e2433] text-white' : 'bg-slate-100 text-slate-800'} text-center text-2xl tracking-[0.5em] rounded-lg p-4 pr-12 focus:ring-2 focus:ring-orange-500 outline-none border ${theme.border}`}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPin(!showPin)} 
                  className={`absolute right-4 top-1/2 -translate-y-1/2 ${theme.textMuted} hover:text-cyan-500 transition-colors`}
                >
                  {showPin ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                </button>
              </div>
              
              {pinRestablecido && <p role="status" className="text-green-500 text-sm mb-4 font-semibold">PIN restablecido. Ingresa con tu nuevo PIN.</p>}
              {errorPinMsg && <p role="alert" className="text-red-500 text-sm mb-4 font-semibold">{errorPinMsg}</p>}
              <button type="submit" disabled={verificando || !pin} className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white p-4 rounded-lg font-bold transition-colors flex items-center justify-center gap-2">
                {verificando && <Loader2 className="w-5 h-5 animate-spin" />} Ingresar
              </button>
            </form>
            <button type="button" onClick={() => { setRecuperando(true); setRecMsg(null); setErrorPinMsg(''); setPinRestablecido(false); }} className={`mt-5 text-sm ${theme.textMuted} hover:text-cyan-500 underline`}>
              ¿Olvidaste el PIN?
            </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'admin') {
    return (
      <div className={`min-h-screen ${theme.mainBg} font-sans transition-colors duration-300`}>
        <Navbar />
        <Admin
          theme={theme} isDark={isDark} pin={adminPin} onImprimir={imprimir}
          onPinCambiado={setAdminPin}
          onSalir={() => { setAdminPin(''); setView('form'); }}
        />
      </div>
    );
  }
}
