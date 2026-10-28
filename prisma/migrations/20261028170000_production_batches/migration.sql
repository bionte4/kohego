-- Collection logs, production batches, and packaged variant stock.
--
-- Apply after the livestock migration:
--   npx prisma migrate deploy
--
-- output_units = floor((raw_weight_kg * conversion_rate) / package_size).
-- Completing a batch lowers remaining_kg on waste_collection_logs and
-- raises product_variants.stock_on_hand by output_units.
-- The rate is a fraction of fresh weight (for example 0.8), not a 1:1 copy into a sak.
-- Rolling back drops these three tables. It does not change pens or animals.

CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'COMPLETED');

CREATE TABLE "waste_collection_logs" (
  "id" TEXT NOT NULL,
  "category" "LivestockSpecies" NOT NULL,
  "weightKg" DECIMAL(10,1) NOT NULL,
  "remainingKg" DECIMAL(10,1) NOT NULL,
  "collectedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "waste_collection_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_variants" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "family" TEXT NOT NULL,
  "packageSize" DECIMAL(8,2) NOT NULL,
  "unit" TEXT NOT NULL,
  "stockOnHand" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "production_batches" (
  "id" TEXT NOT NULL,
  "category" "LivestockSpecies" NOT NULL,
  "rawWeightKg" DECIMAL(10,1) NOT NULL,
  "conversionRate" DECIMAL(6,4) NOT NULL,
  "variantId" TEXT NOT NULL,
  "packageSize" DECIMAL(8,2) NOT NULL,
  "outputUnits" INTEGER NOT NULL,
  "status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "production_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "waste_collection_logs_category_collectedAt_idx"
  ON "waste_collection_logs"("category", "collectedAt");

CREATE INDEX "production_batches_category_status_idx"
  ON "production_batches"("category", "status");

ALTER TABLE "production_batches"
  ADD CONSTRAINT "production_batches_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
