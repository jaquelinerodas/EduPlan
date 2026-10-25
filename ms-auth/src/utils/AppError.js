/**
 * Error controlado de la aplicación: lleva el código HTTP y un código
 * corto que el frontend puede usar para mostrar un mensaje.
 */
class AppError extends Error {
  constructor(mensaje, estadoHttp = 500, codigo = 'ERROR_INTERNO') {
    super(mensaje);
    this.name = 'AppError';
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
  }
}

module.exports = AppError;
