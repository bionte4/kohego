-- Simulated health checks linked to an animal ear tag.
--
-- ear_tag_id references animals.earTag. A log is stored only when that
-- animal row already exists. The device herd book remains the working copy
-- when the row is absent.
-- Rolling back drops livestock_health_logs and the two new enum types.

CREATE TYPE "HealthCheckStatus" AS ENUM ('HEALTHY', 'OBSERVATION', 'QUARANTINE', 'SICK');

CREATE TYPE "HealthRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "livestock_health_logs" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "checked_at" TIMESTAMP(3) NOT NULL,
  "status" "HealthCheckStatus" NOT NULL,
  "temperature_c" DECIMAL(4,1) NOT NULL,
  "activity_level" INTEGER NOT NULL,
  "symptoms" TEXT NOT NULL DEFAULT '',
  "risk_level" "HealthRiskLevel" NOT NULL,
  "score" INTEGER NOT NULL,
  "diagnostic_note" TEXT NOT NULL,
  "treatment" TEXT NOT NULL,
  "manual" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "livestock_health_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "livestock_health_logs_ear_tag_id_checked_at_idx" ON "livestock_health_logs"("ear_tag_id", "checked_at");

ALTER TABLE "livestock_health_logs"
  ADD CONSTRAINT "livestock_health_logs_ear_tag_id_fkey"
  FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;
