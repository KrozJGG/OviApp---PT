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
exports.enrutadorAnimales = void 0;
const express_1 = require("express");
const autenticar_1 = require("../../middleware/autenticar");
const autorizar_1 = require("../../middleware/autorizar");
const controlador = __importStar(require("./animales.controlador"));
/**
 * Modulo 1 - Ficha Animal (RF_01 a RF_04). Se monta en /api/v1/animales.
 *
 * Matriz rol x endpoint (Tabla 3.1 de la tesis): el Trabajador registra,
 * consulta y edita animales; solo el Productor puede darlos de baja (RF_04).
 *
 * Las rutas de bitacora (/:idAnimal/bitacora) las sirve el Modulo 2, montado
 * aparte sobre este mismo prefijo.
 */
exports.enrutadorAnimales = (0, express_1.Router)();
exports.enrutadorAnimales.use(autenticar_1.autenticar);
// RF_01 - Productor y Trabajador
exports.enrutadorAnimales.post('/', controlador.crear);
// Listado del rebano - Productor y Trabajador
exports.enrutadorAnimales.get('/', controlador.listar);
// RF_02 - Productor y Trabajador
exports.enrutadorAnimales.get('/:id', controlador.obtener);
// RF_03 - Productor y Trabajador
exports.enrutadorAnimales.patch('/:id', controlador.editar);
// RF_04 - solo Productor
exports.enrutadorAnimales.post('/:id/baja', autorizar_1.soloProductor, controlador.darDeBaja);
//# sourceMappingURL=animales.rutas.js.map