-- Eliminacion definitiva de un animal del rebano.
--
-- La baja (RF_04) sigue siendo un cambio de estado, y es el camino por defecto.
-- Esta migracion habilita la segunda opcion que se le ofrece al Productor
-- despues de registrarla: sacar al animal de la base por completo.
--
-- Todo lo que cuelga del animal se va con el, en cascada desde la propia base,
-- para que no quede bitacora ni vinculos huerfanos por ningun camino (API,
-- script o consola).

ALTER TABLE "bitacora_entrada"
  DROP CONSTRAINT "bitacora_entrada_id_animal_fkey",
  ADD CONSTRAINT "bitacora_entrada_id_animal_fkey"
    FOREIGN KEY ("id_animal") REFERENCES "animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "evento_animal"
  DROP CONSTRAINT "evento_animal_id_animal_fkey",
  ADD CONSTRAINT "evento_animal_id_animal_fkey"
    FOREIGN KEY ("id_animal") REFERENCES "animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tarea_animal"
  DROP CONSTRAINT "tarea_animal_id_animal_fkey",
  ADD CONSTRAINT "tarea_animal_id_animal_fkey"
    FOREIGN KEY ("id_animal") REFERENCES "animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RF_06 - la bitacora sigue siendo append-only: la unica excepcion es la
-- cascada de arriba. El trigger la reconoce porque, cuando se dispara por una
-- accion referencial, la fila del animal ya no existe en la transaccion; un
-- DELETE directo sobre la bitacora encuentra al animal en su sitio y se rechaza
-- igual que antes.
CREATE OR REPLACE FUNCTION bitacora_append_only() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM "animal" WHERE id = OLD.id_animal) THEN
      RAISE EXCEPTION 'RF_06: las entradas de bitacora no pueden eliminarse (entrada %)', OLD.id
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN OLD;
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
