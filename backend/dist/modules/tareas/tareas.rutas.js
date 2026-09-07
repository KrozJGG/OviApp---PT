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
exports.enrutadorTareas = void 0;
const express_1 = require("express");
const autenticar_1 = require("../../middleware/autenticar");
const controlador = __importStar(require("./tareas.controlador"));
/**
 * Modulo 4 - Planificacion de actividades (RF_11 a RF_14).
 * Se monta en /api/v1/tareas.
 *
 * No hay restricciones de rol: RF_11 a RF_14 dicen "El Productor o el Pastor",
 * asi que las cuatro operaciones estan abiertas a ambos roles. Lo unico que
 * acota lo que ve cada usuario es el predio de su sesion (RNF_08).
 */
exports.enrutadorTareas = (0, express_1.Router)();
exports.enrutadorTareas.use(autenticar_1.autenticar);
// RF_11 - Crear tarea
exports.enrutadorTareas.post('/', controlador.crear);
// Listado y detalle
exports.enrutadorTareas.get('/', controlador.listar);
exports.enrutadorTareas.get('/:id', controlador.obtener);
// RF_12 - Editar tarea
exports.enrutadorTareas.patch('/:id', controlador.editar);
// RF_13 - Completar tarea
exports.enrutadorTareas.post('/:id/completar', controlador.completar);
// RF_14 - Eliminar tarea (borrado permanente)
exports.enrutadorTareas.delete('/:id', controlador.eliminar);
//# sourceMappingURL=tareas.rutas.js.map