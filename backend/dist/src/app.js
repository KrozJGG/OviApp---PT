"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREFIJO_API = void 0;
exports.crearApp = crearApp;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const pino_http_1 = __importDefault(require("pino-http"));
const env_1 = require("./config/env");
const logger_1 = require("./config/logger");
const manejadorErrores_1 = require("./middleware/manejadorErrores");
const agenda_rutas_1 = require("./modules/agenda/agenda.rutas");
const alertas_rutas_1 = require("./modules/alertas/alertas.rutas");
const animales_rutas_1 = require("./modules/animales/animales.rutas");
const auth_rutas_1 = require("./modules/auth/auth.rutas");
const bitacora_rutas_1 = require("./modules/bitacora/bitacora.rutas");
const eventos_rutas_1 = require("./modules/eventos/eventos.rutas");
const dispositivos_rutas_1 = require("./modules/notificaciones/dispositivos.rutas");
const tareas_rutas_1 = require("./modules/tareas/tareas.rutas");
const usuarios_rutas_1 = require("./modules/usuarios/usuarios.rutas");
exports.PREFIJO_API = '/api/v1';
function crearApp() {
    const app = (0, express_1.default)();
    // Detras de un proxy (Railway, Render, Nginx) para que el rate-limit y los
    // logs vean la IP real del cliente y no la del balanceador.
    app.set('trust proxy', 1);
    app.use((0, helmet_1.default)());
    app.use((0, cors_1.default)({
        origin: env_1.env.CORS_ORIGINS === '*' ? true : env_1.env.CORS_ORIGINS.split(',').map((o) => o.trim()),
        credentials: true,
    }));
    app.use(express_1.default.json({ limit: '1mb' }));
    if (!env_1.esTest) {
        app.use((0, pino_http_1.default)({ logger: logger_1.logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
    }
    app.get('/health', (_req, res) => {
        res.json({ estado: 'ok', servicio: 'oviapp-api', entorno: env_1.env.NODE_ENV });
    });
    const api = express_1.default.Router();
    // Sesion y perfil (IF6-ENT, H13)
    api.use('/auth', auth_rutas_1.enrutadorAuth);
    api.use('/dispositivos-push', dispositivos_rutas_1.enrutadorDispositivosPush);
    // Modulo 7 - Administracion (RF_20 a RF_22)
    api.use('/usuarios', usuarios_rutas_1.enrutadorUsuarios);
    // Modulo 1 - Ficha Animal (RF_01 a RF_04)
    api.use('/animales', animales_rutas_1.enrutadorAnimales);
    // Modulo 2 - Bitacora (RF_05, RF_06). Comparte prefijo: sus rutas llevan un
    // segmento extra (/:idAnimal/bitacora), asi que no colisionan con las de arriba.
    api.use('/animales', bitacora_rutas_1.enrutadorBitacora);
    // Modulo 3 - Organizador de eventos (RF_07 a RF_10)
    api.use('/eventos', eventos_rutas_1.enrutadorEventos);
    // Modulo 4 - Planificacion de actividades (RF_11 a RF_14)
    api.use('/tareas', tareas_rutas_1.enrutadorTareas);
    // Modulo 5 - Pantalla de inicio y calendario (RF_15, RF_16)
    api.use('/inicio', agenda_rutas_1.enrutadorInicio);
    api.use('/agenda', agenda_rutas_1.enrutadorAgenda);
    // Modulo 6 - Vigilancia y deteccion (RF_17 a RF_19)
    api.use('/edge', alertas_rutas_1.enrutadorEdge);
    api.use('/alertas', alertas_rutas_1.enrutadorAlertas);
    api.use('/vigilancia', alertas_rutas_1.enrutadorVigilancia);
    app.use(exports.PREFIJO_API, api);
    app.use(manejadorErrores_1.noEncontrado);
    app.use(manejadorErrores_1.manejadorErrores);
    return app;
}
//# sourceMappingURL=app.js.map