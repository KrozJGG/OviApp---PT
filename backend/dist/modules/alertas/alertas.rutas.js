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
exports.enrutadorVigilancia = exports.enrutadorAlertas = exports.enrutadorEdge = void 0;
const express_1 = require("express");
const autenticar_1 = require("../../middleware/autenticar");
const autenticarEdge_1 = require("../../middleware/autenticarEdge");
const controlador = __importStar(require("./alertas.controlador"));
/**
 * Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19).
 *
 * Son tres enrutadores porque conviven dos identidades distintas: el modulo
 * edge se autentica con su API key (IF5-ENT) y los usuarios con su JWT. Separar
 * los montajes evita que una ruta de consulta quede accesible con una API key
 * de dispositivo, o al reves.
 *
 * El modelo de vision por computadora corre en el dispositivo: aqui solo se
 * recibe la senal, se almacena, se notifica y se expone.
 */
// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/edge - ingesta del modulo de deteccion (API key)
// ─────────────────────────────────────────────────────────────────────────────
exports.enrutadorEdge = (0, express_1.Router)();
exports.enrutadorEdge.use(autenticarEdge_1.autenticarEdge);
// RF_17 + RF_18 - almacena la alerta y notifica al predio. Idempotente.
exports.enrutadorEdge.post('/alertas', controlador.ingestar);
// Latido de presencia; alimenta el indicador "en linea" de IF2-SAL.
exports.enrutadorEdge.post('/heartbeat', controlador.heartbeat);
// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/alertas - historial para la app (JWT)
// ─────────────────────────────────────────────────────────────────────────────
exports.enrutadorAlertas = (0, express_1.Router)();
exports.enrutadorAlertas.use(autenticar_1.autenticar);
// RF_19 - Productor y Trabajador; siempre acotado al predio de la sesion.
exports.enrutadorAlertas.get('/', controlador.listar);
exports.enrutadorAlertas.get('/:id', controlador.detalle);
exports.enrutadorAlertas.post('/:id/revisar', controlador.revisar);
// ─────────────────────────────────────────────────────────────────────────────
// /api/v1/vigilancia - estado del monitoreo (JWT)
// ─────────────────────────────────────────────────────────────────────────────
exports.enrutadorVigilancia = (0, express_1.Router)();
exports.enrutadorVigilancia.use(autenticar_1.autenticar);
// IF2-SAL - Productor y Trabajador.
exports.enrutadorVigilancia.get('/estado', controlador.estado);
//# sourceMappingURL=alertas.rutas.js.map