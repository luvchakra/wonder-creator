import type { OpenConversation } from "@wonder/creator-community";
import { AvatarStack, cn } from "@wonder/ui";
import { ArrowRight, HandHelping, HeartHandshake, MessageCircle, Share2, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { RelativeTime } from "@/components/client-time";
import type { PublicCard } from "@/lib/public-pages";
import { surface } from "./shared";

export interface ProfileHuddle {
  huddleId: string;
  topic: string | null;
  participantCount: number;
  participantNames: string[];
  viewerState: "joined" | "approved" | "requested" | "none";
}

const FACE: Record<OpenConversation["intent"], { label: string; icon: typeof MessageCircle }> = {
  ask: { label: "Help request", icon: HandHelping },
  critique: { label: "Feedback request", icon: HandHelping },
  looking_for: { label: "Collaboration invitation", icon: HeartHandshake },
  explore_together: { label: "Collaboration invitation", icon: HeartHandshake },
  discuss: { label: "Conversation", icon: MessageCircle },
  share_knowledge: { label: "Conversation", icon: MessageCircle },
};

/**
 * The Community tab: where this creator is live now, what they've asked for or invited others into, and what they've
 * shared to their Creator Page. Time order only — no counts to compete on.
 */
export function CommunityTab({ huddles, conversations, shared, handle, isMe, pagePublished }: { huddles: ProfileHuddle[]; conversations: OpenConversation[]; shared: PublicCard[]; handle: string; isMe: boolean; pagePublished: boolean }) {
  if (!huddles.length && !conversations.length && !shared.length)
    return (
      <p className={cn(surface, "px-4 py-6 text-center text-[13.5px] text-ink-muted")}>
        {isMe ? "Conversations you start and Huddles you open appear here. " : "Nothing in the community yet."}
        {isMe ? (
          <Link href="/pulse" className="font-medium text-accent-ink hover:underline">
            Open Pulse
          </Link>
        ) : null}
      </p>
    );
  return (
    <ul className="space-y-2.5">
      {huddles.map((h) => (
        <li key={h.huddleId}>
          <Row icon={<Users className="size-4" aria-hidden />} label="Active Huddle" aside={<JoinLink h={h} />}>
            <p className="text-[14.5px] font-medium text-ink">{h.topic ?? "An open Huddle"}</p>
            <p className="mt-1 flex items-center gap-2 text-[12.5px] text-ink-muted">
              <AvatarStack people={h.participantNames.map((n) => ({ name: n }))} size={22} />
              {h.participantCount} {h.participantCount === 1 ? "creator" : "creators"} here now
            </p>
          </Row>
        </li>
      ))}
      {conversations.map((c) => {
        const f = FACE[c.intent];
        return (
          <li key={c.id}>
            <Row icon={<f.icon className="size-4" aria-hidden />} label={c.closedAt ? `${f.label} · closed` : f.label} time={c.createdAt} href={`/pulse/conversations/${c.id}`} name={c.title}>
              <p className="text-[14.5px] font-medium leading-snug text-ink">{c.title}</p>
              {c.body ? <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{c.body}</p> : null}
            </Row>
          </li>
        );
      })}
      {shared.length ? (
        <li>
          <Row icon={<Share2 className="size-4" aria-hidden />} label="Shared to Creator Page" time={shared[0]!.publishedAt}>
            <ul className="divide-y divide-border-soft">
              {shared.map((w) => (
                <li key={w.slug}>
                  <Link href={w.href} className="flex min-h-12 items-center gap-2.5 py-1.5 hover:underline">
                    {w.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.coverUrl} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{w.title}</span>
                      <span className="block truncate text-[12px] text-ink-muted">{w.descriptor}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={`/p/${handle}`} className="mt-1 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline">
              View page <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </Row>
        </li>
      ) : isMe && !pagePublished ? (
        <li className="px-1 text-[12.5px] text-ink-subtle">
          Your Creator Page isn&rsquo;t public yet.{" "}
          <Link href="/creator-page" className="font-medium text-accent-ink hover:underline">
            Set it up
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

function JoinLink({ h }: { h: ProfileHuddle }) {
  const label = h.viewerState === "joined" ? "Rejoin" : h.viewerState === "approved" ? "Enter" : h.viewerState === "requested" ? "Requested" : "Join";
  return (
    <Link href={`/huddles/${h.huddleId}`} className="relative inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft px-3 text-[12.5px] font-medium text-accent-ink before:absolute before:-inset-y-2 before:inset-x-0 before:content-['']">
      {label} <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

function Row({ icon, label, time, aside, href, name, children }: { icon: ReactNode; label: string; time?: string; aside?: ReactNode; href?: string; name?: string; children: ReactNode }) {
  return (
    <article className={cn(surface, "relative px-3 py-2.5")}>
      <p className="flex min-h-7 items-center gap-2 text-[12.5px] font-semibold text-ink">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-accent-softer text-accent-ink">{icon}</span>
        <span className="flex-1">{label}</span>
        {time ? (
          <span className="text-[11.5px] font-normal text-ink-subtle">
            <RelativeTime iso={time} />
          </span>
        ) : null}
        {aside ? <span className="relative z-10">{aside}</span> : null}
      </p>
      <div className="mt-1 pl-8">{children}</div>
      {href ? <Link href={href} aria-label={`Open ${name ?? label}`} className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-accent" /> : null}
    </article>
  );
}
