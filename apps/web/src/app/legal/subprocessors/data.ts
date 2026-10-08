/**
 * Who processes personal data on our behalf (GDPR Art. 28; DPDP §8(2)) — shown on /legal/subprocessors and referenced
 * from the Privacy notice and docs/compliance/privacy.md. Keep in step with the providers actually configured.
 */
export const SUBPROCESSORS = [
  { name: "Supabase", purpose: "Database, sign-in and file storage", data: "Account, profile, everything you create and upload", where: "Region of our project (see notice)" },
  { name: "Vercel", purpose: "Hosting and delivery of the app", data: "Request metadata (IP address, browser), logs", where: "India (Mumbai) and global edge" },
  { name: "Google (Gemini API)", purpose: "CreativeMind AI and image generation, when connected", data: "Only the material you choose to work on", where: "United States / global" },
  { name: "Anthropic", purpose: "CreativeMind AI, when chosen as provider", data: "Only the material you choose to work on", where: "United States" },
  { name: "LiveKit", purpose: "Huddle voice and video, when connected", data: "Live audio/video streams (not recorded by us), display name", where: "Global" },
  { name: "Stripe", purpose: "Card and international payments, when connected", data: "Payer name, email, payment details entered on Stripe's page", where: "United States / global" },
  { name: "Razorpay", purpose: "Payments in India (UPI, cards, netbanking), when connected", data: "Payer name, email, phone, payment details entered on Razorpay's page", where: "India" },
  { name: "GoDaddy", purpose: "The mailbox that receives messages sent from the Contact page, when connected", data: "The name, email address and message of whoever writes to us", where: "Global" },
  { name: "VirusTotal (Google)", purpose: "Malware check of uploads, when connected", data: "A file fingerprint (SHA-256 hash) only — never the file", where: "Global" },
] as const;
