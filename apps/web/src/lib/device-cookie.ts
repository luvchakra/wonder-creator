/** A small preference kept on this device for about a year (client only). Never anything private. */
export function setDeviceCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
}
