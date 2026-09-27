/** Choices for the collaboration profile (P1-14) — client-safe, no server code. */

export const WORK_MODES = [
  { value: "either", label: "Remote or in person" },
  { value: "remote", label: "Remote" },
  { value: "local", label: "In person" },
] as const;
export const CONTACT_PREFERENCES = [
  { value: "anyone", label: "Anyone can message or invite me" },
  { value: "network", label: "Only people I've worked with" },
] as const;
export const RATE_VISIBILITY = [
  { value: "private", label: "Only me" },
  { value: "collaborators", label: "People I've shared a crew with" },
  { value: "public", label: "Anyone who can see my profile" },
] as const;
export const EXCLUSIVITY = [
  { value: "open", label: "Open to discussing exclusivity" },
  { value: "case_by_case", label: "Case by case" },
  { value: "non_exclusive_only", label: "Non-exclusive work only" },
] as const;
