-- Treatment cases opened from a health check.
--
-- ear_tag_id references animals.earTag. doses stores the medicines the
-- keeper recorded. The device herd book stays the working copy when the
-- animal row is not in Postgres yet.
-- Rolling back drops livestock_treatment_cases and TreatmentCaseStatus.

CREATE TYPE "TreatmentCaseStatus" AS ENUM ('TERBUKA', 'SELESAI');

CREATE TABLE "livestock_treatment_cases" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "health_log_id" TEXT NOT NULL,
  "protocol_id" TEXT NOT NULL,
  "status" "TreatmentCaseStatus" NOT NULL DEFAULT 'TERBUKA',
  "opened_at" TIMESTAMP(3) NOT NULL,
  "closed_at" TIMESTAMP(3),
  "doses" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "livestock_treatment_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "livestock_treatment_cases_ear_tag_id_status_idx" ON "livestock_treatment_cases"("ear_tag_id", "status");

ALTER TABLE "livestock_treatment_cases"
  ADD CONSTRAINT "livestock_treatment_cases_ear_tag_id_fkey"
  FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;
