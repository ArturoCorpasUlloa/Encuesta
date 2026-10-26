import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Lista desplegable con búsqueda: el usuario escribe parte del apellido o nombre
 * (en cualquier orden) y escoge de la lista. No permite texto libre.
 */
export default function Combobox({ items, selected, onSelect, loading, theme, placeholder = 'Escribe tu apellido o nombre…' }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const caja = useRef(null);

  const filtrados = useMemo(() => {
    const palabras = norm(texto).split(/\s+/).filter(Boolean);
    return items.filter((u) => palabras.every((p) => norm(u.nombre).includes(p)));
  }, [items, texto]);

  useEffect(() => {
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);
  useEffect(() => { setActivo(0); }, [texto]);
  useEffect(() => { if (!selected) setTexto(''); }, [selected]);

  const elegir = (u) => { onSelect(u); setTexto(u.nombre); setAbierto(false); };

  const teclas = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(a + 1, filtrados.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && abierto && filtrados[activo]) { e.preventDefault(); elegir(filtrados[activo]); }
    else if (e.key === 'Escape') setAbierto(false);
  };

  return (
    <div ref={caja} className="relative">
      <input
        id="usuario-combobox"
        role="combobox"
        aria-expanded={abierto}
        aria-controls="usuario-lista"
        autoComplete="off"
        value={texto}
        placeholder={loading ? 'Cargando usuarios…' : placeholder}
        disabled={loading}
        onFocus={() => setAbierto(true)}
        onKeyDown={teclas}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); if (selected) onSelect(null); }}
        className={`w-full ${theme.inputBg} rounded p-3 pr-10 focus:ring-2 focus:ring-cyan-500 outline-none border transition-colors disabled:opacity-60`}
      />
      <span className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${theme.textMuted}`}>
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ChevronDown className="w-5 h-5" />}
      </span>
      {abierto && !loading && (
        <ul
          id="usuario-lista"
          role="listbox"
          className={`absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-lg border shadow-2xl ${theme.cardBg} ${theme.border}`}
        >
          {filtrados.length === 0 && <li className={`px-3 py-3 text-sm ${theme.textMuted}`}>Sin coincidencias. Prueba con otra parte del nombre.</li>}
          {filtrados.map((u, i) => (
            <li
              key={u.id}
              role="option"
              aria-selected={selected?.id === u.id}
              onMouseDown={(e) => { e.preventDefault(); elegir(u); }}
              onMouseEnter={() => setActivo(i)}
              className={`px-3 py-2 cursor-pointer text-sm flex justify-between gap-3 ${i === activo ? 'bg-cyan-500/20' : ''} ${theme.text}`}
            >
              <span>{u.nombre}</span>
              <span className={`${theme.textMuted} text-xs whitespace-nowrap self-center`}>{u.area}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
