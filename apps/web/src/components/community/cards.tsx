import { INTENT_LABEL, OPEN_TO_LABEL, helpHeadline, HELP_INTENTS } from "@wonder/creator-community/shared";
import { artifactType } from "@wonder/creator-studio/types";
import { Avatar, cn } from "@wonder/ui";
import { AudioLines, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/client-time";
import type { CommunityCardView } from "@/lib/community";

/**
 * Community cards (Phase 03 §7, §20): compact, one primary action at most, no engagement counts shown as a prize. Reply
 * and participant counts appear only as quiet facts on conversations ("12 replies · 5 people"), never as ranking.
 */
export function CommunityCardItem({ card }: { card: CommunityCardView }) {
  switch (card.kind) {
    case "conversation": {
      const c = card.conversation;
      const asks = HELP_INTENTS.includes(c.intent) && !card.reason?.startsWith("You're in");
      const href = `/pulse/conversations/${c.id}`;
      return (
        <Card>
          {/* A request leads with the person ("Priya is looking for"); anything else with who and what kind. */}
          <Meta name={card.author.name} label={asks ? null : INTENT_LABEL[c.intent]} headline={asks ? helpHeadline(c.intent, card.author.name) : null} at={c.createdAt} />
          <Link href={href} className="mt-1 block font-display text-[16.5px] leading-snug text-ink hover:underline">
            {c.title}
          </Link>
          {c.body ? <p className="mt-0.5 line-clamp-2 text-[13.5px] text-ink-muted">{c.body}</p> : null}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12.5px] text-ink-subtle">
            <span>
              {c.replyCount} {c.replyCount === 1 ? "reply" : "replies"}
              {c.participantCount > 1 ? ` · ${c.participantCount} people` : ""}
            </span>
            {c.closedAt ? <span>· Closed</span> : null}
            {card.reason ? (
              <span className="inline-flex items-center gap-1 text-accent-ink">
                <Sparkles className="size-3.5" aria-hidden /> {card.reason}
              </span>
            ) : null}
          </p>
          {card.mayHelp ? (
            <Primary href={`/explore?type=material&q=${encodeURIComponent(card.mayHelp.query)}`}>See them</Primary>
          ) : asks && !c.closedAt ? (
            <Primary href={`${href}#reply`}>{c.intent === "critique" ? "Give feedback" : c.intent === "looking_for" ? "Help find it" : "Answer"}</Primary>
          ) : null}
        </Card>
      );
    }
    case "scrapbook":
      return (
        <Card>
          <Meta name={card.author.name} label="Scrapbook" at={card.createdAt} />
          <Link href={`/scrapbook/${card.id}`} className="mt-1 block">
            <span className="line-clamp-4 font-display text-[15.5px] italic leading-snug text-ink">“{card.body}”</span>
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.imageUrl} alt="" className="mt-2 max-h-48 w-full rounded-xl object-cover" />
            ) : null}
          </Link>
          <p className="mt-1">
            <Link href={`/scrapbook/${card.id}#reply`} className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-medium text-accent-ink hover:underline">
              <MessageCircle className="size-4" aria-hidden /> Reply
            </Link>
          </p>
        </Card>
      );
    case "huddle":
      return (
        <Card>
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-live">
            <AudioLines className="size-4" aria-hidden /> Live Huddle · started <RelativeTime iso={card.huddle.startedAt} />
          </p>
          <p className="mt-1 font-display text-[16.5px] leading-snug text-ink">{card.huddle.topic ?? `${card.huddle.participantNames[0] ?? "A creator"}'s Huddle`}</p>
          <p className="text-[12.5px] text-ink-subtle">
            {card.huddle.participantCount} {card.huddle.participantCount === 1 ? "creator" : "creators"} here
          </p>
          <Primary href={`/huddles/${card.huddle.huddleId}`}>Join</Primary>
        </Card>
      );
    case "creation":
      return (
        <Card>
          <Link href={`/creations/${card.id}`} className="flex items-center gap-3">
            {card.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.coverUrl} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
            ) : (
              <span aria-hidden className="inline-flex size-16 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-accent">
                <Sparkles className="size-5" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] text-ink-subtle">
                {card.author.name} · {artifactType(card.artifactType).label}
              </span>
              <span className="line-clamp-2 font-display text-[16px] leading-snug text-ink">{card.title}</span>
            </span>
          </Link>
        </Card>
      );
    case "person":
      return (
        <Card>
          <Link href={card.person.handle ? `/creators/${card.person.handle}` : "#"} className="flex items-center gap-3">
            <Avatar name={card.person.name} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-medium text-ink">{card.person.name}</span>
              {card.reason ? <span className="block text-[12.5px] text-accent-ink">{card.reason}</span> : card.bio ? <span className="line-clamp-1 text-[12.5px] text-ink-muted">{card.bio}</span> : null}
            </span>
          </Link>
          {card.openTo.length ? (
            <p className="mt-1.5 flex flex-wrap gap-1" aria-label="Open to">
              {card.openTo.map((o) => (
                <span key={o} className="rounded-full bg-surface-muted px-2 py-0.5 text-[11.5px] text-ink-muted">
                  {OPEN_TO_LABEL[o]}
                </span>
              ))}
            </p>
          ) : null}
        </Card>
      );
  }
}

function Card({ children }: { children: React.ReactNode }) {
  return <li className="rounded-2xl border border-border-soft bg-surface/90 px-3 py-2.5 shadow-[var(--shadow-card)]">{children}</li>;
}

function Meta({ name, label, headline, at }: { name: string; label?: string | null; headline?: string | null; at: string }) {
  return (
    <p className="flex items-center gap-2 text-[12.5px] text-ink-muted">
      <Avatar name={name} size={22} />
      <span className="min-w-0 truncate">
        <span className="font-medium text-ink">{headline ?? name}</span>
        {label ? ` · ${label}` : ""} · <RelativeTime iso={at} />
      </span>
    </p>
  );
}

function Primary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="mt-1.5 inline-flex min-h-11 items-center">
      <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13.5px] font-medium text-white hover:bg-ink/90")}>{children}</span>
    </Link>
  );
}
