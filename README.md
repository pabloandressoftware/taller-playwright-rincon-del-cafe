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

## Estructura (monorepo)
```
app/                       la aplicación de la cafetería
pruebas/
  package.json             "type": "module"; scripts test y test:aceptacion
  playwright.config.js     incluye webServer (enciende la app antes de probar)
  fixtures/login.js        reinicia datos e inicia sesión
  pages/                   LoginPage.js y FavoritosPage.js (page objects)
  data/usuarios.js         datos de prueba
  tests/hu08-favoritos.spec.js
.github/workflows/pipeline.yml
render.yaml
```

## Cómo correr
```bash
cd app && npm install && cd ..
cd pruebas && npm ci && npx playwright install --with-deps chromium
npm test                       # los 11 casos (levanta la app solo)
npm run test:aceptacion        # solo @acceptanceTest (lo que corre el pipeline)
npx playwright show-report
```
Contra otra URL: `BASE_URL=https://el-rincon-del-cafe-ksuv.onrender.com npx playwright test`.

## Pipeline (`.github/workflows/pipeline.yml`)
- **Cuándo corre:** push o pull request a `main`/`develop`, y a mano (`workflow_dispatch`).
- **Job `pruebas-aceptacion`:** checkout, Node 22 con caché de npm, `npm ci` en `app/` y `pruebas/`, instala Chromium y ejecuta `npx playwright test --grep @acceptanceTest`. Siempre sube el reporte como artifact. No usa `continue-on-error`, así que si una prueba falla el job queda en rojo.
- **Job `desplegar-produccion`:** `needs: pruebas-aceptacion` y `if` push a `main`. Si las pruebas fallan se omite. **Es simulado** (solo un `echo`): este ejercicio no llega a Render. Con un despliegue real iría `curl -X POST "$RENDER_DEPLOY_HOOK"` con el secreto `RENDER_DEPLOY_HOOK` y el auto-deploy de Render desactivado.
- **`@acceptanceTest`:** lo llevan 9 casos. **CP-01 y CP-03 no lo llevan a propósito**, porque exponen el bug y harían fallar el pipeline. Se corren a mano con `npm test`.

### Qué se reutiliza del ci.yml de Karate
| Parte | ¿Reutilizable? | Qué falta o cambia |
|---|---|---|
| `on:` | Sí | Cambiar el input `testTag` por `grep`. |
| `permissions` | Parcial | Basta `contents: read`; no hay Issues que etiquetar. |
| Checkout y setup | Parcial | Se cambia Java por `setup-node`, y se instala Chromium. |
| Caché | Parcial | Se cachea npm (`package-lock.json`) en vez de Gradle. |
| Ejecutar pruebas (paso 8) | Parcial | `npx playwright test --grep` en vez de Gradle; sin `continue-on-error`. |
| Reportes | Sí | Se sube `playwright-report` en vez de `karate-reports`. |
| Actualizar Issue (curl) | No | No lo pide el taller de Playwright. |
| Paso final (`exit 1`) | No | Sobra: al fallar la prueba, el job ya queda en rojo. Lo que decide el despliegue es `needs` + `if`. |

## Despliegue en Render
App desplegada: https://el-rincon-del-cafe-ksuv.onrender.com (plan Free: la primera visita tras inactividad tarda ~1 min).

El archivo `render.yaml` describe el servicio (carpeta `app`, build `npm install`, start `npm start`).
Para probar la versión desplegada: `BASE_URL=https://<tu-servicio>.onrender.com npx playwright test`.
