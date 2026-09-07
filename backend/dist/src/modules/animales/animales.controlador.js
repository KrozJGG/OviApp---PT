"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.crear = crear;
exports.listar = listar;
exports.obtener = obtener;
exports.editar = editar;
exports.darDeBaja = darDeBaja;
const contexto_1 = require("../../shared/contexto");
const validacion_1 = require("../../shared/validacion");
const animales_esquemas_1 = require("./animales.esquemas");
const servicio = __importStar(require("./animales.servicio"));
/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04).
 * El controlador solo valida la entrada y traduce el resultado a HTTP: las
 * reglas viven en `animales.servicio`.
 */
/** POST /animales - RF_01 */
async function crear(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const datos = (0, validacion_1.validarCuerpo)(animales_esquemas_1.esquemaCrearAnimal, req);
    res.status(201).json(await servicio.crear(ctx, datos));
}
/** GET /animales - listado del rebano */
async function listar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const filtros = (0, validacion_1.validarQuery)(animales_esquemas_1.esquemaListadoAnimales, req);
    res.json(await servicio.listar(ctx, filtros));
}
/** GET /animales/:id - RF_02 */
async function obtener(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    res.json(await servicio.obtenerFicha(ctx, id));
}
/** PATCH /animales/:id - RF_03 */
async function editar(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    const datos = (0, validacion_1.validarCuerpo)(animales_esquemas_1.esquemaEditarAnimal, req);
    res.json(await servicio.editar(ctx, id, datos));
}
/** POST /animales/:id/baja - RF_04 */
async function darDeBaja(req, res) {
    const ctx = (0, contexto_1.ctxDe)(req);
    const { id } = (0, validacion_1.validarParams)(validacion_1.esquemaParamId, req);
    const datos = (0, validacion_1.validarCuerpo)(animales_esquemas_1.esquemaBajaAnimal, req);
    res.json(await servicio.darDeBaja(ctx, id, datos));
}
//# sourceMappingURL=animales.controlador.js.map