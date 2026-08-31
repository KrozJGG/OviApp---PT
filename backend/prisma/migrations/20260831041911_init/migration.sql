-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('PRODUCTOR', 'TRABAJADOR');

-- CreateEnum
CREATE TYPE "estado_usuario" AS ENUM ('HABILITADO', 'INHABILITADO');

-- CreateEnum
CREATE TYPE "plataforma" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "sexo_animal" AS ENUM ('MACHO', 'HEMBRA');

-- CreateEnum
CREATE TYPE "estado_animal" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateEnum
CREATE TYPE "motivo_baja" AS ENUM ('VENTA', 'MUERTE', 'FAENA');

-- CreateEnum
CREATE TYPE "tipo_evento" AS ENUM ('ENCASTE', 'ESQUILA', 'ATENCION_SANITARIA', 'OTRO');

-- CreateEnum
CREATE TYPE "estado_evento" AS ENUM ('PROGRAMADO', 'REALIZADO', 'ELIMINADO');

-- CreateEnum
CREATE TYPE "estado_tarea" AS ENUM ('ACTIVA', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "tipo_bitacora" AS ENUM ('ALTA', 'MODIFICACION', 'BAJA', 'EVENTO', 'NOTA');

-- CreateEnum
CREATE TYPE "tipo_alerta" AS ENUM ('CONTEO', 'DISPERSION', 'AMENAZA');

-- CreateEnum
CREATE TYPE "nivel_alerta" AS ENUM ('INFO', 'ADVERTENCIA', 'CRITICA');

-- CreateEnum
CREATE TYPE "estado_alerta" AS ENUM ('NUEVA', 'REVISADA');

-- CreateTable
CREATE TABLE "predio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "ubicacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "predio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_predio" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "rut" TEXT,
    "telefono" TEXT,
    "email" TEXT NOT NULL,
    "foto_url" TEXT,
    "password_hash" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL DEFAULT 'TRABAJADOR',
    "estado" "estado_usuario" NOT NULL DEFAULT 'HABILITADO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivo_usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "token_push" TEXT NOT NULL,
    "plataforma" "plataforma" NOT NULL,
    "ultimo_uso" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_usuario" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocado_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_predio" UUID NOT NULL,
    "numero_oreja" TEXT NOT NULL,
    "id_registrador" UUID NOT NULL,
    "sexo" "sexo_animal" NOT NULL,
    "raza" TEXT,
    "color" TEXT,
    "peso_kg" DECIMAL(6,2),
    "fecha_nacimiento" DATE,
    "descripcion" TEXT,
    "estado" "estado_animal" NOT NULL DEFAULT 'ACTIVO',
    "motivo_baja" "motivo_baja",
    "fecha_baja" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacora_entrada" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_animal" UUID NOT NULL,
    "id_usuario" UUID,
    "tipo" "tipo_bitacora" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "datos" JSONB,
    "id_evento" UUID,
    "evento_eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_evento" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacora_entrada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_predio" UUID NOT NULL,
    "id_creador" UUID NOT NULL,
    "tipo" "tipo_evento" NOT NULL,
    "descripcion" TEXT,
    "fecha_inicio" TIMESTAMPTZ(6) NOT NULL,
    "estado" "estado_evento" NOT NULL DEFAULT 'PROGRAMADO',
    "eliminado_en" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_animal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_evento" UUID NOT NULL,
    "id_animal" UUID NOT NULL,

    CONSTRAINT "evento_animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_predio" UUID NOT NULL,
    "id_creador" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fecha_limite" DATE NOT NULL,
    "estado" "estado_tarea" NOT NULL DEFAULT 'ACTIVA',
    "completada_en" TIMESTAMPTZ(6),
    "id_completada_por" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea_usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_tarea" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,

    CONSTRAINT "tarea_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarea_animal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_tarea" UUID NOT NULL,
    "id_animal" UUID NOT NULL,

    CONSTRAINT "tarea_animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispositivo_edge" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_predio" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "api_key_hash" TEXT NOT NULL,
    "api_key_prefijo" TEXT NOT NULL,
    "ultimo_heartbeat" TIMESTAMPTZ(6),
    "ultimo_conteo" INTEGER,
    "conteo_esperado" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_edge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "id_predio" UUID NOT NULL,
    "id_dispositivo_edge" UUID,
    "tipo_alerta" "tipo_alerta" NOT NULL,
    "descripcion" TEXT,
    "nivel" "nivel_alerta" NOT NULL DEFAULT 'ADVERTENCIA',
    "conteo_animales" INTEGER,
    "conteo_esperado" INTEGER,
    "fecha_hora" TIMESTAMPTZ(6) NOT NULL,
    "estado" "estado_alerta" NOT NULL DEFAULT 'NUEVA',
    "id_revisado_por" UUID,
    "fecha_revision" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "usuario_id_predio_estado_idx" ON "usuario"("id_predio", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_usuario_token_push_key" ON "dispositivo_usuario"("token_push");

-- CreateIndex
CREATE INDEX "dispositivo_usuario_id_usuario_idx" ON "dispositivo_usuario"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_token_hash_key" ON "refresh_token"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_token_id_usuario_idx" ON "refresh_token"("id_usuario");

-- CreateIndex
CREATE INDEX "animal_id_predio_estado_idx" ON "animal"("id_predio", "estado");

-- CreateIndex
CREATE INDEX "animal_id_predio_numero_oreja_idx" ON "animal"("id_predio", "numero_oreja");

-- CreateIndex
CREATE UNIQUE INDEX "uq_animal_oreja" ON "animal"("id_predio", "numero_oreja");

-- CreateIndex
CREATE INDEX "bitacora_entrada_id_animal_fecha_evento_idx" ON "bitacora_entrada"("id_animal", "fecha_evento" DESC);

-- CreateIndex
CREATE INDEX "bitacora_entrada_id_evento_idx" ON "bitacora_entrada"("id_evento");

-- CreateIndex
CREATE INDEX "evento_id_predio_fecha_inicio_idx" ON "evento"("id_predio", "fecha_inicio");

-- CreateIndex
CREATE INDEX "evento_id_predio_estado_idx" ON "evento"("id_predio", "estado");

-- CreateIndex
CREATE INDEX "evento_animal_id_animal_idx" ON "evento_animal"("id_animal");

-- CreateIndex
CREATE UNIQUE INDEX "uq_evento_animal" ON "evento_animal"("id_evento", "id_animal");

-- CreateIndex
CREATE INDEX "tarea_id_predio_fecha_limite_idx" ON "tarea"("id_predio", "fecha_limite");

-- CreateIndex
CREATE INDEX "tarea_id_predio_estado_idx" ON "tarea"("id_predio", "estado");

-- CreateIndex
CREATE INDEX "tarea_usuario_id_usuario_idx" ON "tarea_usuario"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tarea_usuario" ON "tarea_usuario"("id_tarea", "id_usuario");

-- CreateIndex
CREATE INDEX "tarea_animal_id_animal_idx" ON "tarea_animal"("id_animal");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tarea_animal" ON "tarea_animal"("id_tarea", "id_animal");

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_edge_api_key_prefijo_key" ON "dispositivo_edge"("api_key_prefijo");

-- CreateIndex
CREATE INDEX "dispositivo_edge_id_predio_idx" ON "dispositivo_edge"("id_predio");

-- CreateIndex
CREATE INDEX "alerta_id_predio_fecha_hora_idx" ON "alerta"("id_predio", "fecha_hora" DESC);

-- CreateIndex
CREATE INDEX "alerta_id_predio_estado_idx" ON "alerta"("id_predio", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "uq_alerta_edge" ON "alerta"("id_dispositivo_edge", "fecha_hora", "tipo_alerta");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_predio_fkey" FOREIGN KEY ("id_predio") REFERENCES "predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo_usuario" ADD CONSTRAINT "dispositivo_usuario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_id_predio_fkey" FOREIGN KEY ("id_predio") REFERENCES "predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal" ADD CONSTRAINT "animal_id_registrador_fkey" FOREIGN KEY ("id_registrador") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_entrada" ADD CONSTRAINT "bitacora_entrada_id_animal_fkey" FOREIGN KEY ("id_animal") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_entrada" ADD CONSTRAINT "bitacora_entrada_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bitacora_entrada" ADD CONSTRAINT "bitacora_entrada_id_evento_fkey" FOREIGN KEY ("id_evento") REFERENCES "evento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_id_predio_fkey" FOREIGN KEY ("id_predio") REFERENCES "predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento" ADD CONSTRAINT "evento_id_creador_fkey" FOREIGN KEY ("id_creador") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_animal" ADD CONSTRAINT "evento_animal_id_evento_fkey" FOREIGN KEY ("id_evento") REFERENCES "evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_animal" ADD CONSTRAINT "evento_animal_id_animal_fkey" FOREIGN KEY ("id_animal") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_id_predio_fkey" FOREIGN KEY ("id_predio") REFERENCES "predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_id_creador_fkey" FOREIGN KEY ("id_creador") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea" ADD CONSTRAINT "tarea_id_completada_por_fkey" FOREIGN KEY ("id_completada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_usuario" ADD CONSTRAINT "tarea_usuario_id_tarea_fkey" FOREIGN KEY ("id_tarea") REFERENCES "tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_usuario" ADD CONSTRAINT "tarea_usuario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_animal" ADD CONSTRAINT "tarea_animal_id_tarea_fkey" FOREIGN KEY ("id_tarea") REFERENCES "tarea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarea_animal" ADD CONSTRAINT "tarea_animal_id_animal_fkey" FOREIGN KEY ("id_animal") REFERENCES "animal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispositivo_edge" ADD CONSTRAINT "dispositivo_edge_id_predio_fkey" FOREIGN KEY ("id_predio") REFERENCES "predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_id_predio_fkey" FOREIGN KEY ("id_predio") REFERENCES "predio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_id_dispositivo_edge_fkey" FOREIGN KEY ("id_dispositivo_edge") REFERENCES "dispositivo_edge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_id_revisado_por_fkey" FOREIGN KEY ("id_revisado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
