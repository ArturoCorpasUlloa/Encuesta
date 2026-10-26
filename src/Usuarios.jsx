import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Check, X, UserX, UserCheck, Loader2, Search } from 'lucide-react';
import { api } from './api';

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function Usuarios({ theme, pin }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [msg, setMsg] = useState(null); // { ok, texto }
  const [busca, setBusca] = useState('');
  const [areaF, setAreaF] = useState('todas');
  const [estadoF, setEstadoF] = useState('todos');
  const [nuevo, setNuevo] = useState({ nombre: '', area: '' });
  const [editando, setEditando] = useState(null); // { id, nombre, area }
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setLista((await api('listarTodosUsuarios', { pin })).usuarios); }
    catch (e) { setMsg({ ok: false, texto: e.message }); }
    finally { setCargando(false); }
  }, [pin]);
  useEffect(() => { cargar(); }, [cargar]);

  const areas = useMemo(() => [...new Set(lista.map((u) => u.area))].sort(), [lista]);
  const proximoId = useMemo(() => lista.reduce((m, u) => Math.max(m, u.id), 0) + 1, [lista]);
  const visibles = useMemo(() => lista.filter((u) =>
    (areaF === 'todas' || u.area === areaF) &&
    (estadoF === 'todos' || (estadoF === 'activos') === u.activo) &&
    (!busca || busca.split(/\s+/).every((p) => norm(u.nombre).includes(norm(p))))
  ), [lista, areaF, estadoF, busca]);

  const ejecutar = async (accion, datos, okTexto) => {
    setOcupado(true); setMsg(null);
    try { await api(accion, { pin, ...datos }); setMsg({ ok: true, texto: okTexto }); await cargar(); return true; }
    catch (e) { setMsg({ ok: false, texto: e.message }); return false; }
    finally { setOcupado(false); }
  };

  const crear = async (e) => {
    e.preventDefault();
    if (await ejecutar('crearUsuario', nuevo, `Usuario creado con ID ${proximoId}.`)) setNuevo({ nombre: '', area: '' });
  };
  const guardarEdicion = async () => {
    if (await ejecutar('editarUsuario', editando, 'Usuario actualizado.')) setEditando(null);
  };
  const cambiarActivo = (u) => {
    if (u.activo && !window.confirm(`¿Desactivar a ${u.nombre}? Ya no aparecerá en la lista de la encuesta, pero conserva su historial.`)) return;
    ejecutar('cambiarActivo', { id: u.id, activo: !u.activo }, u.activo ? 'Usuario desactivado.' : 'Usuario activado.');
  };

  const inp = `${theme.inputBg} border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500`;
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6 mt-4">
      <form onSubmit={crear} className={`${theme.cardBg} border ${theme.border} rounded-xl p-6 flex flex-wrap items-end gap-4`}>
        <div className="w-full">
          <h2 className={`text-lg font-bold ${theme.text}`}>Crear usuario</h2>
          <p className={`${theme.textMuted} text-xs`}>El ID se asigna solo: el último ID + 1 (próximo: {proximoId}).</p>
        </div>
        <label className={`text-sm ${theme.textMuted} flex flex-col gap-1 flex-1 min-w-[240px]`}>Nombre completo
          <input required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="APELLIDOS NOMBRES" className={inp} />
        </label>
        <label className={`text-sm ${theme.textMuted} flex flex-col gap-1 min-w-[200px]`}>Área
          <input required list="areas-existentes" value={nuevo.area} onChange={(e) => setNuevo({ ...nuevo, area: e.target.value })} placeholder="Selecciona o escribe" className={inp} />
          <datalist id="areas-existentes">{areas.map((a) => <option key={a} value={a} />)}</datalist>
        </label>
        <button disabled={ocupado} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2">
          {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregar
        </button>
      </form>

      {msg && <div role="status" className={`rounded-lg p-3 text-sm font-semibold border ${msg.ok ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10' : 'border-red-500 text-red-500 bg-red-500/10'}`}>{msg.texto}</div>}

      <div className={`${theme.cardBg} border ${theme.border} rounded-xl p-6`}>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <h2 className={`text-lg font-bold ${theme.text} mr-auto`}>Usuarios ({visibles.length} de {lista.length})</h2>
          <label className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nombre…" aria-label="Buscar usuario" className={`${inp} pl-9`} />
          </label>
          <select value={areaF} onChange={(e) => setAreaF(e.target.value)} aria-label="Filtrar por área" className={inp}>
            <option value="todas">Todas las áreas</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={estadoF} onChange={(e) => setEstadoF(e.target.value)} aria-label="Filtrar por estado" className={inp}>
            <option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option>
          </select>
        </div>

        {cargando ? (
          <div className={`py-10 text-center ${theme.textMuted}`}><Loader2 className="w-6 h-6 animate-spin inline mr-2" />Cargando usuarios…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[640px]">
              <thead className={`${theme.textMuted} border-b ${theme.border}`}>
                <tr><th className="py-2 w-16">ID</th><th>Nombre</th><th>Área</th><th className="w-28">Estado</th><th className="w-40 text-right">Acciones</th></tr>
              </thead>
              <tbody className={`divide-y ${theme.tableBorder} ${theme.text}`}>
                {visibles.map((u) => {
                  const ed = editando?.id === u.id;
                  return (
                    <tr key={u.id} className={u.activo ? '' : 'opacity-60'}>
                      <td className="py-2">{u.id}</td>
                      <td>{ed ? <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} aria-label="Nombre" className={`${inp} w-full`} /> : u.nombre}</td>
                      <td>{ed ? <input list="areas-existentes" value={editando.area} onChange={(e) => setEditando({ ...editando, area: e.target.value })} aria-label="Área" className={inp} /> : u.area}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.activo ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/20 text-slate-400'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                      <td className="text-right whitespace-nowrap">
                        {ed ? (
                          <>
                            <button onClick={guardarEdicion} disabled={ocupado} title="Guardar" className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditando(null)} title="Cancelar" className="p-2 text-slate-400 hover:bg-slate-500/10 rounded"><X className="w-4 h-4" /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditando({ id: u.id, nombre: u.nombre, area: u.area })} title="Editar" className="p-2 text-cyan-500 hover:bg-cyan-500/10 rounded"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => cambiarActivo(u)} title={u.activo ? 'Desactivar' : 'Activar'} className={`p-2 rounded ${u.activo ? 'text-red-400 hover:bg-red-500/10' : 'text-emerald-500 hover:bg-emerald-500/10'}`}>
                              {u.activo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!visibles.length && <tr><td colSpan="5" className={`py-8 text-center ${theme.textMuted}`}>Sin usuarios para el filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
