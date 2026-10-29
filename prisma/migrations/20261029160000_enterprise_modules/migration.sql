-- Lineage, feed conversion logs, compost mass balance, consignment suggestions,
-- field visits, veterinary checklist rules, and withdrawal holds.
-- Rolling back drops these tables. Existing animals, orders, and payroll rows stay.

CREATE TABLE "lineage_tracking" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "sire_tag" TEXT NOT NULL DEFAULT '',
  "dam_tag" TEXT NOT NULL DEFAULT '',
  "stage" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lineage_tracking_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lineage_tracking_ear_tag_id_key" ON "lineage_tracking"("ear_tag_id");

CREATE TABLE "livestock_weight_checks" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "weighed_on" DATE NOT NULL,
  "weight_kg" DECIMAL(8,1) NOT NULL,

  CONSTRAINT "livestock_weight_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "livestock_weight_checks_ear_tag_id_weighed_on_idx" ON "livestock_weight_checks"("ear_tag_id", "weighed_on");

CREATE TABLE "livestock_feed_logs" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "fed_on" DATE NOT NULL,
  "feed_kg" DECIMAL(8,1) NOT NULL,

  CONSTRAINT "livestock_feed_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "livestock_feed_logs_ear_tag_id_fed_on_idx" ON "livestock_feed_logs"("ear_tag_id", "fed_on");

CREATE TABLE "compost_runs" (
  "id" TEXT NOT NULL,
  "raw_kg" DECIMAL(10,1) NOT NULL,
  "carbon_percent" DECIMAL(5,2) NOT NULL,
  "nitrogen_percent" DECIMAL(5,2) NOT NULL,
  "cn_ratio" DECIMAL(6,1) NOT NULL,
  "loss_percent" DECIMAL(5,2) NOT NULL,
  "finished_kg" DECIMAL(10,1) NOT NULL,
  "peak_celsius" DECIMAL(4,1),
  "thermophilic_days" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "compost_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consignment_ledgers" (
  "id" TEXT NOT NULL,
  "partner_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "open_idr" INTEGER NOT NULL,
  "volume_kg" DECIMAL(12,3) NOT NULL,
  "discount_rate" DECIMAL(5,4) NOT NULL,
  "suggested_credit_idr" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "consignment_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consignment_ledgers_partner_id_period_key" ON "consignment_ledgers"("partner_id", "period");

CREATE TABLE "field_visits" (
  "id" TEXT NOT NULL,
  "partner_id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL DEFAULT '',
  "visited_at" TIMESTAMP(3) NOT NULL,
  "lat" DECIMAL(9,6),
  "lng" DECIMAL(9,6),
  "note" TEXT NOT NULL DEFAULT '',

  CONSTRAINT "field_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "field_visits_partner_id_visited_at_idx" ON "field_visits"("partner_id", "visited_at");

CREATE TABLE "veterinary_rules" (
  "id" TEXT NOT NULL,
  "symptom" TEXT NOT NULL,
  "protocol_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,

  CONSTRAINT "veterinary_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "veterinary_rules_symptom_idx" ON "veterinary_rules"("symptom");

CREATE TABLE "withdrawal_holds" (
  "id" TEXT NOT NULL,
  "ear_tag_id" TEXT NOT NULL,
  "medicine_name" TEXT NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "until_on" DATE NOT NULL,
  "released_at" TIMESTAMP(3),

  CONSTRAINT "withdrawal_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "withdrawal_holds_ear_tag_id_until_on_idx" ON "withdrawal_holds"("ear_tag_id", "until_on");

ALTER TABLE "lineage_tracking" ADD CONSTRAINT "lineage_tracking_ear_tag_id_fkey" FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "livestock_weight_checks" ADD CONSTRAINT "livestock_weight_checks_ear_tag_id_fkey" FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "livestock_feed_logs" ADD CONSTRAINT "livestock_feed_logs_ear_tag_id_fkey" FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "withdrawal_holds" ADD CONSTRAINT "withdrawal_holds_ear_tag_id_fkey" FOREIGN KEY ("ear_tag_id") REFERENCES "animals"("earTag") ON DELETE CASCADE ON UPDATE CASCADE;
