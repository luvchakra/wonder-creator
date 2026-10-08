/** What a message to the team can be about — the choices on /contact, and what the API and the table accept. */
export const CONTACT_TOPICS = ["general", "support", "feedback", "partnership", "privacy", "security"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export const CONTACT_TOPIC_LABEL: Record<ContactTopic, string> = {
  general: "A question",
  support: "Help with my account",
  feedback: "Feedback or an idea",
  partnership: "Working together",
  privacy: "My data and privacy",
  security: "A security issue",
};
