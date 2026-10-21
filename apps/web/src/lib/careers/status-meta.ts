import type { Metadata } from "next";

/** The status page carries an applicant's token in its address: never indexed, never sent on as a referrer. */
export const CAREERS_STATUS_METADATA: Metadata = { title: "Your application", robots: { index: false, follow: false }, referrer: "no-referrer" };
