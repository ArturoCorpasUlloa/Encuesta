# App de Salud Ocupacional (SG-SST)

Encuesta de sintomatología + panel de administración. Base de datos: **Google Sheets** (a través de Google Apps Script).
El navegador solo habla con el servidor interno (`server.js`); el token de Google nunca llega al navegador.

```
Navegador  ──►  server.js (Node)  ──►  Apps Script (Code.gs)  ──►  Google Sheet "DatosEncuesta"
             /api, guarda el TOKEN       valida PIN y reglas        Usuarios · Encuestas · Configuracion
```

## 1. Google Sheet + Apps Script (una sola vez)
1. En el Sheet: **Extensiones > Apps Script**, pegar `apps-script/Code.gs` y cambiar `TOKEN` por un texto largo y secreto.
2. Ejecutar la función `setup` (crea las pestañas, carga los 50 usuarios y deja el PIN inicial `1234` cifrado).
3. **Implementar > Nueva implementación > Aplicación web** — Ejecutar como: *Yo*; Acceso: *Cualquier persona*. Copiar la URL `/exec`.
4. Si luego cambias `Code.gs`: **Implementar > Administrar implementaciones > Editar (lápiz) > Versión: Nueva versión**. La URL no cambia.

## 2. Servidor interno
```bash
cp .env.example .env     # completar APPS_SCRIPT_URL y APPS_SCRIPT_TOKEN (el mismo TOKEN de Code.gs)
npm install
npm run build
npm start                # http://localhost:3001
```
Para dejarlo siempre encendido: `npm i -g pm2 && pm2 start server.js --name encuesta && pm2 save`.
Se recomienda publicarlo detrás de HTTPS (proxy inverso de la empresa).

Desarrollo: `npm run api` en una terminal y `npm run dev` en otra.

## 3. Qué incluye
- **Encuesta:** el usuario escribe parte de su apellido o nombre y lo escoge de la lista (no hay texto libre). Si ya respondió en el período, se le informa la fecha y no puede continuar. La regla se valida otra vez en el servidor.
- **Admin (con PIN):** Gráficos · Usuarios (crear, editar, activar/desactivar) · Informe de usuarios (pendientes y realizadas, Excel con ✔️/✖️ y fecha) · Configuración (frecuencia, ventana de días y cambio de PIN).
- **Gráficos:** filtros por año, área, enfermedad y rango de fechas; botón *Imprimir / PDF* que deja solo KPI y gráficos.
- Después de 8 PIN incorrectos desde una misma IP, el servidor bloquea los intentos durante 10 minutos.

## Estructura del Sheet
- **Usuarios:** ID, Nombre, Area, Activo (SI/NO). El ID nuevo es el último + 1.
- **Encuestas:** una fila por encuesta; una columna por enfermedad (SI/NO) y por zona corporal (0 = sin dolor, 1–10 = severidad), más Severidad_Max y Nivel.
- **Configuracion:** frecuencia_modo (MES_CALENDARIO | DIAS_MINIMOS), dias_minimos, ventana_dia_inicio, ventana_dia_fin, pin_hash.

No se borran usuarios: se desactivan, para conservar el historial de sus encuestas.

## 4. Despliegue en Netlify
- `netlify.toml` define el build (`npm run build` → `dist`) y redirige `/api` a la función `netlify/functions/api.js`, que reemplaza a `server.js` (este último queda solo para uso local o servidor propio).
- Variables de entorno en Netlify (*Site configuration → Environment variables*): `APPS_SCRIPT_URL` y `APPS_SCRIPT_TOKEN`.
- Pasos: subir a GitHub → *Import from Git* en Netlify → agregar las variables → desplegar.
- Probar en local con la función: `npx netlify dev`.
- Antes de publicar: cambiar el PIN inicial `1234` desde Configuración.
