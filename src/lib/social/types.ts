export const SOCIAL_PLATFORMS = ["INSTAGRAM", "FACEBOOK", "TIKTOK"] as const;

export type SocialPlatformName = (typeof SOCIAL_PLATFORMS)[number];

export type SocialConnectionState = "CONNECTED" | "EXPIRED" | "DISCONNECTED";

/** Safe for the browser. Access tokens and refresh tokens are never included. */
export interface SocialAccountView {
  id: string | null;
  platform: SocialPlatformName;
  accountName: string | null;
  status: SocialConnectionState;
  accessExpiresAt: string | null;
  canRefresh: boolean;
}

export interface SocialAccountList {
  configured: boolean;
  message: string | null;
  accounts: SocialAccountView[];
}

export const PLATFORM_LABEL: Record<SocialPlatformName, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
};

export function isSocialPlatform(value: string): value is SocialPlatformName {
  return SOCIAL_PLATFORMS.includes(value as SocialPlatformName);
}
