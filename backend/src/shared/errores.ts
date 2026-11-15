/**
 * Errores de dominio de OviApp.
 *
 * Todo error que llegue al cliente sale con la forma
 *   { error: { codigo, mensaje, detalles? } }
 * para que la app tenga un unico punto de traduccion a mensajes en pantalla.
 *
 * Convencion de status:
 *   400 validacion de formato        422 regla de negocio
 *   401 sin autenticar               409 conflicto de estado
 *   403 rol insuficiente             404 no existe o es de otro predio
 */
export type CodigoError =
  // Autenticacion y autorizacion
  | 'VALIDACION'
  | 'NO_AUTENTICADO'
  | 'TOKEN_INVALIDO'
  | 'TOKEN_EXPIRADO'
  | 'CREDENCIALES_INVALIDAS'
  | 'USUARIO_INHABILITADO'
  | 'ROL_INSUFICIENTE'
  | 'API_KEY_INVALIDA'
  // Genericos
  | 'NO_ENCONTRADO'
  | 'INTERNO'
  // Usuarios (RF_20, RF_21, RF_22)
  | 'EMAIL_DUPLICADO'
  | 'USUARIO_YA_INHABILITADO'
  | 'ULTIMO_PRODUCTOR'
  | 'AUTOINHABILITACION'
  // Animales (RF_01 a RF_04)
  | 'OREJA_DUPLICADA'
  | 'IDENTIFICADOR_INMUTABLE'
  | 'ANIMAL_INACTIVO'
  | 'ANIMAL_YA_INACTIVO'
  | 'ANIMAL_ACTIVO'
  // Bitacora (RF_06)
  | 'BITACORA_INMUTABLE'
  // Eventos (RF_07 a RF_10)
  | 'TIPO_EVENTO_INMUTABLE'
  | 'EVENTO_ELIMINADO'
  | 'ANIMALES_INACTIVOS'
  | 'ANIMALES_REQUERIDOS'
  // Tareas (RF_11 a RF_14)
  | 'TAREA_COMPLETADA'
  | 'RESPONSABLES_REQUERIDOS'
  // Fechas
  | 'FECHA_PASADA'
  | 'FECHA_FUTURA'
  | 'RANGO_INVALIDO'
  // Vigilancia (RF_17)
  | 'STREAM_NO_DISPONIBLE';

export class ErrorApp extends Error {
  readonly status: number;
  readonly codigo: CodigoError;
  readonly detalles?: unknown;

  constructor(status: number, codigo: CodigoError, mensaje: string, detalles?: unknown) {
    super(mensaje);
    this.name = new.target.name;
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 - el cuerpo, la query o los parametros no cumplen el contrato. */
export class ErrorValidacion extends ErrorApp {
  constructor(mensaje = 'Los datos enviados no son validos.', detalles?: unknown) {
    super(400, 'VALIDACION', mensaje, detalles);
  }
}

/** 401 - falta el token, esta expirado o las credenciales no coinciden. */
export class ErrorNoAutenticado extends ErrorApp {
  constructor(codigo: CodigoError = 'NO_AUTENTICADO', mensaje = 'Debes iniciar sesion.') {
    super(401, codigo, mensaje);
  }
}

/** 403 - autenticado, pero el rol no alcanza para esta accion. */
export class ErrorProhibido extends ErrorApp {
  constructor(mensaje = 'Tu rol no permite realizar esta accion.', codigo: CodigoError = 'ROL_INSUFICIENTE') {
    super(403, codigo, mensaje);
  }
}

/**
 * 404 - no existe, o existe pero pertenece a otro predio.
 * Se responde igual en ambos casos: revelar la diferencia filtraria informacion
 * entre predios (RNF_08).
 */
export class ErrorNoEncontrado extends ErrorApp {
  constructor(mensaje = 'No se encontro el recurso solicitado.', codigo: CodigoError = 'NO_ENCONTRADO') {
    super(404, codigo, mensaje);
  }
}

/** 409 - el recurso ya existe o esta en un estado que impide la operacion. */
export class ErrorConflicto extends ErrorApp {
  constructor(codigo: CodigoError, mensaje: string, detalles?: unknown) {
    super(409, codigo, mensaje, detalles);
  }
}

/** 422 - el formato es correcto pero viola una regla de negocio. */
export class ErrorReglaNegocio extends ErrorApp {
  constructor(codigo: CodigoError, mensaje: string, detalles?: unknown) {
    super(422, codigo, mensaje, detalles);
  }
}

export function esErrorApp(e: unknown): e is ErrorApp {
  return e instanceof ErrorApp;
}
