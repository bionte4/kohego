import type { SocialAccount } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/social/crypto";
import { getDb } from "@/lib/social/db";
import { safeProviderMessage } from "@/lib/social/errors";
import { exchangeMetaLongLived, fetchMetaAccount } from "@/lib/social/meta";
import { fetchTikTokAccount, refreshTikTokToken } from "@/lib/social/tiktok";
import {
  SOCIAL_PLATFORMS,
  type SocialAccountList,
  type SocialAccountView,
  type SocialConnectionState,
  type SocialPlatformName,
} from "@/lib/social/types";

const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface StoredOAuthGrant {
  platform: SocialPlatformName;
  externalAccountId: string;
  accountName: string;
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number;
  refreshExpiresInSec: number | null;
  scopes: string;
}

function placeholders(): SocialAccountView[] {
  return SOCIAL_PLATFORMS.map((platform) => ({
    id: null,
    platform,
    accountName: null,
    status: "DISCONNECTED",
    accessExpiresAt: null,
    canRefresh: false,
  }));
}

function deriveStatus(row: SocialAccount): SocialConnectionState {
  if (row.status === "DISCONNECTED" || !row.accessTokenEnc) return "DISCONNECTED";
  if (row.accessExpiresAt && row.accessExpiresAt.getTime() <= Date.now()) return "EXPIRED";
  return "CONNECTED";
}

function canRefresh(row: SocialAccount) {
  if (!row.accessTokenEnc || row.status === "DISCONNECTED") return false;
  if (row.platform === "TIKTOK") {
    if (!row.refreshTokenEnc) return false;
    if (row.refreshExpiresAt && row.refreshExpiresAt.getTime() <= Date.now()) return false;
    return true;
  }
  // Meta renews a long-lived token only while it is still valid.
  return Boolean(row.accessExpiresAt && row.accessExpiresAt.getTime() > Date.now());
}

function toView(row: SocialAccount): SocialAccountView {
  return {
    id: row.id,
    platform: row.platform,
    accountName: row.accountName,
    status: deriveStatus(row),
    accessExpiresAt: row.accessExpiresAt?.toISOString() ?? null,
    canRefresh: canRefresh(row),
  };
}

export async function listSocialAccounts(): Promise<SocialAccountList> {
  const db = getDb();
  if (!db) {
    return {
      configured: false,
      message: "DATABASE_URL belum diatur. Token tidak disimpan di browser.",
      accounts: placeholders(),
    };
  }
  try {
    const rows = await db.socialAccount.findMany({ orderBy: { platform: "asc" } });
    const known = new Set(rows.map((row) => row.platform));
    const missing = placeholders().filter((item) => !known.has(item.platform));
    return { configured: true, message: null, accounts: [...rows.map(toView), ...missing] };
  } catch {
    return {
      configured: false,
      message: "Database tidak dapat dihubungi. Periksa DATABASE_URL, lalu jalankan migrasi.",
      accounts: placeholders(),
    };
  }
}

export async function saveOAuthGrant(grant: StoredOAuthGrant) {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL belum diatur.");
  const accessExpiresAt = new Date(Date.now() + grant.expiresInSec * 1000);
  const refreshExpiresAt =
    grant.refreshExpiresInSec == null ? null : new Date(Date.now() + grant.refreshExpiresInSec * 1000);
  const data = {
    accountName: grant.accountName,
    accessTokenEnc: encryptSecret(grant.accessToken),
    refreshTokenEnc: grant.refreshToken ? encryptSecret(grant.refreshToken) : null,
    accessExpiresAt,
    refreshExpiresAt,
    scopes: grant.scopes,
    status: "CONNECTED" as const,
    lastRefreshAt: new Date(),
    lastError: null,
  };
  return db.socialAccount.upsert({
    where: {
      platform_externalAccountId: {
        platform: grant.platform,
        externalAccountId: grant.externalAccountId,
      },
    },
    create: {
      platform: grant.platform,
      externalAccountId: grant.externalAccountId,
      ...data,
    },
    update: data,
  });
}

/**
 * Returns a usable access token for server-side publishing.
 * Renews Meta and TikTok credentials when they are inside the skew window.
 * The token must not be sent to the browser.
 */
export async function ensureFreshAccessToken(accountId: string) {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL belum diatur.");
  const row = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!row?.accessTokenEnc || row.status === "DISCONNECTED") {
    throw new Error("Akun sosmed belum terhubung.");
  }
  const expiring =
    row.accessExpiresAt != null && row.accessExpiresAt.getTime() <= Date.now() + REFRESH_SKEW_MS;
  if (!expiring) return decryptSecret(row.accessTokenEnc);
  const refreshed = await refreshSocialAccount(accountId);
  if (refreshed.status !== "CONNECTED") {
    throw new Error(refreshed.message ?? "Token tidak dapat diperbarui.");
  }
  const next = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!next?.accessTokenEnc) throw new Error("Token tidak dapat diperbarui.");
  return decryptSecret(next.accessTokenEnc);
}

export async function refreshSocialAccount(accountId: string): Promise<SocialAccountView & { message: string | null }> {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL belum diatur.");
  const row = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!row) throw new Error("Akun tidak ditemukan.");
  if (!canRefresh(row)) {
    const view = row.accessTokenEnc ? toView(row) : { ...toView(row), status: "DISCONNECTED" as const };
    return { ...view, message: "Token harus dihubungkan ulang." };
  }
  try {
    const renewed = await renew(row);
    const updated = await db.socialAccount.update({
      where: { id: row.id },
      data: {
        accessTokenEnc: encryptSecret(renewed.accessToken),
        refreshTokenEnc: renewed.refreshToken ? encryptSecret(renewed.refreshToken) : row.refreshTokenEnc,
        accessExpiresAt: new Date(Date.now() + renewed.expiresInSec * 1000),
        refreshExpiresAt:
          renewed.refreshExpiresInSec == null
            ? row.refreshExpiresAt
            : new Date(Date.now() + renewed.refreshExpiresInSec * 1000),
        accountName: renewed.accountName ?? row.accountName,
        status: "CONNECTED",
        lastRefreshAt: new Date(),
        lastError: null,
      },
    });
    return { ...toView(updated), message: null };
  } catch (error) {
    const message = safeProviderMessage(error instanceof Error ? error.message : "Gagal memperbarui token.");
    const updated = await db.socialAccount.update({
      where: { id: row.id },
      data: { status: "EXPIRED", lastError: message },
    });
    return { ...toView(updated), message };
  }
}

export async function refreshExpiredAccounts() {
  const db = getDb();
  if (!db) return listSocialAccounts();
  const rows = await db.socialAccount.findMany();
  for (const row of rows) {
    const expiring =
      row.accessExpiresAt != null && row.accessExpiresAt.getTime() <= Date.now() + REFRESH_SKEW_MS;
    if (expiring && canRefresh(row)) {
      await refreshSocialAccount(row.id);
    }
  }
  return listSocialAccounts();
}

export async function disconnectSocialAccount(accountId: string) {
  const db = getDb();
  if (!db) throw new Error("DATABASE_URL belum diatur.");
  const updated = await db.socialAccount.update({
    where: { id: accountId },
    data: {
      accessTokenEnc: null,
      refreshTokenEnc: null,
      accessExpiresAt: null,
      refreshExpiresAt: null,
      status: "DISCONNECTED",
      lastError: null,
    },
  });
  return toView(updated);
}

async function renew(row: SocialAccount) {
  if (!row.accessTokenEnc) throw new Error("Token akses tidak ada.");
  if (row.platform === "TIKTOK") {
    if (!row.refreshTokenEnc) throw new Error("Refresh token TikTok tidak ada.");
    const next = await refreshTikTokToken(decryptSecret(row.refreshTokenEnc));
    const profile = await fetchTikTokAccount(next.accessToken);
    return {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      expiresInSec: next.expiresIn,
      refreshExpiresInSec: next.refreshExpiresIn,
      accountName: profile.accountName,
    };
  }
  const next = await exchangeMetaLongLived(decryptSecret(row.accessTokenEnc));
  const platform = row.platform === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK";
  const profile = await fetchMetaAccount(platform, next.accessToken);
  return {
    accessToken: next.accessToken,
    refreshToken: null,
    expiresInSec: next.expiresIn,
    refreshExpiresInSec: null,
    accountName: profile.accountName,
  };
}
