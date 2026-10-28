-- Staff passwords. Only the scrypt hash is stored. The browser never receives it.

CREATE TABLE "login_credentials" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "login_credentials_email_key" ON "login_credentials"("email");
