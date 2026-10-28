-- Shared company books. Each row is one ledger (sales, livestock, publisher, or users).
-- revision starts at 1. A save is accepted only when the caller still holds that revision.

CREATE TABLE "ledgers" (
    "key" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledgers_pkey" PRIMARY KEY ("key")
);
