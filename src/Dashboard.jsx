import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Download, Wifi, WifiOff, Loader2, Inbox, AlertTriangle, Printer, RefreshCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, ReferenceLine,
} from 'recharts';
import { api, filaADoc } from './api';
import { enfermedadesList, zonasCuerpo } from './constants';
import { normalizarRegistros, calcular, porAnio, exportarCSV, aplicarCruzado } from './analytics';

const C = {
  naranja: '#f97316', cian: '#06b6d4', verde: '#10b981', rojo: '#ef4444',
  amarillo: '#facc15', violeta: '#a78bfa', rosa: '#f472b6', azul: '#60a5fa',
};
const SERIE_SEDES = [C.cian, C.naranja, C.violeta, C.verde, C.rosa, C.azul, C.amarillo, C.rojo];
const COLOR_ESTADO = { 'Personal sano': C.verde, 'Con síntomas / enfermedad': C.amarillo, 'Casos críticos': C.rojo };
const NIVEL_ESTADO = { 'Personal sano': 'sano', 'Con síntomas / enfermedad': 'sintomas', 'Casos críticos': 'critico' };
const CF_VACIO = { estado: null, semaforo: null, enfermedad: null, zona: null, cargo: null, area: null, mes: null, antiguedad: null, edad: null };
const DIMS = Object.keys(CF_VACIO);
const COLOR_SEM = { 'Sin dolor': '#4ade80', Leve: '#facc15', Medio: '#f97316', Alto: '#ef4444' };

/* ------------------------------------------------------------------ */
/* Lectura desde Google Sheets (vía backend). Sin datos simulados.     */
/* ------------------------------------------------------------------ */
function useEncuestas(pin) {
  const [estado, setEstado] = useState({ status: 'conectando', docs: [], error: null, actualizado: null });

  const cargar = useCallback(async (silencioso) => {
    if (!silencioso) setEstado((e) => ({ ...e, status: 'conectando' }));
    try {
      const { encuestas } = await api('listarEncuestas', { pin });
      setEstado({ status: 'conectado', docs: encuestas.map(filaADoc), error: null, actualizado: new Date() });
    } catch (err) {
      setEstado((e) => ({ ...e, status: 'error', error: err.message }));
    }
  }, [pin]);

  useEffect(() => {
    cargar(false);
    const t = setInterval(() => cargar(true), 60000); // se refresca solo cada minuto
    return () => clearInterval(t);
  }, [cargar]);

  return { ...estado, recargar: () => cargar(false) };
}

/* ------------------------------------------------------------------ */
/* Piezas de UI                                                         */
/* ------------------------------------------------------------------ */
function EstadoConexion({ status, actualizado }) {
  const map = {
    conectando: { t: 'Conectando con Google Sheets…', c: 'text-cyan-500', Icon: Loader2, spin: true },
    conectado: { t: 'Conectado a Google Sheets', c: 'text-emerald-500', Icon: Wifi },
    error: { t: 'Error de conexión', c: 'text-red-500', Icon: AlertTriangle },
  }[status];
  return (
    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${map.c}`}>
      <map.Icon className={`w-4 h-4 ${map.spin ? 'animate-spin' : ''}`} /> {map.t}
      {status === 'conectado' && actualizado && (
        <span className="font-normal opacity-70">· actualizado {actualizado.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
      )}
    </span>
  );
}

function Espera({ status, error, theme }) {
  const contenido = {
    conectando: { Icon: Loader2, spin: true, titulo: 'Conectando con la base de datos…', texto: 'Los gráficos aparecerán en cuanto lleguen los datos.' },
    error: { Icon: AlertTriangle, titulo: 'No se pudo leer la base de datos', texto: error || 'Revisa la conexión y la configuración del servidor.' },
    conectado: { Icon: Inbox, titulo: 'Aún no hay encuestas registradas', texto: 'Cuando se registre la primera encuesta, los KPI y gráficos se generarán automáticamente.' },
  }[status];
  return (
    <div className={`${theme.cardBg} border ${theme.border} rounded-xl p-12 text-center`}>
      <contenido.Icon className={`w-14 h-14 mx-auto mb-4 text-cyan-500 ${contenido.spin ? 'animate-spin' : ''}`} />
      <h2 className={`text-xl font-bold ${theme.text} mb-2`}>{contenido.titulo}</h2>
      <p className={`${theme.textMuted} max-w-xl mx-auto`}>{contenido.texto}</p>
    </div>
  );
}

function Kpi({ titulo, valor, detalle, color = 'text-cyan-500', theme }) {
  return (
    <div className={`break-inside-avoid ${theme.cardBg} p-5 rounded-xl border ${theme.border}`}>
      <p className={`${theme.textMuted} text-sm font-semibold mb-1`}>{titulo}</p>
      <p className={`text-3xl font-bold ${color} leading-tight break-words`}>{valor ?? '—'}</p>
      {detalle && <p className={`${theme.textMuted} text-xs mt-1`}>{detalle}</p>}
    </div>
  );
}

function Tarjeta({ titulo, subtitulo, vacio, children, ancho, theme }) {
  return (
    <div className={`break-inside-avoid ${ancho ? 'lg:col-span-2' : ''} ${theme.cardBg} p-6 rounded-xl border ${theme.border}`}>
      <h2 className={`text-lg font-bold ${theme.text}`}>{titulo}</h2>
      {subtitulo && <p className={`${theme.textMuted} text-xs mb-4`}>{subtitulo}</p>}
      {!subtitulo && <div className="mb-4" />}
      {vacio ? (
        <div className={`h-40 flex items-center justify-center text-sm ${theme.textMuted}`}>Sin datos para mostrar</div>
      ) : children}
    </div>
  );
}

function MapaCalor({ filas, sedes, theme, isDark, color }) {
  if (!sedes.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-separate border-spacing-1 min-w-[420px]">
        <thead>
          <tr className={theme.textMuted}>
            <th className="text-left font-semibold pr-2"></th>
            {sedes.map((s) => <th key={s} className="font-semibold px-1 text-center">{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre}>
              <td className={`pr-2 whitespace-nowrap ${theme.text}`}>{f.nombre}</td>
              {f.celdas.map((c, i) => (
                <td
                  key={i}
                  title={`${c.n} personas (${c.p}% del área)`}
                  className="text-center rounded py-1.5 font-semibold"
                  style={{
                    background: c.n ? `${color}${Math.round(40 + Math.min(c.p, 100) * 2.1).toString(16).padStart(2, '0')}` : (isDark ? '#2a3245' : '#f1f5f9'),
                    color: c.n ? '#fff' : (isDark ? '#64748b' : '#94a3b8'),
                  }}
                >
                  {c.n || '·'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`${theme.textMuted} text-[11px] mt-2`}>Número de personas; la intensidad indica el % del área.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                            */
/* ------------------------------------------------------------------ */
export default function Dashboard({ theme, isDark, pin, onImprimir }) {
  const { status, docs, error, actualizado, recargar } = useEncuestas(pin);
  const [anio, setAnio] = useState('todos');
  const [sede, setSede] = useState('todas');           // "sede" = área del usuario
  const [enfermedad, setEnfermedad] = useState('todas');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');

  const registros = useMemo(() => normalizarRegistros(docs), [docs]);
  const aniosDisp = useMemo(() => [...new Set(registros.map((r) => r.anio))].sort((a, b) => b - a), [registros]);
  const sedesDisp = useMemo(() => [...new Set(registros.map((r) => r.sede))].sort(), [registros]);

  useEffect(() => { if (anio !== 'todos' && !aniosDisp.includes(Number(anio))) setAnio('todos'); }, [aniosDisp, anio]);
  useEffect(() => { if (sede !== 'todas' && !sedesDisp.includes(sede)) setSede('todas'); }, [sedesDisp, sede]);

  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const porSede = useMemo(() => registros.filter((r) =>
    (sede === 'todas' || r.sede === sede) &&
    (enfermedad === 'todas' || r.enfermedades.includes(Number(enfermedad))) &&
    (!desde || ymd(r.fecha) >= desde) && (!hasta || ymd(r.fecha) <= hasta)
  ), [registros, sede, enfermedad, desde, hasta]);
  const filtrados = useMemo(() => porSede.filter((r) => anio === 'todos' || r.anio === Number(anio)), [porSede, anio]);

  // ---- Filtro cruzado entre gráficos (clic en un gráfico = filtro para los demás) ----
  const [cf, setCf] = useState(CF_VACIO);
  const hayCf = DIMS.some((d) => cf[d] != null);
  const alternar = (dim, valor) => setCf((c) => ({ ...c, [dim]: c[dim] === valor ? null : valor }));
  const alternarAnio = (a) => setAnio((prev) => (prev === String(a) ? 'todos' : String(a)));
  useEffect(() => { setCf((c) => (c.mes == null ? c : { ...c, mes: null })); }, [anio]);                       // la clave del mes depende del año
  useEffect(() => { if (sede !== 'todas') setCf((c) => (c.area == null ? c : { ...c, area: null })); }, [sede]);

  const visibles = useMemo(() => aplicarCruzado(filtrados, cf, null), [filtrados, cf]);
  const D = useMemo(() => calcular(visibles, { anioSel: anio, todosSede: sede === 'todas' }), [visibles, anio, sede]);
  // Cada gráfico se alimenta con todas las selecciones MENOS la suya: así sigue mostrando todas sus categorías, con la elegida resaltada
  const X = useMemo(() => {
    const o = {};
    DIMS.forEach((d) => { o[d] = calcular(aplicarCruzado(filtrados, cf, d), { anioSel: anio, todosSede: sede === 'todas' }); });
    return o;
  }, [filtrados, cf, anio, sede]);
  const A = useMemo(() => porAnio(aplicarCruzado(porSede, cf, null)), [porSede, cf]);
  const op = (dim, valor) => (cf[dim] == null || cf[dim] === valor ? 1 : 0.3);   // opacidad: lo no seleccionado se atenúa
  const opAnio = (a) => (anio === 'todos' || anio === String(a) ? 1 : 0.3);
  const mesSel = cf.mes != null ? X.mes.mensual.find((m) => m.key === cf.mes)?.mes : null;
  const etiquetasCf = {
    estado: cf.estado && `Estado: ${Object.keys(NIVEL_ESTADO).find((n) => NIVEL_ESTADO[n] === cf.estado)}`,
    semaforo: cf.semaforo && `Severidad: ${cf.semaforo}`,
    enfermedad: cf.enfermedad != null && `Enfermedad: ${enfermedadesList[cf.enfermedad]}`,
    zona: cf.zona != null && `Zona: ${zonasCuerpo.find((z) => z.paramId === cf.zona)?.corto}`,
    cargo: cf.cargo && `Cargo: ${cf.cargo}`,
    area: cf.area && `Área: ${cf.area}`,
    mes: cf.mes != null && `Mes: ${mesSel || ''}`,
    antiguedad: cf.antiguedad && `Antigüedad: ${cf.antiguedad}`,
    edad: cf.edad && `Edad: ${cf.edad}`,
  };

  const resumenFiltros = [
    anio !== 'todos' && `Año ${anio}`, sede !== 'todas' && `Área: ${sede}`,
    enfermedad !== 'todas' && `Enfermedad: ${enfermedadesList[Number(enfermedad)]}`,
    desde && `Desde ${desde}`, hasta && `Hasta ${hasta}`,
    ...DIMS.map((d) => etiquetasCf[d]),
  ].filter(Boolean).join(' · ') || 'Sin filtros (todos los datos)';

  const ejeColor = isDark ? '#94a3b8' : '#64748b';
  const rejilla = isDark ? '#404b61' : '#e2e8f0';
  const tip = {
    contentStyle: { backgroundColor: isDark ? '#1e2433' : '#ffffff', borderColor: rejilla, color: isDark ? '#fff' : '#000', borderRadius: 8 },
    labelStyle: { color: isDark ? '#fff' : '#000' },
    itemStyle: { color: isDark ? '#e2e8f0' : '#334155' },
    cursor: { fill: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.1)' },
  };
  const ejes = { stroke: ejeColor, tick: { fill: ejeColor, fontSize: 12 } };
  const alto = (n) => Math.max(240, n * 34 + 40);
  const k = D.kpi;
  const hayDatos = registros.length > 0;
  const delta = k.mesActual - k.mesAnterior;

  const selectCls = `${theme.inputBg} border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500`;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 mt-4">
      {/* Encabezado solo para el PDF impreso */}
      <div className="hidden print:block mb-2">
        <h1 className="text-2xl font-bold text-slate-800">Panel de Control SG-SST · Sintomatología</h1>
        <p className="text-sm text-slate-600">{resumenFiltros} · Generado el {new Date().toLocaleDateString('es-CO')}</p>
      </div>

      <div className={`print:hidden flex flex-wrap gap-4 justify-between items-center ${theme.cardBg} p-6 rounded-xl border ${theme.border}`}>
        <div>
          <h1 className="text-2xl font-bold text-orange-500 flex items-center gap-3">
            <Activity className="w-8 h-8 text-cyan-500" /> Gráficos e indicadores
          </h1>
          <div className="mt-1"><EstadoConexion status={status} actualizado={actualizado} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={recargar} className={`${theme.inputBg} border px-4 py-2.5 rounded-lg flex items-center gap-2 font-semibold`} title="Volver a leer los datos">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
          <button onClick={onImprimir} disabled={!visibles.length}
            className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-lg">
            <Printer className="w-5 h-5" /> Imprimir / PDF
          </button>
          <button
            onClick={() => exportarCSV(visibles)}
            disabled={!visibles.length}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-lg"
          >
            <Download className="w-5 h-5" /> Exportar a Excel
          </button>
        </div>
      </div>

      {hayDatos && (
        <div className={`print:hidden ${theme.cardBg} border ${theme.border} rounded-xl p-4 flex flex-wrap items-end gap-4`}>
          <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Año
            <select value={anio} onChange={(e) => setAnio(e.target.value)} className={selectCls}>
              <option value="todos">Todos</option>
              {aniosDisp.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Área
            <select value={sede} onChange={(e) => setSede(e.target.value)} className={selectCls}>
              <option value="todas">Todas</option>
              {sedesDisp.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Enfermedad
            <select value={enfermedad} onChange={(e) => setEnfermedad(e.target.value)} className={selectCls}>
              <option value="todas">Todas</option>
              {enfermedadesList.map((e, i) => <option key={e} value={i}>{e}</option>)}
            </select>
          </label>
          <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Desde
            <input type="date" value={desde} max={hasta || undefined} onChange={(e) => setDesde(e.target.value)} className={selectCls} style={{ colorScheme: isDark ? 'dark' : 'light' }} />
          </label>
          <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Hasta
            <input type="date" value={hasta} min={desde || undefined} onChange={(e) => setHasta(e.target.value)} className={selectCls} style={{ colorScheme: isDark ? 'dark' : 'light' }} />
          </label>
          {(anio !== 'todos' || sede !== 'todas' || enfermedad !== 'todas' || desde || hasta || hayCf) && (
            <button onClick={() => { setAnio('todos'); setSede('todas'); setEnfermedad('todas'); setDesde(''); setHasta(''); setCf(CF_VACIO); }} className="text-sm text-cyan-500 underline pb-2">
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {hayDatos && (
        <div className={`print:hidden ${theme.textMuted} text-xs flex flex-wrap items-center gap-2 -mt-2`}>
          {!hayCf ? (
            <span>💡 Haz clic en una barra, sector o punto de cualquier gráfico para filtrar todos los demás. Vuelve a hacer clic para quitar la selección.</span>
          ) : (
            <>
              <span className="font-semibold">Selección en gráficos:</span>
              {DIMS.filter((d) => etiquetasCf[d]).map((d) => (
                <button key={d} onClick={() => setCf((c) => ({ ...c, [d]: null }))} title="Quitar este filtro"
                  className="bg-cyan-500/15 text-cyan-500 border border-cyan-500/40 rounded-full px-3 py-1 font-semibold hover:bg-cyan-500/25">
                  {etiquetasCf[d]} ✕
                </button>
              ))}
              <button onClick={() => setCf(CF_VACIO)} className="text-cyan-500 underline">Quitar selección</button>
            </>
          )}
        </div>
      )}

      {!hayDatos && <Espera status={status} error={error} theme={theme} />}

      {hayDatos && filtrados.length === 0 && (
        <div className={`${theme.cardBg} border ${theme.border} rounded-xl p-10 text-center ${theme.textMuted}`}>
          No hay encuestas para el filtro seleccionado.
        </div>
      )}

      {hayDatos && filtrados.length > 0 && visibles.length === 0 && (
        <div className={`${theme.cardBg} border ${theme.border} rounded-xl p-10 text-center ${theme.textMuted}`}>
          No hay encuestas que cumplan la selección actual.{' '}
          <button onClick={() => setCf(CF_VACIO)} className="text-cyan-500 underline">Quitar selección</button>
        </div>
      )}

      {hayDatos && visibles.length > 0 && (
        <>
          <style>{`.cf-click .recharts-wrapper { cursor: pointer; }`}</style>
          {/* ---------------- KPI ---------------- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi theme={theme} titulo="Total encuestas" valor={k.total} color="text-cyan-500"
              detalle={anio !== 'todos' ? `Año ${anio}` : 'Todos los años'} />
            <Kpi theme={theme} titulo="Encuestas este mes" valor={k.mesActual} color="text-cyan-500"
              detalle={`${delta >= 0 ? '+' : ''}${delta} vs. mes anterior (${k.mesAnterior})`} />
            <Kpi theme={theme} titulo="Personal sano" valor={`${k.pctSanos}%`} color="text-emerald-500"
              detalle={`${k.sanos} ${k.sanos === 1 ? 'persona' : 'personas'} sin dolor ni enfermedad`} />
            <Kpi theme={theme} titulo="Prevalencia de dolor" valor={`${k.pctDolor}%`} color="text-amber-500"
              detalle={`${k.conDolor} ${k.conDolor === 1 ? 'persona' : 'personas'} con dolor en el último mes`} />
            <Kpi theme={theme} titulo="Casos críticos" valor={k.criticos} color="text-red-500"
              detalle={`${k.pctCriticos}% · severidad ≥ 7 en alguna zona`} />
            <Kpi theme={theme} titulo="Con enfermedad diagnosticada" valor={`${k.pctEnf}%`} color="text-orange-500"
              detalle={`${k.conEnf} ${k.conEnf === 1 ? 'persona' : 'personas'}`} />
            <Kpi theme={theme} titulo="Severidad promedio" valor={k.sevProm != null ? `${k.sevProm} / 10` : '—'} color="text-orange-500"
              detalle={k.zonasPorPersona != null ? `${k.zonasPorPersona} zonas con dolor por persona afectada` : 'Sin dolor reportado'} />
            <Kpi theme={theme} titulo="Zona más afectada" valor={k.zonaTop?.name} color="text-cyan-500"
              detalle={k.zonaTop ? `${k.zonaTop.casos} casos (${k.zonaTop.pct}%) · sev. prom. ${k.zonaTop.sevProm}` : 'Sin dolor reportado'} />
            <Kpi theme={theme} titulo="Enfermedad más frecuente" valor={k.enfTop?.name} color="text-cyan-500"
              detalle={k.enfTop ? `${k.enfTop.casos} casos` : 'Sin diagnósticos reportados'} />
            <Kpi theme={theme} titulo="Área con mayor prevalencia" valor={k.sedeTop?.sede || (sede !== 'todas' ? sede : cf.area || '—')} color="text-violet-400"
              detalle={k.sedeTop ? `${k.sedeTop.conDolor}% con dolor · ${k.sedeTop.criticosN} críticos` : sede !== 'todas' || cf.area ? 'Área filtrada' : 'Se necesitan 2 o más áreas'} />
            <Kpi theme={theme} titulo="Antigüedad promedio" valor={k.antiguedadProm != null ? `${k.antiguedadProm} años` : '—'} color="text-cyan-500"
              detalle="Según fecha de ingreso" />
            <Kpi theme={theme} titulo="Edad promedio" valor={k.edadProm != null ? `${k.edadProm} años` : '—'} color="text-cyan-500"
              detalle="Según fecha de nacimiento" />
          </div>

          <div className="cf-click grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ---------------- Por año ---------------- */}
            <Tarjeta theme={theme} titulo="Encuestas por año y área" subtitulo="Respeta los filtros de área, enfermedad y fecha" vacio={!A.filas.length}>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={A.filas}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis dataKey="anio" {...ejes} /><YAxis allowDecimals={false} {...ejes} />
                    <Tooltip {...tip} />
                    {A.sedes.length > 1 && <Legend />}
                    {A.sedes.map((s, i) => (
                      <Bar key={s} dataKey={s} stackId="a" fill={SERIE_SEDES[i % SERIE_SEDES.length]}
                        radius={i === A.sedes.length - 1 ? [4, 4, 0, 0] : 0} onClick={(d) => alternarAnio(d.payload.anio)}>
                        {A.filas.map((f) => <Cell key={f.anio} fill={SERIE_SEDES[i % SERIE_SEDES.length]} fillOpacity={opAnio(f.anio)} />)}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            <Tarjeta theme={theme} titulo="Evolución anual de indicadores (%)" subtitulo="Dolor, enfermedad diagnosticada y casos críticos por año" vacio={!A.filas.length}>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <LineChart data={A.filas} onClick={(st) => { const a = st?.activePayload?.[0]?.payload?.anio; if (a) alternarAnio(a); }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis dataKey="anio" {...ejes} /><YAxis unit="%" domain={[0, 100]} {...ejes} />
                    <Tooltip {...tip} formatter={(v) => `${v}%`} /><Legend />
                    <Line type="monotone" name="Con dolor" dataKey="pctDolor" stroke={C.amarillo} strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" name="Con enfermedad" dataKey="pctEnf" stroke={C.naranja} strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" name="Críticos" dataKey="pctCriticos" stroke={C.rojo} strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            {/* ---------------- Evolución mensual ---------------- */}
            <Tarjeta theme={theme} ancho titulo={anio !== 'todos' ? `Evolución mensual · ${anio}` : 'Evolución mensual (todos los años)'} vacio={!X.mes.mensual.length}>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <AreaChart data={X.mes.mensual} onClick={(st) => { const k2 = st?.activePayload?.[0]?.payload?.key; if (k2 != null) alternar('mes', k2); }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis dataKey="mes" {...ejes} /><YAxis allowDecimals={false} {...ejes} />
                    <Tooltip {...tip} /><Legend />
                    <Area type="monotone" name="Encuestas" dataKey="encuestas" stroke={C.cian} fill={C.cian} fillOpacity={0.25} />
                    <Area type="monotone" name="Con síntomas" dataKey="sintomas" stroke={C.amarillo} fill={C.amarillo} fillOpacity={0.2} />
                    <Area type="monotone" name="Críticos" dataKey="criticos" stroke={C.rojo} fill={C.rojo} fillOpacity={0.3} />
                    {mesSel && <ReferenceLine x={mesSel} stroke={C.naranja} strokeWidth={2} strokeDasharray="4 4" />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            {/* ---------------- Estado general ---------------- */}
            <Tarjeta theme={theme} titulo="Estado de salud del personal" vacio={!X.estado.estado.length}>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={X.estado.estado} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value" label
                      onClick={(d) => alternar('estado', NIVEL_ESTADO[d?.name ?? d?.payload?.name])}>
                      {X.estado.estado.map((e) => <Cell key={e.name} fill={COLOR_ESTADO[e.name]} fillOpacity={op('estado', NIVEL_ESTADO[e.name])} stroke="none" />)}
                    </Pie>
                    <Tooltip {...tip} /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            <Tarjeta theme={theme} titulo="Nivel de severidad (semáforo)" subtitulo="Según la mayor severidad reportada por persona" vacio={!X.semaforo.semaforo.length}>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={X.semaforo.semaforo} cx="50%" cy="50%" outerRadius={85} dataKey="value" label
                      onClick={(d) => alternar('semaforo', d?.name ?? d?.payload?.name)}>
                      {X.semaforo.semaforo.map((e) => <Cell key={e.name} fill={COLOR_SEM[e.name]} fillOpacity={op('semaforo', e.name)} stroke="none" />)}
                    </Pie>
                    <Tooltip {...tip} /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            {/* ---------------- Enfermedades y zonas ---------------- */}
            <Tarjeta theme={theme} titulo="Enfermedades diagnosticadas" vacio={!X.enfermedad.enfCont.length}>
              <div style={{ height: alto(X.enfermedad.enfCont.length) }} className="w-full">
                <ResponsiveContainer>
                  <BarChart data={X.enfermedad.enfCont} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis type="number" allowDecimals={false} {...ejes} />
                    <YAxis type="category" dataKey="name" width={170} {...ejes} />
                    <Tooltip {...tip} />
                    <Bar dataKey="casos" name="Casos" fill={C.naranja} radius={[0, 4, 4, 0]} onClick={(d) => alternar('enfermedad', enfermedadesList.indexOf(d.payload.name))}>
                      {X.enfermedad.enfCont.map((e) => <Cell key={e.name} fill={C.naranja} fillOpacity={op('enfermedad', enfermedadesList.indexOf(e.name))} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            <Tarjeta theme={theme} titulo="Zonas corporales con dolor" subtitulo="Número de personas que reportan dolor en cada zona" vacio={!X.zona.zonasFrecuencia.length}>
              <div style={{ height: alto(X.zona.zonasFrecuencia.length) }} className="w-full">
                <ResponsiveContainer>
                  <BarChart data={X.zona.zonasFrecuencia} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis type="number" allowDecimals={false} {...ejes} />
                    <YAxis type="category" dataKey="name" width={110} {...ejes} />
                    <Tooltip {...tip} />
                    <Bar dataKey="casos" name="Personas" fill={C.cian} radius={[0, 4, 4, 0]} onClick={(d) => alternar('zona', d.payload.id)}>
                      {X.zona.zonasFrecuencia.map((z) => <Cell key={z.id} fill={C.cian} fillOpacity={op('zona', z.id)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            <Tarjeta theme={theme} titulo="Severidad promedio por zona" subtitulo="Escala 1-10 entre quienes reportan dolor" vacio={!X.zona.zonasSeveridad.length}>
              <div style={{ height: alto(X.zona.zonasSeveridad.length) }} className="w-full">
                <ResponsiveContainer>
                  <BarChart data={X.zona.zonasSeveridad} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis type="number" domain={[0, 10]} {...ejes} />
                    <YAxis type="category" dataKey="name" width={110} {...ejes} />
                    <Tooltip {...tip} />
                    <Bar dataKey="sevProm" name="Severidad prom." radius={[0, 4, 4, 0]} onClick={(d) => alternar('zona', d.payload.id)}>
                      {X.zona.zonasSeveridad.map((z) => (
                        <Cell key={z.id} fill={z.sevProm >= 7 ? '#ef4444' : z.sevProm >= 4 ? '#f97316' : '#facc15'} fillOpacity={op('zona', z.id)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            <Tarjeta theme={theme} titulo="Cargos con más casos" subtitulo="Personas con dolor o enfermedad por cargo" vacio={!X.cargo.cargos.length}>
              <div style={{ height: alto(X.cargo.cargos.length) }} className="w-full">
                <ResponsiveContainer>
                  <BarChart data={X.cargo.cargos} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis type="number" allowDecimals={false} {...ejes} />
                    <YAxis type="category" dataKey="name" width={130} {...ejes} />
                    <Tooltip {...tip} /><Legend />
                    <Bar dataKey="casos" name="Con casos" fill={C.rojo} radius={[0, 4, 4, 0]} onClick={(d) => alternar('cargo', d.payload.name)}>
                      {X.cargo.cargos.map((c) => <Cell key={c.name} fill={C.rojo} fillOpacity={op('cargo', c.name)} />)}
                    </Bar>
                    <Bar dataKey="personas" name="Encuestados" fill={C.azul} radius={[0, 4, 4, 0]} onClick={(d) => alternar('cargo', d.payload.name)}>
                      {X.cargo.cargos.map((c) => <Cell key={c.name} fill={C.azul} fillOpacity={op('cargo', c.name)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            {/* ---------------- Por sede ---------------- */}
            {sede === 'todas' && (
              <>
                <Tarjeta theme={theme} titulo="Encuestas por área" vacio={!X.area.sedeStats.length}>
                  <div style={{ height: alto(X.area.sedeStats.length) }} className="w-full">
                    <ResponsiveContainer>
                      <BarChart data={X.area.sedeStats} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                        <XAxis type="number" allowDecimals={false} {...ejes} />
                        <YAxis type="category" dataKey="sede" width={110} {...ejes} />
                        <Tooltip {...tip} />
                        <Bar dataKey="encuestas" name="Encuestas" fill={C.cian} radius={[0, 4, 4, 0]} onClick={(d) => alternar('area', d.payload.sede)}>
                          {X.area.sedeStats.map((e) => <Cell key={e.sede} fill={C.cian} fillOpacity={op('area', e.sede)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Tarjeta>

                <Tarjeta theme={theme} titulo="Indicadores por área (%)" subtitulo="% del personal de cada área" vacio={!X.area.sedeStats.length}>
                  <div className="h-64 w-full">
                    <ResponsiveContainer>
                      <BarChart data={X.area.sedeStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                        <XAxis dataKey="sede" {...ejes} /><YAxis unit="%" domain={[0, 100]} {...ejes} />
                        <Tooltip {...tip} formatter={(v) => `${v}%`} /><Legend />
                        <Bar dataKey="conDolor" name="Con dolor" fill={C.amarillo} radius={[4, 4, 0, 0]} onClick={(d) => alternar('area', d.payload.sede)}>
                          {X.area.sedeStats.map((e) => <Cell key={e.sede} fill={C.amarillo} fillOpacity={op('area', e.sede)} />)}
                        </Bar>
                        <Bar dataKey="conEnf" name="Con enfermedad" fill={C.naranja} radius={[4, 4, 0, 0]} onClick={(d) => alternar('area', d.payload.sede)}>
                          {X.area.sedeStats.map((e) => <Cell key={e.sede} fill={C.naranja} fillOpacity={op('area', e.sede)} />)}
                        </Bar>
                        <Bar dataKey="criticos" name="Críticos" fill={C.rojo} radius={[4, 4, 0, 0]} onClick={(d) => alternar('area', d.payload.sede)}>
                          {X.area.sedeStats.map((e) => <Cell key={e.sede} fill={C.rojo} fillOpacity={op('area', e.sede)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Tarjeta>

                <Tarjeta theme={theme} titulo="Severidad promedio por área" subtitulo="Escala 1-10" vacio={!X.area.sedeStats.some((s) => s.sevProm > 0)}>
                  <div className="h-64 w-full">
                    <ResponsiveContainer>
                      <BarChart data={X.area.sedeStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                        <XAxis dataKey="sede" {...ejes} /><YAxis domain={[0, 10]} {...ejes} />
                        <Tooltip {...tip} />
                        <Bar dataKey="sevProm" name="Severidad prom." fill={C.violeta} radius={[4, 4, 0, 0]} onClick={(d) => alternar('area', d.payload.sede)}>
                          {X.area.sedeStats.map((e) => <Cell key={e.sede} fill={C.violeta} fillOpacity={op('area', e.sede)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Tarjeta>
              </>
            )}

            {/* ---------------- Perfil del personal ---------------- */}
            <Tarjeta theme={theme} titulo="Dolor según antigüedad en la empresa" subtitulo="% de personas con dolor y casos críticos por rango" vacio={!X.antiguedad.porAntiguedad.length}>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={X.antiguedad.porAntiguedad}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis dataKey="rango" {...ejes} /><YAxis unit="%" domain={[0, 100]} {...ejes} />
                    <Tooltip {...tip} formatter={(v) => `${v}%`} /><Legend />
                    <Bar dataKey="conDolor" name="Con dolor" fill={C.amarillo} radius={[4, 4, 0, 0]} onClick={(d) => alternar('antiguedad', d.payload.rango)}>
                      {X.antiguedad.porAntiguedad.map((e) => <Cell key={e.rango} fill={C.amarillo} fillOpacity={op('antiguedad', e.rango)} />)}
                    </Bar>
                    <Bar dataKey="criticos" name="Críticos" fill={C.rojo} radius={[4, 4, 0, 0]} onClick={(d) => alternar('antiguedad', d.payload.rango)}>
                      {X.antiguedad.porAntiguedad.map((e) => <Cell key={e.rango} fill={C.rojo} fillOpacity={op('antiguedad', e.rango)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            <Tarjeta theme={theme} titulo="Dolor según rango de edad" subtitulo="% de personas con dolor y casos críticos por rango" vacio={!X.edad.porEdad.length}>
              <div className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={X.edad.porEdad}>
                    <CartesianGrid strokeDasharray="3 3" stroke={rejilla} />
                    <XAxis dataKey="rango" {...ejes} /><YAxis unit="%" domain={[0, 100]} {...ejes} />
                    <Tooltip {...tip} formatter={(v) => `${v}%`} /><Legend />
                    <Bar dataKey="conDolor" name="Con dolor" fill={C.amarillo} radius={[4, 4, 0, 0]} onClick={(d) => alternar('edad', d.payload.rango)}>
                      {X.edad.porEdad.map((e) => <Cell key={e.rango} fill={C.amarillo} fillOpacity={op('edad', e.rango)} />)}
                    </Bar>
                    <Bar dataKey="criticos" name="Críticos" fill={C.rojo} radius={[4, 4, 0, 0]} onClick={(d) => alternar('edad', d.payload.rango)}>
                      {X.edad.porEdad.map((e) => <Cell key={e.rango} fill={C.rojo} fillOpacity={op('edad', e.rango)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Tarjeta>

            {/* ---------------- Mapas de calor por sede ---------------- */}
            {sede === 'todas' && X.area.sedes.length > 1 && (
              <>
                <Tarjeta theme={theme} ancho titulo="Mapa de calor: zona corporal por área" vacio={!X.area.zonasFrecuencia.length}>
                  <MapaCalor filas={X.area.calorZonas} sedes={X.area.sedes} theme={theme} isDark={isDark} color="#06b6d4" />
                </Tarjeta>
                <Tarjeta theme={theme} ancho titulo="Mapa de calor: enfermedad por área" vacio={!X.area.enfCont.length}>
                  <MapaCalor filas={X.area.calorEnf} sedes={X.area.sedes} theme={theme} isDark={isDark} color="#f97316" />
                </Tarjeta>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
