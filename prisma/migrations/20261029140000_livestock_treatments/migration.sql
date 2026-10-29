-- Planned vaccination, deworming, vitamin, and medical-care visits.
-- ear_tag_id is one animal or one poultry lot. Rolling back drops the table and enums.

CREATE TYPE "LivestockCareKind" AS ENUM ('VACCINATION', 'DEWORMING', 'VITAMIN', 'MEDICAL_CARE');

CREATE TYPE "LivestockCareStatus" AS ENUM ('PENDING', 'COMPLETED', 'OVERDUE');

CREATE TABLE "livestock_treatments" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "kind" "LivestockCareKind" NOT NULL,
  "scheduled_on" DATE NOT NULL,
  "staff_name" TEXT NOT NULL,
  "dosage" TEXT NOT NULL,
  "status" "LivestockCareStatus" NOT NULL DEFAULT 'PENDING',
  "completed_at" TIMESTAMP(3),
  "note" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "livestock_treatments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "livestock_treatments_ear_tag_id_scheduled_on_idx" ON "livestock_treatments"("ear_tag_id", "scheduled_on");

CREATE INDEX "livestock_treatments_status_scheduled_on_idx" ON "livestock_treatments"("status", "scheduled_on");

ALTER TABLE "livestock_treatments"
  ADD CONSTRAINT "livestock_treatments_ear_tag_id_fkey"
  FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;
