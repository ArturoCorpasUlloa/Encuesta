import React, { useState } from 'react';
import { BarChart3, Users, ClipboardList, Settings, LogOut } from 'lucide-react';
import Dashboard from './Dashboard';
import Usuarios from './Usuarios';
import Informe from './Informe';
import Configuracion from './Configuracion';

const TABS = [
  { id: 'graficos', nombre: 'Gráficos', Icon: BarChart3 },
  { id: 'usuarios', nombre: 'Usuarios', Icon: Users },
  { id: 'informe', nombre: 'Informe de usuarios', Icon: ClipboardList },
  { id: 'config', nombre: 'Configuración', Icon: Settings },
];

export default function Admin({ theme, isDark, pin, onImprimir, onPinCambiado, onSalir }) {
  const [tab, setTab] = useState('graficos');
  const props = { theme, isDark, pin };
  return (
    <div>
      <div className={`no-print ${theme.cardBg} border-b ${theme.border}`}>
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center gap-1">
          {TABS.map(({ id, nombre, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id}
              className={`flex items-center gap-2 px-4 py-3 font-semibold border-b-2 transition-colors ${tab === id ? 'border-orange-500 text-orange-500' : `border-transparent ${theme.textMuted} hover:text-cyan-500`}`}
            >
              <Icon className="w-4 h-4" /> {nombre}
            </button>
          ))}
          <button onClick={onSalir} className={`ml-auto flex items-center gap-2 px-3 py-2 text-sm ${theme.textMuted} hover:text-red-500`}>
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      </div>
      {tab === 'graficos' && <Dashboard {...props} onImprimir={onImprimir} />}
      {tab === 'usuarios' && <Usuarios {...props} />}
      {tab === 'informe' && <Informe {...props} />}
      {tab === 'config' && <Configuracion {...props} onPinCambiado={onPinCambiado} />}
    </div>
  );
}
