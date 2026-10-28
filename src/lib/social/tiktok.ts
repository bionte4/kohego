import { safeProviderMessage } from "@/lib/social/errors";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/";

export function tiktokConfigured() {
  return Boolean(process.env.TIKTOK_CLIENT_KEY?.trim() && process.env.TIKTOK_CLIENT_SECRET?.trim());
}

export function tiktokAuthorizeUrl(redirectUri: string, state: string) {
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", required("TIKTOK_CLIENT_KEY"));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user.info.basic,video.publish");
  return url.toString();
}

export async function exchangeTikTokCode(code: string, redirectUri: string) {
  return tiktokToken({
    client_key: required("TIKTOK_CLIENT_KEY"),
    client_secret: required("TIKTOK_CLIENT_SECRET"),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
}

export async function refreshTikTokToken(refreshToken: string) {
  return tiktokToken({
    client_key: required("TIKTOK_CLIENT_KEY"),
    client_secret: required("TIKTOK_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function fetchTikTokAccount(accessToken: string) {
  const url = new URL(USER_INFO_URL);
  url.searchParams.set("fields", "open_id,display_name");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as {
    data?: { user?: { open_id?: string; display_name?: string } };
    error?: { message?: string; code?: string };
  };
  const user = body.data?.user;
  if (!response.ok || !user?.open_id) {
    throw new Error(safeProviderMessage(body.error?.message ?? "TikTok menolak permintaan profil."));
  }
  return { externalAccountId: user.open_id, accountName: user.display_name ?? "TikTok" };
}

async function tiktokToken(fields: Record<string, string>) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const body = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !body.access_token) {
    throw new Error(safeProviderMessage(body.error_description ?? body.error ?? "TikTok menolak token."));
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresIn: body.expires_in ?? 86400,
    refreshExpiresIn: body.refresh_expires_in ?? null,
  };
}

function required(name: "TIKTOK_CLIENT_KEY" | "TIKTOK_CLIENT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum diatur.`);
  return value;
}
