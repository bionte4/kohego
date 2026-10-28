-- Live animals, pens, and fresh manure batches.
--
-- Apply with the social_accounts migration already deployed:
--   npx prisma migrate deploy
--
-- mass_kg is fresh kohe still available, or the historical batch once status
-- is MASUK_PRODUKSI. Dry yield and POC liters per kilogram are application
-- rules, not stored here, because a kilogram of fresh manure is not a sak.
-- Rolling back drops pens, animals, and waste_batches.

CREATE TYPE "LivestockSpecies" AS ENUM ('SAPI', 'KAMBING', 'AYAM', 'BEBEK');

CREATE TYPE "AnimalSex" AS ENUM ('JANTAN', 'BETINA', 'CAMPURAN');

CREATE TYPE "AnimalHealth" AS ENUM ('SEHAT', 'PANTAU', 'SAKIT', 'KARANTINA', 'TERJUAL');

CREATE TYPE "WasteBatchStatus" AS ENUM ('TERSEDIA', 'MASUK_PRODUKSI');

CREATE TABLE "pens" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "species" "LivestockSpecies" NOT NULL,
  "location" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,

  CONSTRAINT "pens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "animals" (
  "id" TEXT NOT NULL,
  "earTag" TEXT NOT NULL,
  "species" "LivestockSpecies" NOT NULL,
  "breed" TEXT NOT NULL,
  "sex" "AnimalSex" NOT NULL,
  "birthDate" DATE NOT NULL,
  "weightKg" DECIMAL(8,1) NOT NULL,
  "headcount" INTEGER NOT NULL,
  "health" "AnimalHealth" NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "penId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "animals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "waste_batches" (
  "id" TEXT NOT NULL,
  "animalId" TEXT,
  "penId" TEXT NOT NULL,
  "species" "LivestockSpecies" NOT NULL,
  "massKg" DECIMAL(10,1) NOT NULL,
  "collectedAt" TIMESTAMP(3) NOT NULL,
  "status" "WasteBatchStatus" NOT NULL DEFAULT 'TERSEDIA',
  "note" TEXT NOT NULL DEFAULT '',

  CONSTRAINT "waste_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "animals_earTag_key" ON "animals"("earTag");

CREATE INDEX "animals_species_health_idx" ON "animals"("species", "health");

CREATE INDEX "waste_batches_species_status_idx" ON "waste_batches"("species", "status");

ALTER TABLE "animals"
  ADD CONSTRAINT "animals_penId_fkey" FOREIGN KEY ("penId") REFERENCES "pens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "waste_batches"
  ADD CONSTRAINT "waste_batches_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "waste_batches"
  ADD CONSTRAINT "waste_batches_penId_fkey" FOREIGN KEY ("penId") REFERENCES "pens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
