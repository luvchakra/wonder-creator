/**
 * The password policy, checked in the browser for quick feedback and again on the server (the auth server enforces
 * its own minimum too — see supabase/config.toml and docs/security.md). Length beats complexity: at least 10
 * characters with letters and digits, and not a well-known password.
 */
const COMMON = new Set(["password1", "password12", "password123", "1234567890", "qwerty1234", "letmein123", "welcome123", "iloveyou12", "admin12345", "abc1234567", "1q2w3e4r5t", "passw0rd12"]);

export function passwordProblem(password: string, opts: { email?: string | null } = {}): string | null {
  if (password.length < 10) return "Use at least 10 characters for your password.";
  if (password.length > 128) return "Use at most 128 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  if (COMMON.has(password.toLowerCase())) return "That password is too common. Choose something less guessable.";
  const local = opts.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return "Don't use your email address in your password.";
  return null;
}
