import { enfermedadesList, zonasCuerpo } from './constants';

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const toDate = (v) => {
  if (!v) return null;
  const d = v.toDate ? v.toDate() : new Date(v);
  return isNaN(d) ? null : d;
};

const quitarTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const titulo = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
const sedeKey = (s) => quitarTildes(s).toLowerCase();

const aniosEntre = (desde, hasta) => {
  if (!desde || !hasta) return null;
  const a = (hasta - desde) / (365.25 * 24 * 3600 * 1000);
  return a >= 0 && a < 100 ? a : null;
};

/** Convierte los documentos crudos de Firestore en registros listos para analizar. */
export function normalizarRegistros(docs) {
  const sedesVistas = new Map(); // clave sin tildes/mayúsculas -> nombre a mostrar
  return docs.map((d) => {
    const creado = toDate(d.createdAt) || new Date();
    const sedeTxt = (d.sede || '').trim().replace(/\s+/g, ' ');
    let sede = 'Sin área';
    if (sedeTxt) {
      const k = sedeKey(sedeTxt);
      if (!sedesVistas.has(k)) sedesVistas.set(k, titulo(sedeTxt));
      sede = sedesVistas.get(k);
    }

    const enfermedades = [];
    enfermedadesList.forEach((_, i) => {
      if (d.enfermedades?.[i]?.padece === 'SI') enfermedades.push(i);
    });

    const zonas = []; // { id, sev }
    zonasCuerpo.forEach((z) => {
      const x = d.dolorZonas?.[z.paramId];
      if (x?.siente === 'si') zonas.push({ id: z.paramId, sev: parseInt(x.severidad || 1, 10) || 1 });
    });

    const maxSev = zonas.reduce((m, z) => Math.max(m, z.sev), 0);
    const nivel = maxSev >= 7 ? 'critico' : zonas.length || enfermedades.length ? 'sintomas' : 'sano';
    const semaforo = maxSev === 0 ? 'Sin dolor' : maxSev <= 3 ? 'Leve' : maxSev <= 6 ? 'Medio' : 'Alto';

    return {
      id: d.id,
      raw: d,
      nombre: d.nombre || '',
      cc: d.cc || '',
      cargo: (d.cargo || '').trim() ? titulo(d.cargo.trim().replace(/\s+/g, ' ')) : 'Sin cargo',
      sede,
      fecha: creado,
      anio: creado.getFullYear(),
      mes: creado.getMonth(),
      enfermedades,
      zonas,
      maxSev,
      nivel,
      semaforo,
      edad: aniosEntre(toDate(d.fechaNacimiento), creado),
      antiguedad: aniosEntre(toDate(d.fechaIngreso), creado),
    };
  });
}

const contar = (arr, fn) => {
  const m = new Map();
  arr.forEach((x) => {
    const k = fn(x);
    m.set(k, (m.get(k) || 0) + 1);
  });
  return m;
};
const pct = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);
const prom = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
const r1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

const RANGOS_ANT = [
  { n: '< 1 año', f: (a) => a < 1 },
  { n: '1 - 3 años', f: (a) => a >= 1 && a < 3 },
  { n: '3 - 5 años', f: (a) => a >= 3 && a < 5 },
  { n: '5 - 10 años', f: (a) => a >= 5 && a < 10 },
  { n: '10+ años', f: (a) => a >= 10 },
];
const RANGOS_EDAD = [
  { n: '< 25', f: (a) => a < 25 },
  { n: '25 - 34', f: (a) => a >= 25 && a < 35 },
  { n: '35 - 44', f: (a) => a >= 35 && a < 45 },
  { n: '45 - 54', f: (a) => a >= 45 && a < 55 },
  { n: '55+', f: (a) => a >= 55 },
];

const porRango = (regs, rangos, campo) =>
  rangos
    .map(({ n, f }) => {
      const g = regs.filter((r) => r[campo] != null && f(r[campo]));
      const conDolor = g.filter((r) => r.zonas.length).length;
      const criticos = g.filter((r) => r.nivel === 'critico').length;
      return { rango: n, personas: g.length, conDolor: pct(conDolor, g.length), criticos: pct(criticos, g.length) };
    })
    .filter((x) => x.personas > 0);

/**
 * Filtro cruzado entre gráficos (estilo Power BI).
 * cf = { estado, semaforo, enfermedad, zona, cargo, area, mes, antiguedad, edad } (null = sin selección).
 * `omitir` deja fuera la dimensión de un gráfico para que ese gráfico siga mostrando todas sus categorías
 * (con la seleccionada resaltada) mientras los demás sí se filtran.
 */
export function aplicarCruzado(regs, cf, omitir) {
  const act = (k) => omitir !== k && cf[k] != null;
  const rango = (lista, nombre) => lista.find((x) => x.n === nombre);
  return regs.filter((r) =>
    (!act('estado') || r.nivel === cf.estado) &&
    (!act('semaforo') || r.semaforo === cf.semaforo) &&
    (!act('enfermedad') || r.enfermedades.includes(cf.enfermedad)) &&
    (!act('zona') || r.zonas.some((z) => z.id === cf.zona)) &&
    (!act('cargo') || r.cargo === cf.cargo) &&
    (!act('area') || r.sede === cf.area) &&
    (!act('mes') || (cf.mes < 12 ? r.mes === cf.mes : r.anio * 12 + r.mes === cf.mes)) &&
    (!act('antiguedad') || (r.antiguedad != null && !!rango(RANGOS_ANT, cf.antiguedad)?.f(r.antiguedad))) &&
    (!act('edad') || (r.edad != null && !!rango(RANGOS_EDAD, cf.edad)?.f(r.edad)))
  );
}

/** Calcula todos los KPI y series para los gráficos a partir de los registros filtrados. */
export function calcular(regs, { anioSel, todosSede }) {
  const total = regs.length;
  const sanos = regs.filter((r) => r.nivel === 'sano').length;
  const conSintomas = regs.filter((r) => r.nivel === 'sintomas').length;
  const criticos = regs.filter((r) => r.nivel === 'critico').length;
  const conDolor = regs.filter((r) => r.zonas.length).length;
  const conEnf = regs.filter((r) => r.enfermedades.length).length;

  // ---- Enfermedades y zonas
  const enfCont = enfermedadesList
    .map((name, i) => ({ name, casos: regs.filter((r) => r.enfermedades.includes(i)).length }))
    .filter((x) => x.casos > 0)
    .sort((a, b) => b.casos - a.casos);

  const zonaStats = zonasCuerpo.map((z) => {
    const sevs = regs.flatMap((r) => r.zonas.filter((x) => x.id === z.paramId).map((x) => x.sev));
    return { id: z.paramId, name: z.corto, casos: sevs.length, sevProm: r1(prom(sevs)) || 0, pct: pct(sevs.length, total) };
  });
  const zonasConCasos = zonaStats.filter((z) => z.casos > 0);
  const zonasFrecuencia = [...zonasConCasos].sort((a, b) => b.casos - a.casos);
  const zonasSeveridad = [...zonasConCasos].sort((a, b) => b.sevProm - a.sevProm);

  // ---- Semáforo de severidad
  const semOrden = ['Sin dolor', 'Leve', 'Medio', 'Alto'];
  const semMap = contar(regs, (r) => r.semaforo);
  const semaforo = semOrden.map((name) => ({ name, value: semMap.get(name) || 0 })).filter((x) => x.value > 0);

  const estado = [
    { name: 'Personal sano', value: sanos },
    { name: 'Con síntomas / enfermedad', value: conSintomas },
    { name: 'Casos críticos', value: criticos },
  ].filter((x) => x.value > 0);

  // ---- Por sede
  const sedes = [...new Set(regs.map((r) => r.sede))].sort();
  const sedeStats = sedes
    .map((s) => {
      const g = regs.filter((r) => r.sede === s);
      const sevs = g.flatMap((r) => r.zonas.map((z) => z.sev));
      return {
        sede: s,
        encuestas: g.length,
        conDolor: pct(g.filter((r) => r.zonas.length).length, g.length),
        conEnf: pct(g.filter((r) => r.enfermedades.length).length, g.length),
        criticos: pct(g.filter((r) => r.nivel === 'critico').length, g.length),
        criticosN: g.filter((r) => r.nivel === 'critico').length,
        sevProm: r1(prom(sevs)) || 0,
      };
    })
    .sort((a, b) => b.encuestas - a.encuestas);

  // ---- Evolución temporal
  let mensual;
  if (anioSel !== 'todos') {
    mensual = MESES.map((mes, i) => {
      const g = regs.filter((r) => r.mes === i);
      return {
        mes, key: i, encuestas: g.length,
        sintomas: g.filter((r) => r.nivel === 'sintomas').length,
        criticos: g.filter((r) => r.nivel === 'critico').length,
      };
    });
  } else {
    const keys = [...new Set(regs.map((r) => r.anio * 12 + r.mes))].sort((a, b) => a - b);
    mensual = keys.map((k) => {
      const g = regs.filter((r) => r.anio * 12 + r.mes === k);
      return {
        mes: `${MESES[k % 12]} ${String(Math.floor(k / 12)).slice(2)}`, key: k, encuestas: g.length,
        sintomas: g.filter((r) => r.nivel === 'sintomas').length,
        criticos: g.filter((r) => r.nivel === 'critico').length,
      };
    });
  }

  // ---- Por año (para estas series se usa el conjunto sin filtro de año; lo calcula el llamador)
  // ---- Cargos
  const cargos = [...contar(regs, (r) => r.cargo)]
    .map(([name, personas]) => {
      const g = regs.filter((r) => r.cargo === name);
      return { name, personas, casos: g.filter((r) => r.nivel !== 'sano').length };
    })
    .filter((c) => c.casos > 0)
    .sort((a, b) => b.casos - a.casos)
    .slice(0, 8);

  // ---- Mapas de calor sede x zona / sede x enfermedad
  const calorZonas = zonasCuerpo.map((z) => ({
    nombre: z.corto,
    celdas: sedes.map((s) => {
      const g = regs.filter((r) => r.sede === s);
      const n = g.filter((r) => r.zonas.some((x) => x.id === z.paramId)).length;
      return { n, p: pct(n, g.length) };
    }),
  }));
  const calorEnf = enfermedadesList.map((e, i) => ({
    nombre: e,
    celdas: sedes.map((s) => {
      const g = regs.filter((r) => r.sede === s);
      const n = g.filter((r) => r.enfermedades.includes(i)).length;
      return { n, p: pct(n, g.length) };
    }),
  }));

  // ---- KPI
  const hoy = new Date();
  const mesActual = regs.filter((r) => r.anio === hoy.getFullYear() && r.mes === hoy.getMonth()).length;
  const ant = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mesAnterior = regs.filter((r) => r.anio === ant.getFullYear() && r.mes === ant.getMonth()).length;
  const todasSev = regs.flatMap((r) => r.zonas.map((z) => z.sev));
  const zonasPorPersona = prom(regs.filter((r) => r.zonas.length).map((r) => r.zonas.length));
  const sedeTop = [...sedeStats].filter((s) => s.encuestas > 0).sort((a, b) => b.conDolor - a.conDolor)[0];

  const kpi = {
    total,
    mesActual,
    mesAnterior,
    sanos, pctSanos: pct(sanos, total),
    conDolor, pctDolor: pct(conDolor, total),
    criticos, pctCriticos: pct(criticos, total),
    conEnf, pctEnf: pct(conEnf, total),
    sevProm: r1(prom(todasSev)),
    zonasPorPersona: r1(zonasPorPersona),
    zonaTop: zonasFrecuencia[0] || null,
    enfTop: enfCont[0] || null,
    sedeTop: !todosSede || sedes.length < 2 ? null : sedeTop || null,
    antiguedadProm: r1(prom(regs.map((r) => r.antiguedad).filter((x) => x != null))),
    edadProm: r1(prom(regs.map((r) => r.edad).filter((x) => x != null))),
  };

  return {
    kpi, enfCont, estado, semaforo, zonasFrecuencia, zonasSeveridad, sedes, sedeStats, mensual, cargos,
    calorZonas, calorEnf,
    porAntiguedad: porRango(regs, RANGOS_ANT, 'antiguedad'),
    porEdad: porRango(regs, RANGOS_EDAD, 'edad'),
  };
}

/** Encuestas por año, desglosadas por sede (para barras apiladas). */
export function porAnio(regs) {
  const anios = [...new Set(regs.map((r) => r.anio))].sort();
  const sedes = [...new Set(regs.map((r) => r.sede))].sort();
  const filas = anios.map((a) => {
    const g = regs.filter((r) => r.anio === a);
    const fila = {
      anio: String(a),
      total: g.length,
      pctDolor: pct(g.filter((r) => r.zonas.length).length, g.length),
      pctCriticos: pct(g.filter((r) => r.nivel === 'critico').length, g.length),
      pctEnf: pct(g.filter((r) => r.enfermedades.length).length, g.length),
    };
    sedes.forEach((s) => { fila[s] = g.filter((r) => r.sede === s).length; });
    return fila;
  });
  return { filas, sedes, anios };
}

/** Exporta los registros filtrados a CSV (abre directo en Excel). */
export function exportarCSV(regs) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = [
    'Fecha registro', 'Nombre', 'CC', 'Fecha nacimiento', 'Fecha ingreso', 'Cargo', 'Área',
    ...enfermedadesList,
    ...zonasCuerpo.map((z) => `Dolor: ${z.corto} (severidad)`),
    'Severidad máxima', 'Nivel',
  ];
  const filas = regs.map((r) => {
    const d = r.raw;
    return [
      r.fecha.toISOString().slice(0, 10), r.nombre, r.cc, d.fechaNacimiento, d.fechaIngreso, d.cargo, r.sede,
      ...enfermedadesList.map((_, i) => (r.enfermedades.includes(i) ? 'SI' : 'NO')),
      ...zonasCuerpo.map((z) => r.zonas.find((x) => x.id === z.paramId)?.sev ?? 0),
      r.maxSev, r.nivel === 'critico' ? 'Crítico' : r.nivel === 'sintomas' ? 'Con síntomas' : 'Sano',
    ];
  });
  const csv = 'sep=;\n' + [cab, ...filas].map((f) => f.map(esc).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `encuestas_sintomatologia_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
