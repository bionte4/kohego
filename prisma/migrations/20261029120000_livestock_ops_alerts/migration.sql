-- Alert row when a normalized animal becomes sick or quarantined.
-- The herd book still drives the dashboard. This trigger covers the same
-- status change when that animal row is updated in Postgres.
-- Rolling back drops the trigger, the function, and livestock_ops_alerts.

CREATE TABLE "livestock_ops_alerts" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "health" "AnimalHealth" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "livestock_ops_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "livestock_ops_alerts_ear_tag_id_created_at_idx" ON "livestock_ops_alerts"("ear_tag_id", "created_at");

ALTER TABLE "livestock_ops_alerts"
  ADD CONSTRAINT "livestock_ops_alerts_ear_tag_id_fkey"
  FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION notify_livestock_health_hold()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.health IN ('KARANTINA', 'SAKIT') AND (TG_OP = 'INSERT' OR OLD.health IS DISTINCT FROM NEW.health) THEN
    INSERT INTO "livestock_ops_alerts" ("id", "ear_tag_id", "health", "created_at")
    VALUES (gen_random_uuid()::text, NEW."earTag", NEW.health, CURRENT_TIMESTAMP);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "animals_health_hold"
AFTER INSERT OR UPDATE OF "health" ON "animals"
FOR EACH ROW
EXECUTE FUNCTION notify_livestock_health_hold();
