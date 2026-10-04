import { isSceneBreak, type WritingStyle } from "@wonder/creator-studio/pages";
import { Ornament, cn, type OrnamentKind } from "@wonder/ui";
import type { ReactNode } from "react";

/**
 * A piece of writing set the way its kind is best read (creation-pages.md §Writing kinds), after the publications that set
 * it best: a poetry journal, a literary review, a magazine feature, a newspaper, a fiction page, a letter, a screenplay.
 * One component for the Writing canvas, the Read page and the published page, so the words look the same everywhere.
 * `tone="light"` sets it in white over a picture.
 */
export function WrittenPiece({
  style,
  kicker,
  title,
  text,
  byline,
  date,
  tone = "ink",
  as: Heading = "h2",
  empty,
  ornament,
}: {
  style: WritingStyle;
  /** The small line above the title — the kind, or a control that changes it. */
  kicker?: ReactNode;
  title: string;
  text: string;
  byline?: string | null;
  /** A date for the dateline (news) or the letter's head. */
  date?: string | null;
  tone?: "ink" | "light";
  as?: "h1" | "h2";
  /** Shown when there are no words yet. */
  empty?: ReactNode;
  /** The Roman ornament that heads and closes the piece; without one, a short hairline under the title. */
  ornament?: OrnamentKind;
}) {
  const light = tone === "light";
  const muted = light ? "text-white/80" : "text-ink-muted";
  const rule = light ? "bg-white/40" : "bg-ink/15";
  const shadow = light ? "[text-shadow:0_1px_12px_rgba(0,0,0,0.5)]" : "";
  const paras = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^\n+|\n+$/g, ""))
    .filter((p) => p.trim());
  const when = date ? new Date(date) : null;
  const longDate = when ? when.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
  const shortDate = when ? when.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).toUpperCase() : null;
  const Kicker = kicker ? <div className={cn("text-[11px] font-semibold uppercase tracking-[0.16em]", light ? "text-white/80" : style === "news" || style === "feature" ? "text-accent-ink" : "text-ink-subtle")}>{kicker}</div> : null;
  const Empty = <p className={cn("mt-5 font-display text-[17px] italic", muted)}>{empty}</p>;
  // Header and footer ornaments (owner, 4 Oct 2026): written Creations only.
  const tint = light ? "text-white/55" : undefined;
  const Head = (centred: boolean) => (ornament ? <Ornament kind={ornament} className={cn("mt-5", tint)} /> : <div aria-hidden className={cn("mt-5 h-px w-12", rule, centred && "mx-auto")} />);
  const Foot = ornament ? <Ornament kind={ornament} className={cn("mt-10", tint)} /> : null;

  if (style === "verse")
    return (
      <div className={cn("text-center", shadow)}>
        {Kicker}
        <Heading className="mt-2 font-display text-[30px] leading-[1.1] [text-wrap:balance] sm:text-[38px]">{title}</Heading>
        {byline ? <p className={cn("mt-2 font-display text-[15px] italic", muted)}>{byline}</p> : null}
        {Head(true)}
        {paras.length ? (
          <div className="mt-6 space-y-[1.2em] font-display text-[17px] leading-[1.95] sm:text-[20px]">
            {paras.map((stanza, k) => (
              <p key={k}>
                {/* A line that has to wrap on a phone wraps evenly, not with one word left over. */}
                {stanza.split("\n").map((line, j) => (
                  <span key={j} className="block whitespace-pre-wrap [text-wrap:balance]">
                    {line}
                  </span>
                ))}
              </p>
            ))}
          </div>
        ) : (
          Empty
        )}
        {Foot}
      </div>
    );

  if (style === "script")
    return (
      <div className={cn("font-mono", shadow)}>
        {Kicker}
        <Heading className="mt-3 text-center text-[17px] font-semibold uppercase tracking-[0.08em] underline underline-offset-4">{title}</Heading>
        {byline ? <p className={cn("mt-2 text-center text-[13px]", muted)}>written by {byline}</p> : null}
        {ornament ? Head(true) : null}
        {paras.length ? <div className="mt-8 whitespace-pre-wrap text-[13.5px] leading-7">{text.trim()}</div> : Empty}
        {Foot}
      </div>
    );

  if (style === "news")
    return (
      <div className={shadow}>
        {Kicker}
        <Heading className="mt-2 font-display text-[29px] font-bold leading-[1.12] tracking-[-0.01em] [text-wrap:balance] sm:text-[38px]">{title}</Heading>
        <div className={cn("mt-4 flex flex-wrap items-center gap-x-2 border-y py-2 font-sans text-[12.5px]", light ? "border-white/30" : "border-ink/15", muted)}>
          {byline ? <span className="font-semibold uppercase tracking-[0.08em]">By {byline}</span> : null}
          {byline && longDate ? <span aria-hidden>·</span> : null}
          {longDate ? <span>{longDate}</span> : null}
        </div>
        {paras.length ? (
          <div className="mt-5 space-y-4 font-sans text-[16px] leading-[1.7]">
            {paras.map((p, k) =>
              isSceneBreak(p) ? (
                <SceneBreak key={k} light={light} />
              ) : k === 0 ? (
                <p key={k} className="whitespace-pre-line text-[17px] font-medium leading-[1.6]">
                  {shortDate ? <span className="mr-1 text-[12.5px] font-bold uppercase tracking-[0.1em]">{shortDate} —</span> : null}
                  {p}
                </p>
              ) : (
                <p key={k} className="whitespace-pre-line">
                  {p}
                </p>
              ),
            )}
          </div>
        ) : (
          Empty
        )}
        {Foot}
      </div>
    );

  if (style === "letter") {
    const greeting = paras.length > 1 && paras[0]!.length <= 60 ? paras[0] : null;
    const signoff = paras.length > 2 && paras[paras.length - 1]!.length <= 80 ? paras[paras.length - 1] : null;
    const body = paras.slice(greeting ? 1 : 0, signoff ? -1 : undefined);
    return (
      <div className={shadow}>
        {Kicker}
        {longDate ? <p className={cn("mt-2 text-right font-display text-[14px] italic", muted)}>{longDate}</p> : null}
        <Heading className="mt-3 font-display text-[24px] leading-tight [text-wrap:balance] sm:text-[28px]">{title}</Heading>
        {ornament ? Head(false) : null}
        {paras.length ? (
          <div className="mt-6 space-y-4 font-display text-[17.5px] leading-[1.8]">
            {greeting ? <p className="italic">{greeting}</p> : null}
            {body.map((p, k) => (isSceneBreak(p) ? <SceneBreak key={k} light={light} /> : <p key={k} className="whitespace-pre-line">{p}</p>))}
            {signoff ? <p className="whitespace-pre-line pt-2 text-right italic">{signoff}</p> : null}
            {byline && !signoff ? <p className="pt-2 text-right italic">{byline}</p> : null}
          </div>
        ) : (
          Empty
        )}
        {Foot}
      </div>
    );
  }

  // Essay, feature and fiction share a reading face and differ in how they open and how paragraphs follow each other.
  const fiction = style === "fiction";
  const essay = style === "essay";
  const feature = style === "feature";
  const standfirst = feature && paras.length > 1 ? paras[0] : null;
  const body = standfirst ? paras.slice(1) : paras;
  return (
    <div className={shadow}>
      <div className={cn(fiction && "text-center")}>
        {Kicker}
        <Heading className={cn("mt-2 font-display leading-[1.06] [text-wrap:balance]", feature ? "text-[32px] sm:text-[44px]" : "text-[30px] sm:text-[40px]", fiction && "italic")}>{title}</Heading>
        {standfirst ? <p className={cn("mt-3 whitespace-pre-line font-display text-[19px] italic leading-[1.5] sm:text-[21px]", muted)}>{standfirst}</p> : null}
        {byline ? (
          <p className={cn("mt-3 text-[12px] font-semibold uppercase tracking-[0.14em]", muted, fiction && "font-normal tracking-[0.2em]")}>{fiction ? byline : `By ${byline}`}</p>
        ) : null}
        {Head(fiction)}
      </div>
      {body.length ? (
        <div className={cn("mt-6 font-display text-[17.5px] leading-[1.8]", feature && "space-y-5")}>
          {body.map((p, k) => {
            if (isSceneBreak(p)) return <SceneBreak key={k} light={light} />;
            const opens = k === 0 || isSceneBreak(body[k - 1]!);
            return (
              <p
                key={k}
                className={cn(
                  "whitespace-pre-line",
                  // Book paragraphs: indented, no gap — except the first of a section.
                  (essay || fiction) && !opens && "indent-[1.6em]",
                  // A literary review's drop cap; a fiction page's opening words in capitals.
                  essay && k === 0 && "first-letter:float-left first-letter:mr-2 first-letter:mt-1.5 first-letter:font-display first-letter:text-[3.7em] first-letter:leading-[0.78]",
                  fiction && k === 0 && "first-line:uppercase first-line:tracking-[0.06em]",
                )}
              >
                {p}
              </p>
            );
          })}
        </div>
      ) : (
        Empty
      )}
      {Foot}
    </div>
  );
}

function SceneBreak({ light }: { light: boolean }) {
  return (
    <p aria-hidden className={cn("py-4 text-center font-display text-[18px] tracking-[0.5em]", light ? "text-white/70" : "text-ink/40")}>
      ⁂
    </p>
  );
}
