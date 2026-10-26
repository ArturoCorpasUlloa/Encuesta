import React, { useEffect, useState } from 'react';
import { Loader2, Save, KeyRound } from 'lucide-react';
import { api } from './api';

export default function Configuracion({ theme, pin, onPinCambiado }) {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [pinNuevo, setPinNuevo] = useState('');
  const [pinConf, setPinConf] = useState('');
  const [msgPin, setMsgPin] = useState(null);

  useEffect(() => {
    api('obtenerConfig', { pin })
      .then(({ config }) => setCfg({
        frecuencia_modo: config.frecuencia_modo || 'MES_CALENDARIO',
        dias_minimos: Number(config.dias_minimos) || 30,
        ventana_dia_inicio: Number(config.ventana_dia_inicio) || 0,
        ventana_dia_fin: Number(config.ventana_dia_fin) || 0,
      }))
      .catch((e) => setMsg({ ok: false, texto: e.message }));
  }, [pin]);

  const guardar = async (e) => {
    e.preventDefault(); setMsg(null);
    const { dias_minimos: d, ventana_dia_inicio: i, ventana_dia_fin: f } = cfg;
    if (cfg.frecuencia_modo === 'DIAS_MINIMOS' && !(d >= 1 && d <= 365)) return setMsg({ ok: false, texto: 'Los días mínimos deben estar entre 1 y 365.' });
    if (i < 0 || i > 31 || f < 0 || f > 31) return setMsg({ ok: false, texto: 'Los días de la ventana van de 1 a 31 (0 = sin restricción).' });
    if (i && f && i > f) return setMsg({ ok: false, texto: 'El día de inicio no puede ser mayor que el día final.' });
    setGuardando(true);
    try { await api('guardarConfig', { pin, config: cfg }); setMsg({ ok: true, texto: 'Configuración guardada. Se aplica de inmediato.' }); }
    catch (err) { setMsg({ ok: false, texto: err.message }); }
    finally { setGuardando(false); }
  };

  const cambiarPin = async (e) => {
    e.preventDefault(); setMsgPin(null);
    if (!/^\d{4,8}$/.test(pinNuevo)) return setMsgPin({ ok: false, texto: 'El PIN debe tener de 4 a 8 dígitos.' });
    if (pinNuevo !== pinConf) return setMsgPin({ ok: false, texto: 'La confirmación no coincide.' });
    try {
      await api('cambiarPin', { pin, pinNuevo });
      onPinCambiado(pinNuevo); setPinNuevo(''); setPinConf('');
      setMsgPin({ ok: true, texto: 'PIN actualizado.' });
    } catch (err) { setMsgPin({ ok: false, texto: err.message }); }
  };

  const inp = `${theme.inputBg} border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 w-28`;
  const aviso = (m) => m && <div role="status" className={`rounded-lg p-3 text-sm font-semibold border ${m.ok ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-red-500 text-red-500 bg-red-500/10'}`}>{m.texto}</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 mt-4">
      <form onSubmit={guardar} className={`${theme.cardBg} border ${theme.border} rounded-xl p-6 space-y-5`}>
        <div>
          <h2 className={`text-lg font-bold ${theme.text}`}>Frecuencia de la encuesta</h2>
          <p className={`${theme.textMuted} text-sm`}>Define cada cuánto puede responder un mismo usuario.</p>
        </div>
        {!cfg && !msg && <div className={theme.textMuted}><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Cargando…</div>}
        {cfg && (
          <>
            <fieldset className="space-y-3">
              <legend className="sr-only">Modo</legend>
              <label className={`flex items-start gap-3 ${theme.text}`}>
                <input type="radio" name="modo" checked={cfg.frecuencia_modo === 'MES_CALENDARIO'} onChange={() => setCfg({ ...cfg, frecuencia_modo: 'MES_CALENDARIO' })} className="mt-1 accent-cyan-500" />
                <span><b>Una vez por mes calendario</b><br /><span className={`${theme.textMuted} text-sm`}>Quien ya respondió en el mes no puede volver a hacerlo hasta el mes siguiente.</span></span>
              </label>
              <label className={`flex items-start gap-3 ${theme.text}`}>
                <input type="radio" name="modo" checked={cfg.frecuencia_modo === 'DIAS_MINIMOS'} onChange={() => setCfg({ ...cfg, frecuencia_modo: 'DIAS_MINIMOS' })} className="mt-1 accent-cyan-500" />
                <span><b>Mínimo de días entre encuestas</b><br />
                  <span className={`${theme.textMuted} text-sm`}>Debe pasar este número de días desde la última encuesta del usuario.</span>
                  <br /><input type="number" min="1" max="365" disabled={cfg.frecuencia_modo !== 'DIAS_MINIMOS'} aria-label="Días mínimos" value={cfg.dias_minimos} onChange={(e) => setCfg({ ...cfg, dias_minimos: Number(e.target.value) })} className={`${inp} mt-2 disabled:opacity-40`} /> <span className={`${theme.textMuted} text-sm`}>días</span>
                </span>
              </label>
            </fieldset>
            <div>
              <h3 className={`font-bold ${theme.text}`}>Ventana de días del mes (opcional)</h3>
              <p className={`${theme.textMuted} text-sm mb-2`}>Limita en qué días del mes se puede responder. Deja 0 en ambos para no restringir.</p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className={`text-sm ${theme.textMuted}`}>Desde el día <input type="number" min="0" max="31" value={cfg.ventana_dia_inicio} onChange={(e) => setCfg({ ...cfg, ventana_dia_inicio: Number(e.target.value) })} className={`${inp} ml-2`} /></label>
                <label className={`text-sm ${theme.textMuted}`}>hasta el día <input type="number" min="0" max="31" value={cfg.ventana_dia_fin} onChange={(e) => setCfg({ ...cfg, ventana_dia_fin: Number(e.target.value) })} className={`${inp} ml-2`} /></label>
              </div>
            </div>
            <button disabled={guardando} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar configuración
            </button>
          </>
        )}
        {aviso(msg)}
      </form>

      <form onSubmit={cambiarPin} className={`${theme.cardBg} border ${theme.border} rounded-xl p-6 space-y-4`}>
        <div>
          <h2 className={`text-lg font-bold ${theme.text} flex items-center gap-2`}><KeyRound className="w-5 h-5 text-cyan-500" /> Cambiar PIN</h2>
          <p className={`${theme.textMuted} text-sm`}>Protege el panel de administración y esta configuración. De 4 a 8 dígitos.</p>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>PIN nuevo
            <input type="password" inputMode="numeric" autoComplete="new-password" value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} className={inp} />
          </label>
          <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Confirmar PIN
            <input type="password" inputMode="numeric" autoComplete="new-password" value={pinConf} onChange={(e) => setPinConf(e.target.value)} className={inp} />
          </label>
        </div>
        <button className="bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg font-bold">Actualizar PIN</button>
        {aviso(msgPin)}
      </form>
    </div>
  );
}
