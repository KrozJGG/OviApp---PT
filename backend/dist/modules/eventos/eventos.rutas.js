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
exports.enrutadorEventos = void 0;
const express_1 = require("express");
const autenticar_1 = require("../../middleware/autenticar");
const autorizar_1 = require("../../middleware/autorizar");
const controlador = __importStar(require("./eventos.controlador"));
/**
 * Modulo 3 - Organizador de eventos (RF_07 a RF_10). Se monta en /api/v1/eventos.
 *
 * Matriz rol x endpoint (Tabla 3.1): consultar el calendario es de los dos
 * roles, pero crear, editar y eliminar eventos es exclusivo del Productor.
 */
exports.enrutadorEventos = (0, express_1.Router)();
exports.enrutadorEventos.use(autenticar_1.autenticar);
// RF_07 - Registrar evento
exports.enrutadorEventos.post('/', autorizar_1.soloProductor, controlador.crear);
// Listado del calendario - Productor y Trabajador
exports.enrutadorEventos.get('/', controlador.listar);
// RF_08 - Consultar detalle - Productor y Trabajador
exports.enrutadorEventos.get('/:id', controlador.detalle);
// RF_09 - Editar evento
exports.enrutadorEventos.patch('/:id', autorizar_1.soloProductor, controlador.editar);
// RF_10 - Eliminar evento (borrado logico)
exports.enrutadorEventos.delete('/:id', autorizar_1.soloProductor, controlador.eliminar);
//# sourceMappingURL=eventos.rutas.js.map