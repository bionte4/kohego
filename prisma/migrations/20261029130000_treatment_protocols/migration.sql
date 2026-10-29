-- Expert treatment protocols and the medical history written when a keeper applies one.
-- The assistant fills treatment_protocols from the catalog on first use.
-- Rolling back drops both tables.

CREATE TABLE "treatment_protocols" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "symptoms" TEXT NOT NULL DEFAULT '',
  "routine" BOOLEAN NOT NULL DEFAULT false,
  "summary" TEXT NOT NULL,
  "isolation" TEXT NOT NULL,
  "medicines" JSONB NOT NULL,
  "steps" JSONB NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "treatment_protocols_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "livestock_medical_history" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "health_log_id" TEXT NOT NULL DEFAULT '',
  "protocol_id" TEXT NOT NULL,
  "protocol_name" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "isolation" TEXT NOT NULL,
  "applied_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "livestock_medical_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "livestock_medical_history_ear_tag_id_applied_at_idx" ON "livestock_medical_history"("ear_tag_id", "applied_at");

ALTER TABLE "livestock_medical_history"
  ADD CONSTRAINT "livestock_medical_history_ear_tag_id_fkey"
  FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;
