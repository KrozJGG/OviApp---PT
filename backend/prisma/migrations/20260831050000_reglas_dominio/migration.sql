-- Reglas de dominio que el schema de Prisma no puede expresar.
-- Se aplican en la base para que ningun camino (API, script, consola) pueda
-- dejar datos que contradigan los requerimientos.

-- ─────────────────────────────────────────────────────────────────────────────
-- RF_04 - la baja de un animal es atomica: o esta activo y sin datos de baja,
-- o esta inactivo y con motivo y fecha. No existe un estado intermedio.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "animal"
  ADD CONSTRAINT "ck_animal_baja" CHECK (
    (estado = 'ACTIVO'   AND motivo_baja IS NULL     AND fecha_baja IS NULL)
    OR
    (estado = 'INACTIVO' AND motivo_baja IS NOT NULL AND fecha_baja IS NOT NULL)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RF_06 - las entradas de bitacora son de solo lectura.
--
-- El borrado queda prohibido siempre. La edicion se permite unicamente sobre los
-- campos que RF_09 y RF_10 obligan a reconciliar cuando el evento de origen se
-- edita o se elimina (titulo, descripcion, fecha del evento y la marca
-- "evento eliminado"). El contenido historico -- que animal, de que tipo, quien
-- la origino y con que datos -- es inmutable.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION bitacora_append_only() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RF_06: las entradas de bitacora no pueden eliminarse (entrada %)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.id            IS DISTINCT FROM OLD.id
     OR NEW.id_animal  IS DISTINCT FROM OLD.id_animal
     OR NEW.id_usuario IS DISTINCT FROM OLD.id_usuario
     OR NEW.tipo       IS DISTINCT FROM OLD.tipo
     OR NEW.datos      IS DISTINCT FROM OLD.datos
     OR NEW.id_evento  IS DISTINCT FROM OLD.id_evento
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'RF_06: el contenido historico de una entrada de bitacora es inmutable (entrada %)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bitacora_append_only
  BEFORE UPDATE OR DELETE ON "bitacora_entrada"
  FOR EACH ROW EXECUTE FUNCTION bitacora_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- RF_02 / mockup 03 - la busqueda del listado de rebano es por prefijo del
-- numero de oreja ("Buscar por N de oreja..."). Un indice text_pattern_ops es
-- el que puede servir a LIKE 'valor%'.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX "ix_animal_oreja_prefijo"
  ON "animal" (id_predio, numero_oreja text_pattern_ops);
