import { safeProviderMessage } from "@/lib/social/errors";

const GRAPH_VERSION = "v21.0";

export const META_SCOPES: Record<"FACEBOOK" | "INSTAGRAM", string> = {
  FACEBOOK: "pages_show_list,pages_read_engagement,pages_manage_posts",
  INSTAGRAM: "pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish",
};

export function metaConfigured() {
  return Boolean(process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim());
}

export function metaAuthorizeUrl(platform: "FACEBOOK" | "INSTAGRAM", redirectUri: string, state: string) {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", required("META_APP_ID"));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES[platform]);
  return url.toString();
}

export async function exchangeMetaCode(code: string, redirectUri: string) {
  const shortLived = await metaTokenRequest({
    client_id: required("META_APP_ID"),
    client_secret: required("META_APP_SECRET"),
    redirect_uri: redirectUri,
    code,
  });
  return exchangeMetaLongLived(shortLived.accessToken);
}

/** Meta long-lived tokens are renewed by exchanging the current access token. */
export async function exchangeMetaLongLived(accessToken: string) {
  return metaTokenRequest({
    grant_type: "fb_exchange_token",
    client_id: required("META_APP_ID"),
    client_secret: required("META_APP_SECRET"),
    fb_exchange_token: accessToken,
  });
}

export async function fetchMetaAccount(platform: "FACEBOOK" | "INSTAGRAM", accessToken: string) {
  if (platform === "INSTAGRAM") {
    const pages = await graphGet<{
      data?: { name?: string; instagram_business_account?: { id?: string } }[];
    }>(accessToken, "me/accounts", { fields: "name,instagram_business_account{id,username}" });
    const page = pages.data?.find((item) => item.instagram_business_account?.id);
    const igId = page?.instagram_business_account?.id;
    if (!igId) {
      throw new Error("Tidak ada akun Instagram bisnis pada Halaman Facebook ini.");
    }
    const profile = await graphGet<{ id: string; username?: string }>(accessToken, igId, { fields: "id,username" });
    return { externalAccountId: profile.id, accountName: profile.username ? `@${profile.username}` : "Instagram" };
  }
  const me = await graphGet<{ id: string; name?: string }>(accessToken, "me", { fields: "id,name" });
  return { externalAccountId: me.id, accountName: me.name ?? "Facebook" };
}

async function metaTokenRequest(params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { method: "GET" });
  const body = (await response.json()) as { access_token?: string; expires_in?: number; error?: { message?: string } };
  if (!response.ok || !body.access_token) {
    throw new Error(safeProviderMessage(body.error?.message ?? "Meta menolak pertukaran token."));
  }
  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in ?? 60 * 24 * 60 * 60,
  };
}

async function graphGet<T>(accessToken: string, path: string, query: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url);
  const body = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok || body.error) {
    throw new Error(safeProviderMessage(body.error?.message ?? "Meta menolak permintaan profil."));
  }
  return body;
}

function required(name: "META_APP_ID" | "META_APP_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} belum diatur.`);
  return value;
}

