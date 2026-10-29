-- Monthly payroll for one staff account.
-- Net pay is base salary plus sales commission plus herd bonus, minus deductions.
-- user_id points at login_credentials. Rolling back drops the table and the status enum.

CREATE TYPE "PayrollStatus" AS ENUM ('PENDING', 'PAID');

CREATE TABLE "payroll_records" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "base_salary_idr" INTEGER NOT NULL,
  "commission_idr" INTEGER NOT NULL,
  "bonus_idr" INTEGER NOT NULL,
  "deductions_idr" INTEGER NOT NULL,
  "net_pay_idr" INTEGER NOT NULL,
  "tonnage_kg" DECIMAL(12,3) NOT NULL,
  "order_count" INTEGER NOT NULL,
  "health_heads" INTEGER NOT NULL,
  "status" "PayrollStatus" NOT NULL DEFAULT 'PENDING',
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payroll_records_user_id_period_key" ON "payroll_records"("user_id", "period");

CREATE INDEX "payroll_records_period_status_idx" ON "payroll_records"("period", "status");

ALTER TABLE "payroll_records"
  ADD CONSTRAINT "payroll_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "login_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
