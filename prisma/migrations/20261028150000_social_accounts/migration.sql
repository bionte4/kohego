-- KoheGo social account credentials.
--
-- Apply:
--   1. Copy .env.example to .env and set DATABASE_URL.
--   2. Create TOKEN_ENCRYPTION_KEY with: openssl rand -base64 32
--   3. Set META_APP_ID, META_APP_SECRET, TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
--   4. Register the OAuth redirect URLs:
--        {origin}/api/social-accounts/oauth/INSTAGRAM/callback
--        {origin}/api/social-accounts/oauth/FACEBOOK/callback
--        {origin}/api/social-accounts/oauth/TIKTOK/callback
--   5. npx prisma migrate deploy
--
-- access_token_enc and refresh_token_enc store AES-256-GCM ciphertext only.
-- Rolling back this migration drops social_accounts and every stored credential.

CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'TIKTOK');

CREATE TYPE "SocialConnectionStatus" AS ENUM ('CONNECTED', 'EXPIRED', 'DISCONNECTED');

CREATE TABLE "social_accounts" (
  "id" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "accountName" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL,
  "accessTokenEnc" TEXT,
  "refreshTokenEnc" TEXT,
  "accessExpiresAt" TIMESTAMP(3),
  "refreshExpiresAt" TIMESTAMP(3),
  "scopes" TEXT NOT NULL DEFAULT '',
  "status" "SocialConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "lastRefreshAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "social_accounts_platform_externalAccountId_key"
  ON "social_accounts"("platform", "externalAccountId");

CREATE INDEX "social_accounts_platform_status_idx"
  ON "social_accounts"("platform", "status");
