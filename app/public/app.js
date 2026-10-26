const app = document.getElementById('app');
const nav = document.getElementById('nav');
const salir = document.getElementById('salir');

const SECCIONES = [
  ['registro', 'Registro'],
  ['catalogo', 'Catálogo'],
  ['carrito', 'Carrito'],
  ['cupones', 'Cupones'],
  ['pago', 'Pago y envío'],
  ['reserva', 'Reserva de mesa'],
  ['resenas', 'Reseñas'],
  ['favoritos', 'Favoritos'],
  ['puntos', 'Programa de puntos'],
  ['historial', 'Historial de pedidos'],
];

// ---------- utilidades ----------
async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const res = await fetch(ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || 'Error inesperado');
  return datos;
}

function mensaje(texto, ok = true) {
  const el = document.getElementById('mensaje');
  if (!el) return;
  el.textContent = texto;
  el.dataset.tipo = ok ? 'ok' : 'error';
}

function formulario(id) {
  return Object.fromEntries(new FormData(document.getElementById(id)).entries());
}

function query(obj) {
  return new URLSearchParams(Object.entries(obj).filter(([, v]) => v)).toString();
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pantalla(titulo, html) {
  app.innerHTML = `<section><h2>${titulo}</h2>${html}<p id="mensaje" role="status"></p></section>`;
}

// ---------- sesión ----------
function vistaLogin() {
  salir.hidden = true;
  nav.hidden = true;
  app.innerHTML = `
    <section>
      <h2>Inicia sesión</h2>
      <form id="f-login">
        <label>Correo <input name="correo" type="text" autocomplete="username"></label>
        <label>Contraseña <input name="contrasena" type="password" autocomplete="current-password"></label>
        <button type="submit">Iniciar sesión</button>
      </form>
      <p>¿No tienes cuenta? <button type="button" id="ir-registro">Crear cuenta</button></p>
      <p id="mensaje" role="status"></p>
    </section>`;
  document.getElementById('f-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/login', { metodo: 'POST', cuerpo: formulario('f-login') });
      iniciarApp();
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('ir-registro').addEventListener('click', () => vistaRegistro(true));
}

function iniciarApp() {
  salir.hidden = false;
  nav.hidden = false;
  nav.innerHTML = SECCIONES.map(([id, t]) => `<button type="button" data-seccion="${id}">${t}</button>`).join('');
  mostrar('catalogo');
}

function mostrar(seccion) {
  VISTAS[seccion]();
}

nav.addEventListener('click', (e) => {
  const b = e.target.closest('[data-seccion]');
  if (b) mostrar(b.dataset.seccion);
});

salir.addEventListener('click', async () => {
  await api('/api/logout', { metodo: 'POST' });
  vistaLogin();
});

// ---------- 1. Registro ----------
function vistaRegistro(publica = false) {
  pantalla('Registro', `
    <form id="f-registro">
      <label>Nombre <input name="nombre"></label>
      <label>Correo <input name="correo" type="text"></label>
      <label>Contraseña <input name="contrasena" type="password"></label>
      <label>Confirmación <input name="confirmacion" type="password"></label>
      <p>Fortaleza de la contraseña: <strong data-testid="nivel-fortaleza">0</strong> de 4</p>
      <p>Estado: <span data-testid="estado-registro">pendiente</span></p>
      <button type="submit">Registrarme</button>
    </form>${publica ? '<p>¿Ya tienes cuenta? <button type="button" id="volver-login">Iniciar sesión</button></p>' : ''}`);
  if (publica) {
    document.getElementById('volver-login').addEventListener('click', () => vistaLogin());
  }
  const f = document.getElementById('f-registro');
  f.elements.contrasena.addEventListener('input', async (e) => {
    const { nivel } = await api('/api/registro/fortaleza', { metodo: 'POST', cuerpo: { contrasena: e.target.value } });
    f.querySelector('[data-testid="nivel-fortaleza"]').textContent = nivel;
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/registro', { metodo: 'POST', cuerpo: formulario('f-registro') });
      f.querySelector('[data-testid="estado-registro"]').textContent = 'registrado';
      mensaje('Usuario registrado');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
}

// ---------- 2. Catálogo ----------
async function buscarCatalogo() {
  const f = formulario('f-catalogo');
  try {
    const r = await api(`/api/productos?${query(f)}`);
    document.querySelector('[data-testid="total-resultados"]').textContent = r.total;
    document.getElementById('lista-productos').innerHTML = r.productos
      .map((p) => `<li>${esc(p.nombre)} (${esc(p.categoria)}): $${p.precio}</li>`)
      .join('');
    mensaje('');
  } catch (err) {
    mensaje(err.message, false);
  }
}

function vistaCatalogo() {
  pantalla('Catálogo', `
    <form id="f-catalogo">
      <label>Texto <input name="texto"></label>
      <label>Categoría
        <select name="categoria">
          <option value="">Todas</option>
          <option>bebidas</option>
          <option>postres</option>
          <option>comida</option>
        </select>
      </label>
      <label>Precio máximo <input name="precioMax" type="number" min="0"></label>
      <button type="submit">Buscar</button>
    </form>
    <p>Resultados: <strong data-testid="total-resultados">0</strong></p>
    <ul id="lista-productos"></ul>`);
  document.getElementById('f-catalogo').addEventListener('submit', (e) => {
    e.preventDefault();
    buscarCatalogo();
  });
  buscarCatalogo();
}

// ---------- 3. Carrito ----------
function pintarCarrito(r) {
  document.getElementById('resumen-carrito').innerHTML = `
    <div>
      <p>Estado: <strong data-testid="estado-carrito">${esc(r.estado)}</strong></p>
      <ul>${r.items.map((i) => `<li>${esc(i.nombre)} × ${i.cantidad} (${esc(i.tamaño)})</li>`).join('')}</ul>
      <p>Subtotal: <strong data-testid="subtotal">$${r.subtotal}</strong></p>
    </div>`;
}

async function vistaCarrito() {
  const { productos } = await api('/api/productos');
  pantalla('Carrito', `
    <form id="f-carrito">
      <label>Producto
        <select name="productoId">
          ${productos.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('')}
        </select>
      </label>
      <label>Cantidad <input name="cantidad" type="number" min="1" max="10" value="1"></label>
      <label>Tamaño
        <select name="tamaño">
          <option>pequeño</option>
          <option selected>mediano</option>
          <option>grande</option>
        </select>
      </label>
      <button type="submit">Agregar al carrito</button>
    </form>
    <div id="resumen-carrito"></div>
    <button type="button" id="confirmar">Confirmar carrito</button>
    <button type="button" id="vaciar">Vaciar carrito</button>`);

  const cargar = async () => pintarCarrito(await api('/api/carrito'));

  document.getElementById('f-carrito').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      pintarCarrito(await api('/api/carrito', { metodo: 'POST', cuerpo: formulario('f-carrito') }));
      mensaje('Producto agregado');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('confirmar').addEventListener('click', async () => {
    try {
      pintarCarrito(await api('/api/carrito/confirmar', { metodo: 'POST' }));
      mensaje('Carrito confirmado');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('vaciar').addEventListener('click', async () => {
    pintarCarrito(await api('/api/carrito', { metodo: 'DELETE' }));
    mensaje('Carrito vacío');
  });
  cargar();
}

// ---------- 4. Cupones ----------
function vistaCupones() {
  pantalla('Cupones', `
    <form id="f-cupon">
      <label>Código <input name="codigo"></label>
      <label>Subtotal <input name="subtotal" type="number" min="0"></label>
      <label>Correo del cliente <input name="correo" type="text"></label>
      <button type="submit">Aplicar cupón</button>
    </form>
    <div id="resultado-cupon"></div>
    <button type="button" id="usar-cupon" hidden>Usar cupón</button>`);

  let datosCupon = null;
  document.getElementById('f-cupon').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      datosCupon = formulario('f-cupon');
      const r = await api('/api/cupones/aplicar', { metodo: 'POST', cuerpo: datosCupon });
      document.getElementById('resultado-cupon').innerHTML = `
        <p>Estado: <strong data-testid="estado-cupon">${esc(r.estado)}</strong></p>
        <p>Descuento: <strong data-testid="descuento">$${r.descuento}</strong></p>
        <p>Total: <strong data-testid="total-cupon">$${r.total}</strong></p>`;
      document.getElementById('usar-cupon').hidden = false;
      mensaje('Cupón aplicado');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('usar-cupon').addEventListener('click', async () => {
    try {
      const r = await api('/api/cupones/usar', { metodo: 'POST', cuerpo: datosCupon });
      document.querySelector('[data-testid="estado-cupon"]').textContent = r.estado;
      mensaje('Cupón usado');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
}

// ---------- 5. Pago y envío ----------
function vistaPago() {
  pantalla('Pago y envío', `
    <form id="f-pago">
      <label>Dirección <input name="direccion"></label>
      <label>Ciudad <input name="ciudad"></label>
      <label>Método de pago
        <select name="metodoPago">
          <option value="">Selecciona</option>
          <option>efectivo</option>
          <option>tarjeta</option>
          <option>nequi</option>
        </select>
      </label>
      <label>Propina <input name="propina" type="number" min="0" value="0"></label>
      <button type="button" id="calcular">Calcular total</button>
      <button type="submit">Confirmar pedido</button>
    </form>
    <div id="resumen-pago"></div>`);

  const pintar = (t, estado) => {
    document.getElementById('resumen-pago').innerHTML = `
      <p>Estado: <strong data-testid="estado-pago">${esc(estado)}</strong></p>
      <p>Subtotal: $${t.subtotal}</p>
      <p>Envío: $${t.envio}</p>
      <p>Impuesto (19%): <strong data-testid="impuesto">$${t.impuesto}</strong></p>
      <p>Propina: $${t.propina}</p>
      <p>Total: <strong data-testid="total-pago">$${t.total}</strong></p>`;
  };

  document.getElementById('calcular').addEventListener('click', async () => {
    try {
      const r = await api('/api/pedidos/calcular', { metodo: 'POST', cuerpo: formulario('f-pago') });
      pintar(r, r.estado);
      mensaje('Total calculado');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('f-pago').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api('/api/pedidos', { metodo: 'POST', cuerpo: formulario('f-pago') });
      pintar(r.pedido, r.estado);
      mensaje(`Pedido #${r.pedido.id} enviado`);
    } catch (err) {
      mensaje(err.message, false);
    }
  });
}

// ---------- 6. Reserva de mesa ----------
function vistaReserva() {
  pantalla('Reserva de mesa', `
    <form id="f-reserva">
      <label>Fecha <input name="fecha" type="date"></label>
      <label>Hora
        <select name="hora">
          <option>18:00</option>
          <option>19:00</option>
          <option>20:00</option>
        </select>
      </label>
      <label>Personas <input name="personas" type="number" min="1"></label>
      <label>Nombre <input name="nombre"></label>
      <button type="button" id="consultar">Consultar disponibilidad</button>
      <button type="submit">Reservar</button>
    </form>
    <p>Lugares disponibles: <strong data-testid="disponibles">-</strong></p>
    <p>Estado: <span data-testid="estado-reserva">-</span></p>
    <button type="button" id="cancelar" hidden>Cancelar reserva</button>`);

  let ultimaReserva = null;
  document.getElementById('consultar').addEventListener('click', async () => {
    const f = formulario('f-reserva');
    try {
      const r = await api(`/api/reservas/disponibilidad?${query({ fecha: f.fecha, hora: f.hora })}`);
      document.querySelector('[data-testid="disponibles"]').textContent = r.disponibles;
      mensaje('');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('f-reserva').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await api('/api/reservas', { metodo: 'POST', cuerpo: formulario('f-reserva') });
      ultimaReserva = r.id;
      document.querySelector('[data-testid="estado-reserva"]').textContent = r.estado;
      document.getElementById('cancelar').hidden = false;
      mensaje('Reserva creada');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('cancelar').addEventListener('click', async () => {
    try {
      const r = await api(`/api/reservas/${ultimaReserva}/cancelar`, { metodo: 'POST' });
      document.querySelector('[data-testid="estado-reserva"]').textContent = r.estado;
      mensaje('Reserva cancelada');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
}

// ---------- 7. Reseñas ----------
async function cargarResenas() {
  const r = await api('/api/resenas');
  document.querySelector('[data-testid="promedio"]').textContent = r.promedio;
  document.getElementById('lista-resenas').innerHTML = r.resenas
    .map(
      (x) => `
      <li data-testid="resena-${x.id}">
        ${x.calificacion} ★ ${esc(x.nombre)} — ${esc(x.comentario)} [${esc(x.estado)}]
        <button type="button" data-accion="publicar" data-id="${x.id}">Publicar</button>
        <button type="button" data-accion="ocultar" data-id="${x.id}">Ocultar</button>
      </li>`
    )
    .join('');
}

function vistaResenas() {
  pantalla('Reseñas', `
    <form id="f-resena">
      <label>Calificación
        <select name="calificacion">
          <option value="">Selecciona</option>
          <option>1</option><option>2</option><option>3</option><option>4</option><option>5</option>
        </select>
      </label>
      <label>Comentario <textarea name="comentario"></textarea></label>
      <label>Nombre <input name="nombre"></label>
      <button type="submit">Enviar reseña</button>
    </form>
    <p>Promedio: <strong data-testid="promedio">0</strong></p>
    <ul id="lista-resenas"></ul>`);

  document.getElementById('f-resena').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/resenas', { metodo: 'POST', cuerpo: formulario('f-resena') });
      mensaje('Reseña enviada');
      cargarResenas();
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('lista-resenas').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-accion]');
    if (!b) return;
    await api(`/api/resenas/${b.dataset.id}/${b.dataset.accion}`, { metodo: 'POST' });
    cargarResenas();
  });
  cargarResenas();
}

// ---------- 8. Favoritos ----------
function pintarFavoritos(r) {
  document.querySelector('[data-testid="estado-favoritos"]').textContent = r.estado;
  document.querySelector('[data-testid="total-favoritos"]').textContent = r.total;
  document.getElementById('lista-favoritos').innerHTML = r.favoritos
    .map(
      (f) => `
      <li data-testid="favorito-${f.id}">
        ${esc(f.producto)} (${esc(f.prioridad)}) ${esc(f.nota)}
        <button type="button" data-id="${f.id}">Quitar</button>
      </li>`
    )
    .join('');
}

function vistaFavoritos() {
  pantalla('Favoritos', `
    <form id="f-favorito">
      <label>Producto <input name="producto"></label>
      <label>Nota <input name="nota"></label>
      <label>Prioridad
        <select name="prioridad">
          <option>alta</option>
          <option selected>media</option>
          <option>baja</option>
        </select>
      </label>
      <button type="submit">Agregar favorito</button>
    </form>
    <p>Estado: <strong data-testid="estado-favoritos">-</strong> · Total: <strong data-testid="total-favoritos">0</strong></p>
    <ul id="lista-favoritos"></ul>`);

  document.getElementById('f-favorito').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      pintarFavoritos(await api('/api/favoritos', { metodo: 'POST', cuerpo: formulario('f-favorito') }));
      mensaje('Favorito agregado');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('lista-favoritos').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    try {
      pintarFavoritos(await api(`/api/favoritos/${b.dataset.id}`, { metodo: 'DELETE' }));
      mensaje('Favorito quitado');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  api('/api/favoritos').then(pintarFavoritos);
}

// ---------- 9. Programa de puntos ----------
function vistaPuntos() {
  pantalla('Programa de puntos', `
    <h3>Acumular puntos</h3>
    <form id="f-acumular">
      <label>Monto de compra <input name="monto" type="number" min="0"></label>
      <label>Código de cliente <input name="codigoCliente" type="text"></label>
      <button type="submit">Acumular</button>
    </form>
    <h3>Canjear puntos</h3>
    <form id="f-canjear">
      <label>Código de cliente <input name="codigoCliente" type="text"></label>
      <label>Puntos a canjear <input name="puntos" type="number" min="1"></label>
      <button type="submit">Canjear</button>
    </form>
    <p>Puntos ganados: <strong data-testid="puntos-ganados">-</strong></p>
    <p>Saldo: <strong data-testid="saldo">-</strong> · Estado: <span data-testid="estado-puntos">-</span></p>`);

  const pintar = (r) => {
    if (r.puntosGanados !== undefined) document.querySelector('[data-testid="puntos-ganados"]').textContent = r.puntosGanados;
    document.querySelector('[data-testid="saldo"]').textContent = r.saldo;
    document.querySelector('[data-testid="estado-puntos"]').textContent = r.estado;
  };

  document.getElementById('f-acumular').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      pintar(await api('/api/puntos/acumular', { metodo: 'POST', cuerpo: formulario('f-acumular') }));
      mensaje('Puntos acumulados');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
  document.getElementById('f-canjear').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      pintar(await api('/api/puntos/canjear', { metodo: 'POST', cuerpo: formulario('f-canjear') }));
      mensaje('Puntos canjeados');
    } catch (err) {
      mensaje(err.message, false);
    }
  });
}

// ---------- 10. Historial de pedidos ----------
async function buscarHistorial() {
  try {
    const r = await api(`/api/historial?${query(formulario('f-historial'))}`);
    document.querySelector('[data-testid="total-gastado"]').textContent = r.total;
    document.getElementById('lista-pedidos').innerHTML = r.pedidos
      .map(
        (p) => `
        <li data-testid="pedido-${p.id}">
          Pedido #${p.id} · ${esc(p.fecha)} · $${p.total} ·
          <span data-testid="estado-pedido-${p.id}">${esc(p.estado)}</span>
          <button type="button" data-id="${p.id}" data-estado="entregado">Marcar entregado</button>
          <button type="button" data-id="${p.id}" data-estado="cancelado">Cancelar</button>
        </li>`
      )
      .join('');
    mensaje('');
  } catch (err) {
    mensaje(err.message, false);
  }
}

function vistaHistorial() {
  pantalla('Historial de pedidos', `
    <form id="f-historial">
      <label>Desde <input name="desde" type="date"></label>
      <label>Hasta <input name="hasta" type="date"></label>
      <label>Estado
        <select name="estado">
          <option>todos</option>
          <option>pendiente</option>
          <option>entregado</option>
          <option>cancelado</option>
        </select>
      </label>
      <button type="submit">Consultar</button>
    </form>
    <p>Total gastado: <strong data-testid="total-gastado">0</strong></p>
    <ul id="lista-pedidos"></ul>`);

  document.getElementById('f-historial').addEventListener('submit', (e) => {
    e.preventDefault();
    buscarHistorial();
  });
  document.getElementById('lista-pedidos').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    await api(`/api/pedidos/${b.dataset.id}`, { metodo: 'PATCH', cuerpo: { estado: b.dataset.estado } });
    buscarHistorial();
  });
  buscarHistorial();
}

// ---------- arranque ----------
const VISTAS = {
  registro: vistaRegistro,
  catalogo: vistaCatalogo,
  carrito: vistaCarrito,
  cupones: vistaCupones,
  pago: vistaPago,
  reserva: vistaReserva,
  resenas: vistaResenas,
  favoritos: vistaFavoritos,
  puntos: vistaPuntos,
  historial: vistaHistorial,
};

async function arranque() {
  const s = await api('/api/sesion');
  if (s.correo) iniciarApp();
  else vistaLogin();
}

arranque();
