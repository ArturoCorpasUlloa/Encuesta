import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { api } from './api';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Informe({ theme, pin }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [areaF, setAreaF] = useState('todas');
  const [estadoF, setEstadoF] = useState('pendientes');
  const [busca, setBusca] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setDatos((await api('pendientes', { pin, anio, mes })).usuarios); }
    catch (e) { setError(e.message); setDatos([]); }
    finally { setCargando(false); }
  }, [pin, anio, mes]);
  useEffect(() => { cargar(); }, [cargar]);

  const areas = useMemo(() => [...new Set(datos.map((u) => u.area))].sort(), [datos]);
  const base = useMemo(() => datos.filter((u) => areaF === 'todas' || u.area === areaF), [datos, areaF]);
  const visibles = useMemo(() => base.filter((u) =>
    (estadoF === 'todos' || (estadoF === 'realizadas') === u.realizada) &&
    (!busca || busca.split(/\s+/).every((p) => norm(u.nombre).includes(norm(p))))
  ), [base, estadoF, busca]);
  const hechas = base.filter((u) => u.realizada).length;
  const pct = base.length ? Math.round((hechas / base.length) * 100) : 0;

  const descargar = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [['ID', 'Nombre', 'Área', `Encuesta ${MESES[mes - 1]} ${anio}`, 'Fecha de realización'],
      ...visibles.map((u) => [u.id, u.nombre, u.area, u.realizada ? '✔️' : '✖️', u.fecha])];
    const csv = 'sep=;\n' + filas.map((f) => f.map(esc).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `informe_usuarios_${anio}-${String(mes).padStart(2, '0')}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const inp = `${theme.inputBg} border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500`;
  const tile = (t, v, c) => (
    <div className={`${theme.cardBg} border ${theme.border} rounded-xl p-5`}>
      <p className={`${theme.textMuted} text-sm font-semibold`}>{t}</p><p className={`text-3xl font-bold ${c}`}>{v}</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 mt-4">
      <div className={`${theme.cardBg} border ${theme.border} rounded-xl p-6 flex flex-wrap items-end gap-4`}>
        <h2 className={`text-lg font-bold ${theme.text} mr-auto`}>Informe de encuestas por usuario</h2>
        <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Mes
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className={inp}>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
        </label>
        <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={inp}>
            {[0, 1, 2, 3].map((d) => hoy.getFullYear() - d).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Área
          <select value={areaF} onChange={(e) => setAreaF(e.target.value)} className={inp}>
            <option value="todas">Todas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className={`text-sm ${theme.textMuted} flex flex-col gap-1`}>Mostrar
          <select value={estadoF} onChange={(e) => setEstadoF(e.target.value)} className={inp}>
            <option value="pendientes">Pendientes</option><option value="realizadas">Realizadas</option><option value="todos">Todos</option>
          </select>
        </label>
        <button onClick={cargar} className={`${theme.inputBg} border px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-semibold`}><RefreshCw className="w-4 h-4" /> Actualizar</button>
        <button onClick={descargar} disabled={!visibles.length} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2">
          <Download className="w-4 h-4" /> Descargar Excel
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg p-3 text-sm font-semibold border border-red-500 text-red-500 bg-red-500/10">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tile('Usuarios activos', base.length, 'text-cyan-500')}
        {tile('Realizaron la encuesta', hechas, 'text-emerald-500')}
        {tile('Pendientes', base.length - hechas, 'text-red-500')}
        {tile('Cumplimiento', `${pct}%`, 'text-orange-500')}
      </div>

      <div className={`${theme.cardBg} border ${theme.border} rounded-xl p-6`}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nombre…" aria-label="Buscar usuario" className={`${inp} mb-4 w-full max-w-xs`} />
        {cargando ? (
          <div className={`py-10 text-center ${theme.textMuted}`}><Loader2 className="w-6 h-6 animate-spin inline mr-2" />Cargando…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[560px]">
              <thead className={`${theme.textMuted} border-b ${theme.border}`}><tr><th className="py-2 w-16">ID</th><th>Nombre</th><th>Área</th><th className="w-24 text-center">Encuesta</th><th>Fecha</th></tr></thead>
              <tbody className={`divide-y ${theme.tableBorder} ${theme.text}`}>
                {visibles.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2">{u.id}</td><td>{u.nombre}</td><td>{u.area}</td>
                    <td className="text-center text-lg" aria-label={u.realizada ? 'Realizada' : 'Pendiente'}>{u.realizada ? '✔️' : '✖️'}</td>
                    <td>{u.fecha ? u.fecha.slice(0, 10) : '—'}</td>
                  </tr>
                ))}
                {!visibles.length && <tr><td colSpan="5" className={`py-8 text-center ${theme.textMuted}`}>{estadoF === 'pendientes' ? 'Todos los usuarios ya realizaron la encuesta.' : 'Sin registros.'}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
