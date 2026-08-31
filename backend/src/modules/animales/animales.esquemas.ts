import { z } from 'zod';
import { esquemaPaginacion } from '../../shared/paginacion';

/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04).
 *
 * Los mensajes de cada regla se escriben aqui, en espanol y sin jerga: los lee
 * un productor ovino en terreno desde la app, no un desarrollador.
 */

const SEXOS = ['MACHO', 'HEMBRA'] as const;
const ESTADOS = ['ACTIVO', 'INACTIVO'] as const;
const MOTIVOS_BAJA = ['VENTA', 'MUERTE', 'FAENA'] as const;

/**
 * Campo de texto libre opcional. Acepta `null` para borrar el dato desde la
 * edicion (RF_03); la cadena vacia se normaliza a `null` en el servicio.
 */
const textoOpcional = (max: number, etiqueta: string) =>
  z
    .string()
    .trim()
    .max(max, `${etiqueta} no puede superar los ${max} caracteres.`)
    .nullable()
    .optional();

const pesoOpcional = z
  .number()
  .positive('El peso debe ser mayor que cero.')
  .max(9999.99, 'El peso no puede superar los 9999,99 kg.')
  .nullable()
  .optional();

const fechaOpcional = z.iso.date('La fecha debe tener el formato AAAA-MM-DD.').nullable().optional();

/** RF_01 - Registrar animal. */
export const esquemaCrearAnimal = z.object({
  numeroOreja: z
    .string()
    .trim()
    .min(1, 'El numero de oreja es obligatorio.')
    .max(30, 'El numero de oreja no puede superar los 30 caracteres.'),
  sexo: z.enum(SEXOS, 'El sexo debe ser MACHO o HEMBRA.'),
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
export const esquemaEditarAnimal = z.object({
  numeroOreja: z.unknown().optional(),
  sexo: z.enum(SEXOS, 'El sexo debe ser MACHO o HEMBRA.').optional(),
  raza: textoOpcional(80, 'La raza'),
  color: textoOpcional(40, 'El color'),
  pesoKg: pesoOpcional,
  fechaNacimiento: fechaOpcional,
  descripcion: textoOpcional(1000, 'La descripcion'),
});

/** Listado del rebano (mockup 03). */
export const esquemaListadoAnimales = esquemaPaginacion.extend({
  estado: z.enum(ESTADOS, 'El estado debe ser ACTIVO o INACTIVO.').optional(),
  q: z
    .string()
    .trim()
    .min(1, 'La busqueda no puede estar vacia.')
    .max(30, 'La busqueda no puede superar los 30 caracteres.')
    .optional(),
});

/** RF_04 - Registrar baja. */
export const esquemaBajaAnimal = z.object({
  motivo: z.enum(MOTIVOS_BAJA, 'El motivo debe ser VENTA, MUERTE o FAENA.'),
  fecha: z.iso.date('La fecha debe tener el formato AAAA-MM-DD.'),
});

export type DatosCrearAnimal = z.infer<typeof esquemaCrearAnimal>;
export type DatosEditarAnimal = z.infer<typeof esquemaEditarAnimal>;
export type FiltrosListadoAnimales = z.infer<typeof esquemaListadoAnimales>;
export type DatosBajaAnimal = z.infer<typeof esquemaBajaAnimal>;
