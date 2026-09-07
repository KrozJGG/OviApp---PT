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
exports.enrutadorUsuarios = void 0;
const express_1 = require("express");
const autenticar_1 = require("../../middleware/autenticar");
const autorizar_1 = require("../../middleware/autorizar");
const controlador = __importStar(require("./usuarios.controlador"));
/**
 * Modulo 7 - Administracion (RF_20, RF_21, RF_22).
 *
 * Toda la gestion de usuarios es exclusiva del Productor: es quien administra
 * el personal del predio (Tabla 3.1 de la tesis). El Trabajador recibe 403 en
 * cualquiera de estas rutas.
 *
 * No hay DELETE: RF_22 inhabilita, no borra, para conservar el historico de
 * quien registro cada animal, nota y tarea.
 */
exports.enrutadorUsuarios = (0, express_1.Router)();
exports.enrutadorUsuarios.use(autenticar_1.autenticar);
// RF_20 - Registrar nuevo usuario
exports.enrutadorUsuarios.post('/', autorizar_1.soloProductor, controlador.crear);
exports.enrutadorUsuarios.get('/', autorizar_1.soloProductor, controlador.listar);
exports.enrutadorUsuarios.get('/:id', autorizar_1.soloProductor, controlador.obtener);
// RF_21 - Editar informacion de usuario
exports.enrutadorUsuarios.patch('/:id', autorizar_1.soloProductor, controlador.editar);
// RF_22 - Inhabilitar usuario
exports.enrutadorUsuarios.post('/:id/inhabilitar', autorizar_1.soloProductor, controlador.inhabilitar);
//# sourceMappingURL=usuarios.rutas.js.map