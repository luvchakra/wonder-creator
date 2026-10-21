import { buttonClasses } from "@wonder/ui";
import Link from "next/link";

/** One calm message with one way on: the careers pages' empty, unavailable and not-set-up states. */
export function CareersNotice({ title, body, action }: { title: string; body?: React.ReactNode; action?: { href: string; label: string } }) {
  return (
    <div role="status" className="rounded-3xl border border-white/80 bg-white/70 px-5 py-8 text-center shadow-[0_24px_50px_-36px_rgb(76_60_120/0.45)] backdrop-blur-sm">
      <p className="font-display text-[22px] leading-snug text-ink">{title}</p>
      {body ? <div className="mx-auto mt-2 max-w-md text-[14.5px] leading-relaxed text-ink-muted">{body}</div> : null}
      {action ? (
        <Link href={action.href} className={buttonClasses({ variant: "secondary", className: "mt-5" })}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
