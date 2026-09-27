// Server-safe (no "use client"): server pages import this string directly.

/**
 * Compact chip (compact-density §6, §33): a 32px pill inside a 44px hit area. Use for filters, section tabs and choices;
 * rows of chips scroll sideways rather than wrapping into tall stacks.
 */
export const chipBase =
  "relative inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-[13px] before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
