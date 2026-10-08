import { DomainError, log } from "@wonder/core";
import { after } from "next/server";
import { z } from "zod";
import { checkBudget, readJson, withApi } from "@/lib/api";
import { mailContactMessage } from "@/lib/contact-mail";
import { CONTACT_TOPICS } from "@/lib/contact-topics";
import { clientIp } from "@/lib/request-ip";
import { serviceClient, serviceConfigured } from "@/lib/supabase/service";

const body = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(2, "Add your name.").max(120, "That name is too long."),
  email: z.string().trim().email("Add a valid email so we can reply.").max(200, "That address is too long."),
  topic: z.enum(CONTACT_TOPICS).default("general"),
  message: z.string().trim().min(10, "Say a little more — at least 10 characters.").max(4000, "That's longer than we can take in one message (4,000 characters)."),
  page: z.string().trim().max(300).optional(),
  // Honeypot: the form never shows it, so only a bot fills it in.
  company: z.string().max(500).optional(),
});

/**
 * POST /api/v1/contact — "Send us a message" on /contact (owner, 8 Oct 2026: "implement similar to WonderJobs"). Open to
 * anyone, signed in or not. The message is saved first (`contact_messages`, service role only, kept 12 months) and the
 * team is emailed after the response, when a mailbox is connected (lib/contact-mail.ts). `clientId` is made when the
 * form opens, so a double tap or a retry lands once and mails once. Throttled per address, and again per hour.
 */
export const POST = withApi(
  async ({ req, requestId }) => {
    const b = body.parse(await readJson(req, 20_000));
    // A bot that fills the hidden field is told it worked and nothing is kept.
    if (b.company?.trim()) return { ok: true };
    if (!serviceConfigured()) throw new DomainError("provider_unavailable", "Messages can't be sent right now. Please try again later.");
    await checkBudget(`contact:${clientIp(req)}`, 10);

    const service = serviceClient();
    const saved = await service
      .from("contact_messages")
      .insert({ client_id: b.clientId, name: b.name, email: b.email, topic: b.topic, message: b.message, page: b.page || null, user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null })
      .select("id")
      .single();
    if (saved.error) {
      if (saved.error.code === "23505") return { ok: true, duplicate: true };
      throw new DomainError("internal", "We couldn't save your message just now. Please try again in a minute.", { cause: saved.error });
    }

    const id = saved.data.id;
    after(async () => {
      const sent = await mailContactMessage({ name: b.name, email: b.email, topic: b.topic, message: b.message, page: b.page });
      if (sent.sent) {
        const done = await service.from("contact_messages").update({ notified_at: new Date().toISOString() }).eq("id", id);
        if (done.error) log("warn", "contact.notified_at_failed", { requestId });
      }
    });
    return { ok: true };
  },
  { public: true, rateLimit: 5 },
);
