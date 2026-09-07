"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esquemaBajaAnimal = exports.esquemaListadoAnimales = exports.esquemaEditarAnimal = exports.esquemaCrearAnimal = void 0;
const zod_1 = require("zod");
const paginacion_1 = require("../../shared/paginacion");
/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04).
 *
 * Los mensajes de cada regla se escriben aqui, en espanol y sin jerga: los lee
 * un productor ovino en terreno desde la app, no un desarrollador.
 */
const SEXOS = ['MACHO', 'HEMBRA'];
const ESTADOS = ['ACTIVO', 'INACTIVO'];
const MOTIVOS_BAJA = ['VENTA', 'MUERTE', 'FAENA'];
/**
 * Campo de texto libre opcional. Acepta `null` para borrar el dato desde la
 * edicion (RF_03); la cadena vacia se normaliza a `null` en el servicio.
 */
const textoOpcional = (max, etiqueta) => zod_1.z
    .string()
    .trim()
    .max(max, `${etiqueta} no puede superar los ${max} caracteres.`)
    .nullable()
    .optional();
const pesoOpcional = zod_1.z
    .number()
    .positive('El peso debe ser mayor que cero.')
    .max(9999.99, 'El peso no puede superar los 9999,99 kg.')
    .nullable()
    .optional();
const fechaOpcional = zod_1.z.iso.date('La fecha debe tener el formato AAAA-MM-DD.').nullable().optional();
/** RF_01 - Registrar animal. */
exports.esquemaCrearAnimal = zod_1.z.object({
    numeroOreja: zod_1.z
        .string()
        .trim()
        .min(1, 'El numero de oreja es obligatorio.')
        .max(30, 'El numero de oreja no puede superar los 30 caracteres.'),
    sexo: zod_1.z.enum(SEXOS, 'El sexo debe ser MACHO o HEMBRA.'),
    raza: textoOpcional(80, 'La raza'),
    color: textoOpcional(40, 'El color'),
    pesoKg: pesoOpcional,
    fechaNacimiento: fechaOpcional,
    descripcion: textoOpcional(1000, 'La descripcion'),
});
/**
 * RF_03 - Editar datos generales. Todos los campos son opcionales.
 *
 * `numeroOreja` se declara a proposito: es inmutable (H7), y enviarlo tiene que
 * producir un 409 con un mensaje claro en vez de ignorarse en silencio.
 */
exports.esquemaEditarAnimal = zod_1.z.object({
    numeroOreja: zod_1.z.unknown().optional(),
    sexo: zod_1.z.enum(SEXOS, 'El sexo debe ser MACHO o HEMBRA.').optional(),
    raza: textoOpcional(80, 'La raza'),
    color: textoOpcional(40, 'El color'),
    pesoKg: pesoOpcional,
    fechaNacimiento: fechaOpcional,
    descripcion: textoOpcional(1000, 'La descripcion'),
});
/** Listado del rebano (mockup 03). */
exports.esquemaListadoAnimales = paginacion_1.esquemaPaginacion.extend({
    estado: zod_1.z.enum(ESTADOS, 'El estado debe ser ACTIVO o INACTIVO.').optional(),
    q: zod_1.z
        .string()
        .trim()
        .min(1, 'La busqueda no puede estar vacia.')
        .max(30, 'La busqueda no puede superar los 30 caracteres.')
        .optional(),
});
/** RF_04 - Registrar baja. */
exports.esquemaBajaAnimal = zod_1.z.object({
    motivo: zod_1.z.enum(MOTIVOS_BAJA, 'El motivo debe ser VENTA, MUERTE o FAENA.'),
    fecha: zod_1.z.iso.date('La fecha debe tener el formato AAAA-MM-DD.'),
});
//# sourceMappingURL=animales.esquemas.js.map