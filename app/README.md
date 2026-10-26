# El Rincón del Café

Aplicación web de una cafetería en línea para practicar pruebas automatizadas con Playwright.

## Cómo correr la app

```bash
npm install
npm start
```

La app queda disponible en `http://localhost:3000` (o en el puerto que indique la variable `PORT`).

## Inicio de sesión

Todas las funcionalidades requieren iniciar sesión. Usa cualquiera de estas cuentas de práctica:

- Correo: `estudiante1@cafe.test` … `estudiante16@cafe.test`
- Contraseña: `Cafe2026`

## Reiniciar los datos

Para volver al estado inicial (por ejemplo, antes de cada sesión de pruebas):

```bash
curl -X POST http://localhost:3000/api/reiniciar
```

## Funcionalidades

Las funcionalidades aparecen en el menú superior: Registro, Catálogo, Carrito, Cupones, Pago y envío, Reserva de mesa, Reseñas, Favoritos, Programa de puntos e Historial de pedidos.

## Despliegue en Render

- **Build command:** `npm install`
- **Start command:** `npm start`

Render asigna el puerto automáticamente mediante la variable `PORT`.

## Notas

- Los datos viven en memoria: si el servicio se reinicia, vuelven al estado inicial.
- El archivo `data/seed.json` contiene los datos de partida.
