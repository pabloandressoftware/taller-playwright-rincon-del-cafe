# Taller Playwright · HU-08 Favoritos (El Rincón del Café)

## Bug encontrado
**Al quitar un favorito, la app borra el primero de la lista en vez del seleccionado.**

- Pasos: agregar A, B y C → pulsar "Quitar" en B.
- Esperado: quedan A y C.
- Obtenido: se borra A y quedan B y C.
- Criterio incumplido: "Al quitar un favorito, desaparece ese favorito y los demás se mantienen".
- Detectado por: `CP-01` (también falla `CP-03`; `CP-02` y `CP-04` pasan por casualidad, porque ahí el elemento quitado sí es el primero).

Los otros criterios (máximo 20 y prioridad) funcionan bien.

## Casos de prueba (`tests/hu08-favoritos.spec.js`)
| Caso | Criterio | Qué verifica |
|---|---|---|
| CP-01 | Quitar | Quitar el del medio conserva los demás (**detecta el bug**) |
| CP-02 | Quitar | Quitar el primero conserva los demás |
| CP-03 | Quitar | Quitar el último conserva los demás |
| CP-04 | Quitar | Quitar el único deja la lista vacía |
| CP-05 | Máximo | Se puede agregar el favorito 20 |
| CP-06 | Máximo | El 21 se rechaza con "Máximo 20 favoritos" |
| CP-07 | Máximo | Con 20, quitar uno permite agregar otro |
| CP-08 | Prioridad | Se acepta alta, media y baja |
| CP-09 | Prioridad | Un valor distinto se rechaza (por API, la interfaz solo ofrece 3) |

## Estructura
- `app/`: la aplicación de la cafetería.
- `tests/fixtures/login.js`: reinicia los datos e inicia sesión antes de cada prueba.
- `tests/pages/LoginPage.js` y `FavoritosPage.js`: page objects (localizadores y acciones de cada pantalla).
- `tests/data/usuarios.js`: datos de prueba (credenciales).
- `tests/hu08-favoritos.spec.js`: los casos.

## Cómo correr
```bash
npm install
npm install --prefix app
npx playwright install chromium
npx playwright test          # levanta la app solo en el puerto 3000
npx playwright show-report   # reporte con trace
```
Contra otra URL (por ejemplo Render): `BASE_URL=https://mi-app.onrender.com npx playwright test`.

## Despliegue en Render
App desplegada: https://el-rincon-del-cafe-ksuv.onrender.com (plan Free: la primera visita tras inactividad tarda ~1 min).

El archivo `render.yaml` describe el servicio (carpeta `app`, build `npm install`, start `npm start`).
Para probar la versión desplegada: `BASE_URL=https://<tu-servicio>.onrender.com npx playwright test`.
