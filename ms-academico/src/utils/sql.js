/**
 * Arma la parte SET de un UPDATE solo con los campos enviados.
 *   construirSet({ titulo: 'x', estado: 'pendiente' }, { titulo: 'titulo', estado: 'estado' }, 3)
 *   => { set: 'titulo = $3, estado = $4', valores: ['x', 'pendiente'] }
 * Los nombres de columna vienen de una lista fija (nunca del cliente).
 */
function construirSet(datos, columnas, inicio = 1) {
  const partes = [];
  const valores = [];
  for (const [campo, columna] of Object.entries(columnas)) {
    if (datos[campo] !== undefined) {
      valores.push(datos[campo]);
      partes.push(`${columna} = $${inicio + valores.length - 1}`);
    }
  }
  return { set: partes.join(', '), valores };
}

module.exports = { construirSet };
