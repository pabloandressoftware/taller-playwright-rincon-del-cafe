const express = require('express');
const session = require('express-session');
const path = require('path');
const store = require('./lib/store');
const { activo, REFERENCIA } = require('./lib/bugs');

const app = express();
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'cafe-practica-2026',
    resave: false,
    saveUninitialized: false,
  })
);
app.use(express.static(path.join(__dirname, 'public')));

// ---------- utilidades ----------
const datos = () => store.get();
const hoy = () => new Date().toISOString().slice(0, 10);

function siguienteId(nombre) {
  const ids = datos().ids;
  ids[nombre] = (ids[nombre] || 0) + 1;
  return ids[nombre];
}

function requireAuth(req, res, next) {
  if (!req.session.correo) {
    return res.status(401).json({ error: 'Inicia sesión primero' });
  }
  next();
}

function buscarCupon(codigo) {
  const cod = String(codigo || '').toUpperCase();
  return datos().cupones.find((c) => c.codigo === cod);
}

function carritoDe(correo) {
  const carritos = datos().carritos;
  if (!carritos[correo]) carritos[correo] = { items: [], confirmado: false };
  return carritos[correo];
}

function resumenCarrito(c) {
  const subtotal = c.items.reduce(
    (s, i) => s + (activo('carrito_ignora_cantidad') ? i.precio : i.precio * i.cantidad),
    0
  );
  const estado = c.confirmado ? 'confirmado' : c.items.length === 0 ? 'vacío' : 'con productos';
  return { items: c.items, subtotal, estado };
}

function totalesPedido(correo, body) {
  const { direccion, ciudad, metodoPago, propina } = body || {};
  if (!direccion || !ciudad || !metodoPago) {
    return { error: 'Dirección, ciudad y método de pago son obligatorios' };
  }
  const subtotal = resumenCarrito(carritoDe(correo)).subtotal;
  if (subtotal === 0) return { error: 'El carrito está vacío' };

  const envio = 5000;
  const propinaNum = Number(propina || 0);
  const base = activo('pago_impuesto_sin_envio') ? subtotal : subtotal + envio;
  const impuesto = Math.round(base * 0.19);
  const total = subtotal + envio + impuesto + propinaNum;
  return { subtotal, envio, impuesto, propina: propinaNum, total };
}

function reservadasEn(fecha, hora) {
  return datos()
    .reservas.filter((r) => r.fecha === fecha && r.hora === hora && r.estado === 'reservada')
    .reduce((s, r) => s + r.personas, 0);
}

function disponibilidadEn(fecha, hora) {
  const cupo = datos().cupoPorHorario;
  return { cupo, disponibles: cupo - reservadasEn(fecha, hora) };
}

function favoritosDe(correo) {
  const favs = datos().favoritos;
  if (!favs[correo]) favs[correo] = [];
  return favs[correo];
}

function resumenFavoritos(lista) {
  const estado = lista.length === 0 ? 'vacío' : lista.length >= 20 ? 'lleno' : 'con favoritos';
  return { total: lista.length, estado, favoritos: lista };
}

// ---------- sesión ----------
app.get('/api/sesion', (req, res) => {
  res.json({ correo: req.session.correo || null, referencia: REFERENCIA });
});

app.post('/api/login', (req, res) => {
  const { correo, contrasena } = req.body || {};
  const u = datos().usuarios.find((x) => x.correo === correo && x.contrasena === contrasena);
  if (!u) return res.status(401).json({ error: 'Credenciales inválidas' });
  req.session.correo = u.correo;
  res.json({ correo: u.correo, nombre: u.nombre });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Restaura el estado inicial. Lo usa el docente antes de cada sesión de prueba.
app.post('/api/reiniciar', (req, res) => {
  store.reiniciar();
  res.json({ ok: true });
});

// ---------- 1. Registro ----------
app.post('/api/registro/fortaleza', (req, res) => {
  const c = String((req.body && req.body.contrasena) || '');
  const reglas = [c.length >= 8, /[A-Z]/.test(c), /[0-9]/.test(c), /[^A-Za-z0-9]/.test(c)];
  res.json({ nivel: reglas.filter(Boolean).length });
});

app.post('/api/registro', (req, res) => {
  const { nombre, correo, contrasena, confirmacion } = req.body || {};
  if (!nombre || !correo || !contrasena || !confirmacion) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  if (contrasena !== confirmacion) {
    return res.status(400).json({ error: 'Las contraseñas no coinciden' });
  }
  if (!activo('registro_correo_sin_arroba') && !correo.includes('@')) {
    return res.status(400).json({ error: 'El correo no es válido' });
  }
  if (datos().usuarios.some((u) => u.correo === correo)) {
    return res.status(409).json({ error: 'Ese correo ya está registrado' });
  }
  datos().usuarios.push({ correo, nombre, contrasena });
  res.status(201).json({ estado: 'registrado', correo });
});

// ---------- 2. Catálogo ----------
app.get('/api/productos', requireAuth, (req, res) => {
  const { texto = '', categoria = '', precioMax } = req.query;
  if (precioMax !== undefined && !(Number(precioMax) > 0)) {
    return res.status(400).json({ error: 'El precio máximo debe ser mayor que 0' });
  }
  let lista = datos().productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(String(texto).toLowerCase()) &&
      (!categoria || p.categoria === categoria)
  );
  if (precioMax !== undefined) {
    const max = Number(precioMax);
    lista = lista.filter((p) =>
      activo('catalogo_precio_sobrepasa') ? p.precio <= max * 1.15 : p.precio <= max
    );
  }
  res.json({ total: lista.length, productos: lista });
});

// ---------- 3. Carrito ----------
app.get('/api/carrito', requireAuth, (req, res) => {
  res.json(resumenCarrito(carritoDe(req.session.correo)));
});

app.post('/api/carrito', requireAuth, (req, res) => {
  const { productoId, cantidad, tamaño } = req.body || {};
  const n = Number(cantidad);
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    return res.status(400).json({ error: 'La cantidad debe estar entre 1 y 10' });
  }
  const p = datos().productos.find((x) => x.id === productoId);
  if (!p) return res.status(404).json({ error: 'El producto no existe' });

  const c = carritoDe(req.session.correo);
  c.items.push({ productoId: p.id, nombre: p.nombre, precio: p.precio, cantidad: n, tamaño: tamaño || 'mediano' });
  c.confirmado = false;
  res.status(201).json(resumenCarrito(c));
});

app.post('/api/carrito/confirmar', requireAuth, (req, res) => {
  const c = carritoDe(req.session.correo);
  if (c.items.length === 0) return res.status(400).json({ error: 'El carrito está vacío' });
  c.confirmado = true;
  res.json(resumenCarrito(c));
});

app.delete('/api/carrito', requireAuth, (req, res) => {
  const c = carritoDe(req.session.correo);
  c.items = [];
  c.confirmado = false;
  res.json(resumenCarrito(c));
});

// ---------- 4. Cupones ----------
app.post('/api/cupones/aplicar', requireAuth, (req, res) => {
  const { codigo, subtotal, correo } = req.body || {};
  const cupon = buscarCupon(codigo);
  if (!cupon) return res.status(404).json({ error: 'El cupón no existe' });

  const monto = Number(subtotal);
  if (!(monto > 0)) return res.status(400).json({ error: 'El subtotal debe ser mayor que 0' });
  if (!correo) return res.status(400).json({ error: 'Indica el correo del cliente' });
  if (cupon.usadoPor.includes(correo)) {
    return res.status(409).json({ error: 'Este cupón ya fue usado por este cliente' });
  }
  if (cupon.vence < hoy() && !activo('cupones_acepta_vencidos')) {
    return res.status(400).json({ error: 'El cupón está vencido' });
  }

  const descuento = Math.round((monto * cupon.porcentaje) / 100);
  res.json({ estado: 'aplicado', codigo: cupon.codigo, descuento, total: monto - descuento });
});

app.post('/api/cupones/usar', requireAuth, (req, res) => {
  const { codigo, correo } = req.body || {};
  const cupon = buscarCupon(codigo);
  if (!cupon) return res.status(404).json({ error: 'El cupón no existe' });
  if (!correo) return res.status(400).json({ error: 'Indica el correo del cliente' });
  if (cupon.usadoPor.includes(correo)) {
    return res.status(409).json({ error: 'Este cupón ya fue usado por este cliente' });
  }
  cupon.usadoPor.push(correo);
  res.json({ estado: 'usado', codigo: cupon.codigo });
});

// ---------- 5. Pago y envío ----------
app.post('/api/pedidos/calcular', requireAuth, (req, res) => {
  const t = totalesPedido(req.session.correo, req.body);
  if (t.error) return res.status(400).json({ error: t.error });
  res.json({ estado: 'borrador', ...t });
});

app.post('/api/pedidos', requireAuth, (req, res) => {
  const correo = req.session.correo;
  const t = totalesPedido(correo, req.body);
  if (t.error) return res.status(400).json({ error: t.error });

  const pedido = {
    id: siguienteId('pedido'),
    correo,
    fecha: hoy(),
    estado: 'pendiente',
    direccion: req.body.direccion,
    ciudad: req.body.ciudad,
    metodoPago: req.body.metodoPago,
    ...t,
  };
  datos().pedidos.push(pedido);

  const c = carritoDe(correo);
  c.items = [];
  c.confirmado = false;
  res.status(201).json({ estado: 'enviado', pedido });
});

app.patch('/api/pedidos/:id', requireAuth, (req, res) => {
  const pedido = datos().pedidos.find(
    (p) => p.id === Number(req.params.id) && p.correo === req.session.correo
  );
  if (!pedido) return res.status(404).json({ error: 'El pedido no existe' });
  const { estado } = req.body || {};
  if (!['pendiente', 'entregado', 'cancelado'].includes(estado)) {
    return res.status(400).json({ error: 'Estado no válido' });
  }
  pedido.estado = estado;
  res.json(pedido);
});

// ---------- 6. Reserva de mesa ----------
app.get('/api/reservas/disponibilidad', requireAuth, (req, res) => {
  const { fecha, hora } = req.query;
  if (!fecha || !hora) return res.status(400).json({ error: 'Indica fecha y hora' });
  res.json(disponibilidadEn(fecha, hora));
});

app.post('/api/reservas', requireAuth, (req, res) => {
  const { fecha, hora, personas, nombre } = req.body || {};
  if (!fecha || !hora || !personas || !nombre) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  }
  const n = Number(personas);
  if (!Number.isInteger(n) || n < 1) {
    return res.status(400).json({ error: 'Indica un número válido de personas' });
  }
  const { disponibles } = disponibilidadEn(fecha, hora);
  if (!activo('reserva_sobrecupo') && n > disponibles) {
    return res.status(409).json({ error: `Solo quedan ${disponibles} lugares` });
  }
  const reserva = { id: siguienteId('reserva'), fecha, hora, personas: n, nombre, estado: 'reservada' };
  datos().reservas.push(reserva);
  res.status(201).json(reserva);
});

app.post('/api/reservas/:id/cancelar', requireAuth, (req, res) => {
  const reserva = datos().reservas.find((r) => r.id === Number(req.params.id));
  if (!reserva) return res.status(404).json({ error: 'La reserva no existe' });
  reserva.estado = 'cancelada';
  res.json(reserva);
});

// ---------- 7. Reseñas ----------
app.get('/api/resenas', requireAuth, (req, res) => {
  const incluir = (r) =>
    r.estado === 'publicada' || (activo('resenas_incluye_pendientes') && r.estado === 'pendiente');
  const incluidas = datos().resenas.filter(incluir);
  const promedio = incluidas.length
    ? Math.round((incluidas.reduce((s, r) => s + r.calificacion, 0) / incluidas.length) * 100) / 100
    : 0;
  res.json({ promedio, resenas: datos().resenas });
});

app.post('/api/resenas', requireAuth, (req, res) => {
  const { calificacion, comentario, nombre } = req.body || {};
  const n = Number(calificacion);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    return res.status(400).json({ error: 'La calificación es obligatoria (de 1 a 5)' });
  }
  const resena = {
    id: siguienteId('resena'),
    calificacion: n,
    comentario: comentario || '',
    nombre: nombre || '',
    estado: 'pendiente',
  };
  datos().resenas.push(resena);
  res.status(201).json(resena);
});

function cambiarEstadoResena(req, res, nuevo) {
  const r = datos().resenas.find((x) => x.id === Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'La reseña no existe' });
  r.estado = nuevo;
  res.json(r);
}
app.post('/api/resenas/:id/publicar', requireAuth, (req, res) => cambiarEstadoResena(req, res, 'publicada'));
app.post('/api/resenas/:id/ocultar', requireAuth, (req, res) => cambiarEstadoResena(req, res, 'oculta'));

// ---------- 8. Favoritos ----------
app.get('/api/favoritos', requireAuth, (req, res) => {
  res.json(resumenFavoritos(favoritosDe(req.session.correo)));
});

app.post('/api/favoritos', requireAuth, (req, res) => {
  const { producto, nota, prioridad } = req.body || {};
  if (!producto) return res.status(400).json({ error: 'Indica el producto' });
  if (!['alta', 'media', 'baja'].includes(prioridad)) {
    return res.status(400).json({ error: 'La prioridad debe ser alta, media o baja' });
  }
  const lista = favoritosDe(req.session.correo);
  if (lista.length >= 20) return res.status(409).json({ error: 'Máximo 20 favoritos' });

  lista.push({ id: siguienteId('favorito'), producto, nota: nota || '', prioridad });
  res.status(201).json(resumenFavoritos(lista));
});

app.delete('/api/favoritos/:id', requireAuth, (req, res) => {
  const lista = favoritosDe(req.session.correo);
  const id = Number(req.params.id);
  if (lista.length === 0) return res.status(404).json({ error: 'No hay favoritos' });
  const idx = activo('favoritos_quita_primero') ? 0 : lista.findIndex((f) => f.id === id);
  if (idx < 0) return res.status(404).json({ error: 'El favorito no existe' });
  lista.splice(idx, 1);
  res.json(resumenFavoritos(lista));
});

// ---------- 9. Programa de puntos ----------
app.post('/api/puntos/acumular', requireAuth, (req, res) => {
  const { monto, codigoCliente } = req.body || {};
  const m = Number(monto);
  if (!(m > 0)) return res.status(400).json({ error: 'El monto debe ser mayor que 0' });
  const saldos = datos().saldos;
  if (!Object.prototype.hasOwnProperty.call(saldos, codigoCliente)) {
    return res.status(404).json({ error: 'El código de cliente no existe' });
  }
  const ganados = activo('puntos_redondeo_arriba') ? Math.ceil(m / 1000) : Math.floor(m / 1000);
  saldos[codigoCliente] += ganados;
  res.json({ puntosGanados: ganados, saldo: saldos[codigoCliente], estado: 'acumulados' });
});

app.post('/api/puntos/canjear', requireAuth, (req, res) => {
  const { codigoCliente, puntos } = req.body || {};
  const saldos = datos().saldos;
  if (!Object.prototype.hasOwnProperty.call(saldos, codigoCliente)) {
    return res.status(404).json({ error: 'El código de cliente no existe' });
  }
  const p = Number(puntos);
  if (!Number.isInteger(p) || p < 1) return res.status(400).json({ error: 'Indica los puntos a canjear' });
  if (p > saldos[codigoCliente]) return res.status(400).json({ error: 'No tienes suficientes puntos' });
  saldos[codigoCliente] -= p;
  res.json({ puntosCanjeados: p, saldo: saldos[codigoCliente], estado: 'canjeados' });
});

app.get('/api/puntos/:codigo', requireAuth, (req, res) => {
  const codigo = req.params.codigo;
  const saldos = datos().saldos;
  if (!Object.prototype.hasOwnProperty.call(saldos, codigo)) {
    return res.status(404).json({ error: 'El código de cliente no existe' });
  }
  const saldo = saldos[codigo];
  res.json({ saldo, estado: saldo === 0 ? 'sin puntos' : 'acumulados' });
});

// ---------- 10. Historial de pedidos ----------
app.get('/api/historial', requireAuth, (req, res) => {
  const { desde, hasta, estado } = req.query;
  if (desde && hasta && desde > hasta && !activo('historial_fechas_invertidas')) {
    return res.status(400).json({ error: 'La fecha inicial no puede ser mayor que la final' });
  }
  let lista = datos().pedidos.filter((p) => p.correo === req.session.correo);
  if (desde) lista = lista.filter((p) => p.fecha >= desde);
  if (hasta) lista = lista.filter((p) => p.fecha <= hasta);
  if (estado && estado !== 'todos') lista = lista.filter((p) => p.estado === estado);
  const total = lista.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + p.total, 0);
  res.json({ total, pedidos: lista });
});

// ---------- arranque ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  const modo = REFERENCIA ? 'modo referencia, sin bugs' : 'con bugs';
  console.log(`El Rincón del Café en el puerto ${PORT} (${modo})`);
});

module.exports = app;
