/** Testimonials (docs/testimonials.md): the setting's values and copy, safe for the browser. */
export const TESTIMONIALS_FROM = ["anyone", "worked_with", "off"] as const;
export type TestimonialsFrom = (typeof TESTIMONIALS_FROM)[number];
export const TESTIMONIALS_FROM_LABEL: Record<TestimonialsFrom, string> = { anyone: "Anyone who can see my profile", worked_with: "Only people I've worked with", off: "Nobody for now" };
export const TESTIMONIALS_FROM_HINT: Record<TestimonialsFrom, string> = {
  anyone: "Each one still waits for you to show it.",
  worked_with: "A shared crew, a Creation you made together, or a Huddle you were both in.",
  off: "Existing testimonials stay as they are.",
};
