"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esquemaLogout = exports.esquemaRefresh = exports.esquemaLogin = void 0;
const zod_1 = require("zod");
exports.esquemaLogin = zod_1.z.object({
    email: zod_1.z.email('Ingresa un correo electrónico válido.').trim().toLowerCase(),
    password: zod_1.z.string().min(1, 'Ingresa tu contraseña.'),
});
exports.esquemaRefresh = zod_1.z.object({
    refreshToken: zod_1.z.string().min(20, 'El token de sesión no es válido.'),
});
exports.esquemaLogout = zod_1.z.object({
    refreshToken: zod_1.z.string().min(20).optional(),
});
//# sourceMappingURL=auth.esquemas.js.map