"use client";
import {
  ATTRIBUTION_POLICIES,
  ATTRIBUTION_POLICY_LABEL,
  DERIVATIVE_POLICIES,
  DERIVATIVE_POLICY_LABEL,
  OWNERSHIP_CLAIMS,
  OWNERSHIP_CLAIM_LABEL,
  PROJECT_RIGHTS_DISCLAIMER,
  type AssertionStatus,
  type AttributionPolicy,
  type DerivativePolicy,
  type OwnershipClaim,
} from "@wonder/creator-projects/options";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  Field,
  Input,
  SectionHeader,
  Select,
  Textarea,
  cn,
} from "@wonder/ui";
import { Scale } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalTime } from "@/components/client-time";
import { SignoffDialog } from "@/components/signoff-dialog";
import { api, errorMessage } from "@/lib/client";

type Access = "comment" | "propose" | "edit";
const ACCESS_LABEL: Record<Access, string> = {
  comment: "Can comment",
  propose: "Can propose changes",
  edit: "Can edit",
};
const OWNERSHIP_LABEL = {
  sole: "Sole ownership",
  joint: "Joint ownership",
  transferred: "Transferred",
} as const;
const STATUS_TONE: Record<
  AssertionStatus,
  "neutral" | "accent" | "success" | "warning"
> = {
  asserted: "accent",
  acknowledged: "success",
  disputed: "warning",
  withdrawn: "neutral",
};

export interface RightsPolicyView {
  derivatives: DerivativePolicy;
  publicationSignoff: boolean;
  attribution: AttributionPolicy;
  agreement: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PieceRightsView {
  artifactId: string;
  title: string;
  owner: { id: string; name: string };
  recorded: boolean;
  ownershipKind: keyof typeof OWNERSHIP_LABEL | null;
  copyrightHolder: string | null;
  attributionRequired: boolean;
  derivativesAllowed: boolean;
  coOwners: Array<{ name: string; creatorId: string | null; share: number }>;
  collaborators: Array<{
    creatorId: string;
    name: string;
    role: string | null;
    access: Access;
  }>;
  signoffs: Array<{
    creatorId: string;
    name: string;
    decision: "approve" | "object" | null;
    note: string | null;
    at: string | null;
  }>;
  activeLicenses: number;
  exclusiveLicenses: number;
}

export interface AssertionItem {
  id: string;
  artifact: { id: string; title: string };
  creator: { id: string; name: string };
  claim: OwnershipClaim;
  claimLabel: string;
  sharePercent: number | null;
  statement: string;
  status: AssertionStatus;
  statusLabel: string;
  response: { by: string | null; note: string | null; at: string } | null;
  at: string;
  mine: boolean;
}

export function RightsPanel({
  projectId,
  viewerId,
  isOwner,
  policy,
  pieces,
  assertions,
  history,
}: {
  projectId: string;
  viewerId: string;
  isOwner: boolean;
  policy: RightsPolicyView;
  pieces: PieceRightsView[];
  assertions: AssertionItem[];
  history: Array<{
    id: string;
    title: string;
    actor: string | null;
    at: string;
  }>;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [responding, setResponding] = useState<{
    a: AssertionItem;
    response: "acknowledge" | "dispute" | "withdraw";
  } | null>(null);
  const [signing, setSigning] = useState<{
    piece: PieceRightsView;
    decision: "approve" | "object";
  } | null>(null);
  const [revoking, setRevoking] = useState<{
    piece: PieceRightsView;
    creatorId: string;
    name: string;
  } | null>(null);
  const done = (text: string) => (setMsg(text), router.refresh());
  // Claims can be made on pieces the viewer works on (the server checks contributions too).
  const claimable = pieces.filter(
    (p) =>
      p.owner.id !== viewerId &&
      p.collaborators.some((c) => c.creatorId === viewerId),
  );
  const pendingSignoffs = pieces.filter(
    (p) =>
      p.signoffs.length && p.signoffs.some((s) => s.decision !== "approve"),
  );

  return (
    <div className="space-y-8">
      <p className="flex gap-3 rounded-2xl border border-border-soft bg-surface px-4 py-3 text-sm text-ink-muted">
        <Scale className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <span>{PROJECT_RIGHTS_DISCLAIMER}</span>
      </p>

      <div aria-live="polite" className="sr-only">
        {msg}
      </div>
      {msg ? (
        <p className="rounded-2xl bg-accent-softer px-4 py-3 text-[15px] text-ink">
          {msg}
        </p>
      ) : null}

      <section aria-label="Project policy">
        <SectionHeader
          title="Project policy"
          action={
            isOwner ? (
              <Button
                variant="secondary"
                onClick={() => setEditingPolicy(true)}
              >
                Edit policy
              </Button>
            ) : undefined
          }
        />
        <dl className="grid gap-3 rounded-2xl border border-border-soft bg-surface px-5 py-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-ink-subtle">Derivatives</dt>
            <dd className="text-[15px] font-medium text-ink">
              {DERIVATIVE_POLICY_LABEL[policy.derivatives].label}
            </dd>
            <dd className="text-sm text-ink-muted">
              {DERIVATIVE_POLICY_LABEL[policy.derivatives].help}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-subtle">Publishing</dt>
            <dd className="text-[15px] font-medium text-ink">
              {policy.publicationSignoff
                ? "Collaborators sign off first"
                : "Owner decides"}
            </dd>
            <dd className="text-sm text-ink-muted">
              {policy.publicationSignoff
                ? "A piece can't be published until its collaborators and co-owners approve the current version."
                : "Each piece's owner publishes on their own approval."}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-ink-subtle">Attribution</dt>
            <dd className="text-[15px] font-medium text-ink">
              {ATTRIBUTION_POLICY_LABEL[policy.attribution].label}
            </dd>
            <dd className="text-sm text-ink-muted">
              {ATTRIBUTION_POLICY_LABEL[policy.attribution].help}
            </dd>
          </div>
          {policy.agreement ? (
            <div className="sm:col-span-3">
              <dt className="text-sm text-ink-subtle">Agreement</dt>
              <dd className="whitespace-pre-wrap text-[15px] text-ink">
                {policy.agreement}
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-3">
            <dt className="sr-only">Last changed</dt>
            <dd className="text-sm text-ink-subtle">
              {policy.updatedAt ? (
                <>
                  Set by {policy.updatedBy ?? "the owner"} ·{" "}
                  <LocalTime
                    iso={policy.updatedAt}
                    options={{ dateStyle: "medium" }}
                  />
                </>
              ) : (
                "Default policy — the owner hasn't set one yet."
              )}
            </dd>
          </div>
        </dl>
      </section>

      {pendingSignoffs.length ? (
        <section aria-label="Waiting for sign-off">
          <SectionHeader title="Waiting for sign-off" />
          <ul className="space-y-2">
            {pendingSignoffs.map((p) => {
              const missing = p.signoffs.filter(
                (s) => s.decision !== "approve",
              );
              return (
                <li
                  key={p.artifactId}
                  className="rounded-2xl border border-border-soft bg-surface px-4 py-3 text-[15px] text-ink"
                >
                  <span className="font-medium">{p.title}</span>
                  <span className="text-ink-muted">
                    {" "}
                    · waiting on{" "}
                    {missing
                      .map(
                        (s) =>
                          (s.creatorId === viewerId ? "you" : s.name) +
                          (s.decision === "object" ? " (objected)" : ""),
                      )
                      .join(", ")}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-label="Pieces">
        <SectionHeader title="Pieces" />
        {pieces.length ? (
          <ul className="space-y-2">
            {pieces.map((p) => {
              const ownsPiece = p.owner.id === viewerId;
              const mySignoff = p.signoffs.find(
                (s) => s.creatorId === viewerId,
              );
              const claims = assertions.filter(
                (a) =>
                  a.artifact.id === p.artifactId && a.status !== "withdrawn",
              );
              return (
                <li
                  key={p.artifactId}
                  className="rounded-2xl border border-border-soft bg-surface"
                >
                  <details>
                    <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 px-4 py-3">
                      <span className="font-medium text-ink">{p.title}</span>
                      <span className="text-sm text-ink-muted">
                        · {ownsPiece ? "Yours" : p.owner.name}
                      </span>
                      {p.recorded && p.ownershipKind ? (
                        <Badge tone="neutral">
                          {OWNERSHIP_LABEL[p.ownershipKind]}
                        </Badge>
                      ) : (
                        <Badge tone="warning">No rights record</Badge>
                      )}
                      {p.exclusiveLicenses ? (
                        <Badge tone="warning">Exclusive licence</Badge>
                      ) : null}
                      {claims.some((a) => a.status === "disputed") ? (
                        <Badge tone="warning">Disputed claim</Badge>
                      ) : null}
                    </summary>
                    <div className="space-y-4 border-t border-border-soft px-4 py-3">
                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-ink-subtle">Copyright holder</dt>
                          <dd className="text-ink">
                            {p.copyrightHolder ?? "Not recorded"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-subtle">Owners on record</dt>
                          <dd className="text-ink">
                            {p.coOwners.length
                              ? p.coOwners
                                  .map((o) => `${o.name} (${o.share}%)`)
                                  .join(", ")
                              : "Not recorded"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-subtle">Attribution</dt>
                          <dd className="text-ink">
                            {p.attributionRequired
                              ? "Credit required"
                              : "Credit optional"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-subtle">Derivatives</dt>
                          <dd className="text-ink">
                            {policy.derivatives === "not_allowed"
                              ? "Not allowed (project policy)"
                              : policy.derivatives === "crew_allowed"
                                ? "Crew may adapt (project policy)"
                                : p.derivativesAllowed
                                  ? "Allowed by the owner"
                                  : "Only with the owner's permission"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-subtle">Licences</dt>
                          <dd className="text-ink">
                            {p.activeLicenses
                              ? `${p.activeLicenses} active${p.exclusiveLicenses ? `, ${p.exclusiveLicenses} exclusive` : ""}`
                              : "None active"}
                          </dd>
                        </div>
                      </dl>
                      {ownsPiece ? (
                        <Link
                          href={`/artifacts/${p.artifactId}?tab=rights`}
                          className="inline-flex min-h-11 items-center text-sm font-medium text-accent-ink hover:underline"
                        >
                          Edit this piece&rsquo;s rights record
                        </Link>
                      ) : null}

                      <div>
                        <h4 className="text-sm font-semibold text-ink">
                          Permissions
                        </h4>
                        {p.collaborators.length ? (
                          <ul className="mt-1 divide-y divide-border-soft">
                            {p.collaborators.map((c) => (
                              <li
                                key={c.creatorId}
                                className="flex flex-wrap items-center gap-2 py-2"
                              >
                                <span className="min-w-0 flex-1 text-[15px] text-ink">
                                  {c.creatorId === viewerId ? "You" : c.name}
                                  {c.role ? (
                                    <span className="text-ink-muted">
                                      {" "}
                                      · {c.role}
                                    </span>
                                  ) : null}
                                </span>
                                {ownsPiece ? (
                                  <>
                                    <label
                                      htmlFor={`access-${p.artifactId}-${c.creatorId}`}
                                      className="sr-only"
                                    >
                                      Access for {c.name}
                                    </label>
                                    <Select
                                      id={`access-${p.artifactId}-${c.creatorId}`}
                                      value={c.access}
                                      className="w-auto"
                                      onChange={async (e) => {
                                        try {
                                          await api(
                                            `/api/v1/artifacts/${p.artifactId}/collaborators`,
                                            {
                                              method: "PATCH",
                                              json: {
                                                creatorId: c.creatorId,
                                                access: e.target.value,
                                              },
                                            },
                                          );
                                          done(
                                            `${c.name} now: ${ACCESS_LABEL[e.target.value as Access].toLowerCase()}.`,
                                          );
                                        } catch (err) {
                                          setMsg(errorMessage(err));
                                        }
                                      }}
                                    >
                                      {(
                                        Object.keys(ACCESS_LABEL) as Access[]
                                      ).map((a) => (
                                        <option key={a} value={a}>
                                          {ACCESS_LABEL[a]}
                                        </option>
                                      ))}
                                    </Select>
                                    <Button
                                      variant="ghost"
                                      onClick={() =>
                                        setRevoking({
                                          piece: p,
                                          creatorId: c.creatorId,
                                          name: c.name,
                                        })
                                      }
                                    >
                                      Revoke
                                    </Button>
                                  </>
                                ) : (
                                  <Badge tone="neutral">
                                    {ACCESS_LABEL[c.access]}
                                  </Badge>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-ink-muted">
                            Only the owner works on this piece.
                          </p>
                        )}
                      </div>

                      {p.signoffs.length ? (
                        <div>
                          <h4 className="text-sm font-semibold text-ink">
                            Publication sign-off (current version)
                          </h4>
                          <ul className="mt-1 space-y-1">
                            {p.signoffs.map((s) => (
                              <li
                                key={s.creatorId}
                                className="flex flex-wrap items-center gap-2 text-[15px] text-ink"
                              >
                                {s.creatorId === viewerId ? "You" : s.name}
                                <Badge
                                  tone={
                                    s.decision === "approve"
                                      ? "success"
                                      : s.decision === "object"
                                        ? "warning"
                                        : "neutral"
                                  }
                                >
                                  {s.decision === "approve"
                                    ? "Approved"
                                    : s.decision === "object"
                                      ? "Objected"
                                      : "Not yet"}
                                </Badge>
                                {s.note ? (
                                  <span className="text-sm text-ink-muted">
                                    “{s.note}”
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          {mySignoff ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                variant={
                                  mySignoff.decision === "approve"
                                    ? "secondary"
                                    : "primary"
                                }
                                onClick={() =>
                                  setSigning({ piece: p, decision: "approve" })
                                }
                              >
                                Approve publishing
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setSigning({ piece: p, decision: "object" })
                                }
                              >
                                Object
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {claims.length ? (
                        <p className="text-sm text-ink-muted">
                          {claims.length} ownership{" "}
                          {claims.length === 1 ? "claim" : "claims"} — see
                          Claims below.
                        </p>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">
            No pieces are linked to this project yet. Rights appear here once
            pieces are added.
          </p>
        )}
      </section>

      <section aria-label="Ownership claims">
        <SectionHeader
          title="Ownership claims"
          action={
            claimable.length ? (
              <Button
                variant="secondary"
                onClick={() => setClaiming(claimable[0]!.artifactId)}
              >
                Make a claim
              </Button>
            ) : undefined
          }
        />
        <p className="mb-3 text-sm text-ink-muted">
          People who worked on a piece can record what they believe their
          ownership is. The piece&rsquo;s owner acknowledges or disputes it. A
          claim never changes a piece&rsquo;s rights record by itself.
        </p>
        {assertions.length ? (
          <ol className="space-y-2">
            {assertions.map((a) => {
              const ownsPiece =
                pieces.find((p) => p.artifactId === a.artifact.id)?.owner.id ===
                viewerId;
              return (
                <li
                  key={a.id}
                  className={cn(
                    "rounded-2xl border border-border-soft bg-surface px-4 py-3",
                    a.status === "withdrawn" && "opacity-70",
                  )}
                >
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">
                      {a.mine ? "You" : a.creator.name}
                    </span>
                    <span className="text-ink-muted">
                      on {a.artifact.title}:
                    </span>
                    <Badge tone="accent">
                      {a.claimLabel}
                      {a.sharePercent !== null ? ` · ${a.sharePercent}%` : ""}
                    </Badge>
                    <Badge tone={STATUS_TONE[a.status]}>{a.statusLabel}</Badge>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] text-ink">
                    {a.statement}
                  </p>
                  <p className="text-sm text-ink-muted">
                    <LocalTime iso={a.at} options={{ dateStyle: "medium" }} />
                    {a.response && a.status !== "withdrawn" ? (
                      <>
                        {" · "}
                        {a.statusLabel} by {a.response.by ?? "the owner"}
                        {a.response.note ? `: “${a.response.note}”` : ""}
                      </>
                    ) : null}
                  </p>
                  {a.status !== "withdrawn" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ownsPiece && a.status !== "acknowledged" ? (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setResponding({ a, response: "acknowledge" })
                          }
                        >
                          Acknowledge
                        </Button>
                      ) : null}
                      {ownsPiece && a.status !== "disputed" ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setResponding({ a, response: "dispute" })
                          }
                        >
                          Dispute
                        </Button>
                      ) : null}
                      {a.mine ? (
                        <Button
                          variant="ghost"
                          onClick={() =>
                            setResponding({ a, response: "withdraw" })
                          }
                        >
                          Withdraw
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface/70 px-5 py-6 text-center text-[15px] text-ink-muted">
            No ownership claims recorded.
          </p>
        )}
      </section>

      <section aria-label="Rights history">
        <SectionHeader title="Rights history" />
        {history.length ? (
          <ol className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="text-[15px] text-ink">
                {h.title}
                <span className="text-sm text-ink-muted">
                  {" · "}
                  {h.actor ?? "Someone"} ·{" "}
                  <LocalTime
                    iso={h.at}
                    options={{ dateStyle: "medium", timeStyle: "short" }}
                  />
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-ink-muted">
            Nothing yet. Policy changes, claims and sign-offs are recorded here
            and can&rsquo;t be edited.
          </p>
        )}
      </section>

      {editingPolicy ? (
        <PolicyDialog
          projectId={projectId}
          policy={policy}
          onOpenChange={setEditingPolicy}
          onSaved={() => (
            setEditingPolicy(false),
            done("Rights policy saved.")
          )}
        />
      ) : null}
      {claiming ? (
        <ClaimDialog
          projectId={projectId}
          pieces={claimable}
          initial={claiming}
          onOpenChange={(o) => !o && setClaiming(null)}
          onSaved={() => (
            setClaiming(null),
            done("Claim recorded. The piece's owner will be asked to respond.")
          )}
        />
      ) : null}
      {responding ? (
        <RespondDialog
          {...responding}
          onOpenChange={(o) => !o && setResponding(null)}
          onSaved={(t) => (setResponding(null), done(t))}
        />
      ) : null}
      {signing ? (
        <SignoffDialog
          {...signing}
          onOpenChange={(o) => !o && setSigning(null)}
          onSaved={(t) => (setSigning(null), done(t))}
        />
      ) : null}
      {revoking ? (
        <Dialog open onOpenChange={(o) => !o && setRevoking(null)}>
          <DialogContent
            title={`Revoke ${revoking.name}'s access?`}
            description={`They won't be able to open or change “${revoking.piece.title}” any more. Everything they contributed stays credited to them.`}
          >
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={() => setRevoking(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  try {
                    await api(
                      `/api/v1/artifacts/${revoking.piece.artifactId}/collaborators`,
                      {
                        method: "DELETE",
                        json: { creatorId: revoking.creatorId },
                      },
                    );
                    setRevoking(null);
                    done(
                      `${revoking.name}'s access was revoked. Their credit stays.`,
                    );
                  } catch (err) {
                    setRevoking(null);
                    setMsg(errorMessage(err));
                  }
                }}
              >
                Revoke access
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function PolicyDialog({
  projectId,
  policy,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  policy: RightsPolicyView;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [derivatives, setDerivatives] = useState<DerivativePolicy>(
    policy.derivatives,
  );
  const [signoff, setSignoff] = useState(policy.publicationSignoff);
  const [attribution, setAttribution] = useState<AttributionPolicy>(
    policy.attribution,
  );
  const [agreement, setAgreement] = useState(policy.agreement ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title="Project rights policy"
        description="Applies to pieces linked to this project. Every change is kept in the rights history."
        wide
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/projects/${projectId}/rights`, {
                method: "PUT",
                json: {
                  derivatives,
                  publicationSignoff: signoff,
                  attribution,
                  agreement: agreement.trim() || null,
                },
              });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field
            label="Derivatives"
            htmlFor="policy-derivatives"
            hint={DERIVATIVE_POLICY_LABEL[derivatives].help}
          >
            <Select
              id="policy-derivatives"
              value={derivatives}
              onChange={(e) =>
                setDerivatives(e.target.value as DerivativePolicy)
              }
            >
              {DERIVATIVE_POLICIES.map((d) => (
                <option key={d} value={d}>
                  {DERIVATIVE_POLICY_LABEL[d].label}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex min-h-11 items-start gap-3 text-[15px] text-ink">
            <input
              type="checkbox"
              className="mt-1 size-5 accent-[var(--color-accent)]"
              checked={signoff}
              onChange={(e) => setSignoff(e.target.checked)}
            />
            <span>
              Require sign-off before publishing
              <span className="block text-sm text-ink-muted">
                Collaborators who can propose or edit, and co-owners on the
                rights record, approve the current version first.
              </span>
            </span>
          </label>
          <Field
            label="Attribution"
            htmlFor="policy-attribution"
            hint={ATTRIBUTION_POLICY_LABEL[attribution].help}
          >
            <Select
              id="policy-attribution"
              value={attribution}
              onChange={(e) =>
                setAttribution(e.target.value as AttributionPolicy)
              }
            >
              {ATTRIBUTION_POLICIES.map((a) => (
                <option key={a} value={a}>
                  {ATTRIBUTION_POLICY_LABEL[a].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Agreement"
            htmlFor="policy-agreement"
            hint="Optional. What the crew agreed about ownership, credit or revenue, in your own words."
          >
            <Textarea
              id="policy-agreement"
              value={agreement}
              onChange={(e) => setAgreement(e.target.value)}
              maxLength={5000}
              className="min-h-24"
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Save policy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClaimDialog({
  projectId,
  pieces,
  initial,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  pieces: PieceRightsView[];
  initial: string;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [artifactId, setArtifactId] = useState(initial);
  const [claim, setClaim] = useState<OwnershipClaim>("contributor_only");
  const [statement, setStatement] = useState("");
  const [share, setShare] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title="Make an ownership claim"
        description="Say what you believe your ownership is and why. It's a record for the crew, not a legal determination."
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await api(`/api/v1/projects/${projectId}/rights/assertions`, {
                method: "POST",
                json: {
                  artifactId,
                  claim,
                  statement,
                  sharePercent:
                    claim === "co_owner" && share.trim() ? Number(share) : null,
                },
              });
              onSaved();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label="Piece" htmlFor="claim-piece">
            <Select
              id="claim-piece"
              value={artifactId}
              onChange={(e) => setArtifactId(e.target.value)}
            >
              {pieces.map((p) => (
                <option key={p.artifactId} value={p.artifactId}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Your claim" htmlFor="claim-kind">
            <Select
              id="claim-kind"
              value={claim}
              onChange={(e) => setClaim(e.target.value as OwnershipClaim)}
            >
              {OWNERSHIP_CLAIMS.map((c) => (
                <option key={c} value={c}>
                  {OWNERSHIP_CLAIM_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>
          {claim === "co_owner" ? (
            <Field
              label="Share (%)"
              htmlFor="claim-share"
              hint="Optional. Only if one was agreed."
            >
              <Input
                id="claim-share"
                inputMode="decimal"
                value={share}
                onChange={(e) =>
                  setShare(e.target.value.replace(/[^0-9.]/g, ""))
                }
              />
            </Field>
          ) : null}
          <Field
            label="Why"
            htmlFor="claim-statement"
            hint="What you contributed and anything that was agreed."
          >
            <Textarea
              id="claim-statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              maxLength={2000}
              required
              className="min-h-24"
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!statement.trim()}>
              Record claim
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const RESPONSE_COPY = {
  acknowledge: {
    title: "Acknowledge this claim?",
    body: "You're recording that you agree with it. Update the piece's rights record separately if ownership should change.",
    button: "Acknowledge",
    done: "Claim acknowledged.",
  },
  dispute: {
    title: "Dispute this claim?",
    body: "You're recording that you don't agree. Add a note so the crew knows why.",
    button: "Dispute",
    done: "Claim disputed.",
  },
  withdraw: {
    title: "Withdraw your claim?",
    body: "It stays in the rights history, marked withdrawn.",
    button: "Withdraw",
    done: "Claim withdrawn.",
  },
} as const;

function RespondDialog({
  a,
  response,
  onOpenChange,
  onSaved,
}: {
  a: AssertionItem;
  response: "acknowledge" | "dispute" | "withdraw";
  onOpenChange: (o: boolean) => void;
  onSaved: (t: string) => void;
}) {
  const copy = RESPONSE_COPY[response];
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent
        title={copy.title}
        description={`${a.mine ? "Your" : `${a.creator.name}'s`} claim on “${a.artifact.title}”: ${a.claimLabel}. ${copy.body}`}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/api/v1/ownership-assertions/${a.id}`, {
                method: "POST",
                json: { response, note: note.trim() || null },
              });
              onSaved(copy.done);
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          {response !== "withdraw" ? (
            <Field label="Note (optional)" htmlFor="respond-note" error={error}>
              <Input
                id="respond-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
              />
            </Field>
          ) : error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={response === "acknowledge" ? "primary" : "danger"}
              loading={busy}
            >
              {copy.button}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
