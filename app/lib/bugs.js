// Interruptores de los bugs inyectados.
// Solo el docente debe conocer esta lista; no se documenta en el README de los estudiantes.
//
// MODO_REFERENCIA=true desactiva todos los bugs (versión de referencia para calificar).

const REFERENCIA = process.env.MODO_REFERENCIA === 'true';

const bugs = {
  registro_correo_sin_arroba: true,
  catalogo_precio_sobrepasa: true,
  carrito_ignora_cantidad: true,
  cupones_acepta_vencidos: true,
  pago_impuesto_sin_envio: true,
  reserva_sobrecupo: true,
  resenas_incluye_pendientes: true,
  favoritos_quita_primero: true,
  puntos_redondeo_arriba: true,
  historial_fechas_invertidas: true,
};

// Devuelve true si el bug está activo en esta ejecución.
function activo(nombre) {
  return !REFERENCIA && bugs[nombre] === true;
}

module.exports = { activo, REFERENCIA };
