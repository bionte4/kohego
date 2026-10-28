/** Strip long opaque strings so a provider error cannot echo a token into the UI or database. */
export function safeProviderMessage(message: string) {
  return message.replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]").slice(0, 180);
}
