class AppError extends Error {
  constructor(mensaje, estadoHttp = 500, codigo = 'ERROR_INTERNO', detalles) {
    super(mensaje);
    this.name = 'AppError';
    this.estadoHttp = estadoHttp;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

module.exports = AppError;
