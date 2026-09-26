/** P0 domain events. Events are immutable records; consumers must be idempotent. */
export const DOMAIN_EVENTS = [
  "CreatorCreated",
  "CreatorUpdated",
  "CreativeMaterialCreated",
  "CreativeMaterialUpdated",
  "CreativeMaterialSecurityRejected",
  "ConversationStarted",
  "ConversationMessageCreated",
  "ConversationCompleted",
  "AiRunStarted",
  "AiRunCompleted",
  "AiRunFailed",
  "AiProposalCreated",
  "AiProposalApproved",
  "AiProposalRejected",
  "ArtifactCreated",
  "ArtifactUpdated",
  "ArtifactVersionCreated",
  "ArtifactDerived",
  "ArtifactPublished",
  "ArtifactLineageCreated",
  "CreativeMemoryCreated",
  "CreativeMemoryUpdated",
  "CreativeMemoryRemoved",
  "HuddleStarted",
  "HuddleJoinRequested",
  "HuddleJoinApproved",
  "HuddleJoinDeclined",
  "HuddleParticipantJoined",
  "HuddleParticipantLeft",
  "HuddleDissolving",
  "HuddleDissolved",
  "HuddleContentPreserved",
  "RightsUpdated",
] as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[number];

export type AggregateType =
  | "creator"
  | "material"
  | "conversation"
  | "ai_run"
  | "ai_proposal"
  | "artifact"
  | "memory"
  | "huddle"
  | "rights";
