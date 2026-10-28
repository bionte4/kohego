import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { saveOAuthGrant } from "@/lib/social/accounts";
import {
  exchangeMetaCode,
  fetchMetaAccount,
  metaAuthorizeUrl,
  metaConfigured,
  META_SCOPES,
} from "@/lib/social/meta";
import {
  exchangeTikTokCode,
  fetchTikTokAccount,
  tiktokAuthorizeUrl,
  tiktokConfigured,
} from "@/lib/social/tiktok";
import { isSocialPlatform, type SocialPlatformName } from "@/lib/social/types";

const OAUTH_COOKIE = "kohego_oauth_state";

export function oauthCallbackUrl(origin: string, platform: SocialPlatformName) {
  return `${origin}/api/social-accounts/oauth/${platform}/callback`;
}

export async function beginOAuth(platform: SocialPlatformName, request: NextRequest) {
  if (!providerReady(platform)) {
    return NextResponse.redirect(settingsUrl(request, "missing-app"));
  }
  const state = randomBytes(24).toString("base64url");
  const redirectUri = oauthCallbackUrl(request.nextUrl.origin, platform);
  const destination =
    platform === "TIKTOK"
      ? tiktokAuthorizeUrl(redirectUri, state)
      : metaAuthorizeUrl(platform, redirectUri, state);
  const response = NextResponse.redirect(destination);
  response.cookies.set(OAUTH_COOKIE, `${platform}.${state}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}

export async function finishOAuth(platform: SocialPlatformName, request: NextRequest) {
  const url = request.nextUrl;
  const denied = url.searchParams.get("error");
  if (denied) return NextResponse.redirect(settingsUrl(request, "denied"));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !(await stateMatches(platform, state))) {
    return NextResponse.redirect(settingsUrl(request, "state"));
  }
  const redirectUri = oauthCallbackUrl(url.origin, platform);
  try {
    if (platform === "TIKTOK") {
      const token = await exchangeTikTokCode(code, redirectUri);
      const profile = await fetchTikTokAccount(token.accessToken);
      await saveOAuthGrant({
        platform,
        externalAccountId: profile.externalAccountId,
        accountName: profile.accountName,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresInSec: token.expiresIn,
        refreshExpiresInSec: token.refreshExpiresIn,
        scopes: "user.info.basic,video.publish",
      });
    } else {
      const token = await exchangeMetaCode(code, redirectUri);
      const profile = await fetchMetaAccount(platform, token.accessToken);
      await saveOAuthGrant({
        platform,
        externalAccountId: profile.externalAccountId,
        accountName: profile.accountName,
        accessToken: token.accessToken,
        refreshToken: null,
        expiresInSec: token.expiresIn,
        refreshExpiresInSec: null,
        scopes: META_SCOPES[platform],
      });
    }
  } catch {
    const failed = NextResponse.redirect(settingsUrl(request, "exchange"));
    failed.cookies.delete(OAUTH_COOKIE);
    return failed;
  }
  const response = NextResponse.redirect(settingsUrl(request, "connected"));
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}

function providerReady(platform: SocialPlatformName) {
  return platform === "TIKTOK" ? tiktokConfigured() : metaConfigured();
}

async function stateMatches(platform: SocialPlatformName, state: string) {
  const cookieStore = await cookies();
  const stored = cookieStore.get(OAUTH_COOKIE)?.value ?? "";
  const expected = `${platform}.${state}`;
  const left = Buffer.from(stored);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function settingsUrl(request: NextRequest, result: string) {
  const url = new URL("/pemasaran/akun", request.nextUrl.origin);
  url.searchParams.set("hasil", result);
  return url;
}

export function readPlatform(value: string) {
  const platform = value.toUpperCase();
  return isSocialPlatform(platform) ? platform : null;
}
