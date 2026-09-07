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
exports.enrutadorBitacora = void 0;
const express_1 = require("express");
const autenticar_1 = require("../../middleware/autenticar");
const controlador = __importStar(require("./bitacora.controlador"));
/**
 * Modulo 2 - Bitacora Animal.
 * Se monta bajo /api/v1/animales porque la bitacora siempre se consulta desde
 * la ficha del animal (RF_05).
 *
 * No hay PUT ni DELETE: las entradas son append-only (RF_06).
 */
exports.enrutadorBitacora = (0, express_1.Router)();
exports.enrutadorBitacora.use(autenticar_1.autenticar);
// RF_05 - Productor y Trabajador
exports.enrutadorBitacora.get('/:idAnimal/bitacora', controlador.listar);
// Nota manual (Nota_bitacora del MER) - Productor y Trabajador
exports.enrutadorBitacora.post('/:idAnimal/bitacora', controlador.crearNota);
//# sourceMappingURL=bitacora.rutas.js.map