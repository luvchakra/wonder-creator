import type { Enums } from "@wonder/db";

export type PrivacyClass = Enums<"privacy_class">;

export const PRIVACY_LABELS: Record<PrivacyClass, string> = {
  public: "Public",
  creator_private: "Only me",
  shared: "Shared",
  collaborator_only: "Collaborators",
  huddle_ephemeral: "Huddle only",
  system_restricted: "Restricted",
};

/** Purposes for which AI context may be assembled. */
export type ContextPurpose = "own_creation" | "huddle_assist" | "public_discovery";

/**
 * Enforced before retrieval: which privacy classes may enter an AI context for a purpose.
 * The creator's own private material can inform their own creations; nothing private ever
 * enters a context built for other people.
 */
export function allowedInContext(privacy: PrivacyClass, purpose: ContextPurpose): boolean {
  switch (purpose) {
    case "own_creation":
      return privacy !== "system_restricted";
    case "huddle_assist":
      return privacy === "public" || privacy === "huddle_ephemeral";
    case "public_discovery":
      return privacy === "public";
  }
}
