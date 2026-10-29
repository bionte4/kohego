-- ICAR RFID registry and label withdrawal reference.
-- Rolling back drops these tables. Existing animals and withdrawal holds stay.
-- Residue limits are not stored as mg/kg. withdrawal_days 0 means the keeper copies the label.

CREATE TABLE "livestock_registry" (
  "ear_tag_id" TEXT NOT NULL,
  "rfid_tag" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "livestock_registry_pkey" PRIMARY KEY ("ear_tag_id")
);

CREATE UNIQUE INDEX "livestock_registry_rfid_tag_key" ON "livestock_registry"("rfid_tag");

CREATE TABLE "pharmacology_standards" (
  "id" TEXT NOT NULL,
  "medicine_name" TEXT NOT NULL,
  "species" TEXT NOT NULL DEFAULT 'semua',
  "withdrawal_days" INTEGER NOT NULL,
  "blocks_harvest" BOOLEAN NOT NULL DEFAULT true,
  "blocks_manure" BOOLEAN NOT NULL DEFAULT true,
  "residue_note" TEXT NOT NULL,

  CONSTRAINT "pharmacology_standards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pharmacology_standards_medicine_name_species_key" ON "pharmacology_standards"("medicine_name", "species");

ALTER TABLE "livestock_registry" ADD CONSTRAINT "livestock_registry_ear_tag_id_fkey" FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "pharmacology_standards" ("id", "medicine_name", "species", "withdrawal_days", "blocks_harvest", "blocks_manure", "residue_note") VALUES
  ('std-elektrolit', 'Elektrolit oral', 'semua', 0, true, true, 'Batas residu (MRL) mengikuti angka pada label produk dan ketetapan otoritas yang berlaku. Aplikasi mengunci hari henti obat dan tidak menghitung mg/kg.'),
  ('std-antiseptik', 'Antiseptik luka luar', 'semua', 0, true, true, 'Batas residu (MRL) mengikuti angka pada label produk dan ketetapan otoritas yang berlaku. Aplikasi mengunci hari henti obat dan tidak menghitung mg/kg.');
