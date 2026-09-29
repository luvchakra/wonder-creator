"use client";
import { createContext, useContext } from "react";
import { FLAGS, type Flag, type Flags } from "@/lib/flags";

/** The rollout flags resolved on the server for this request (Phase 05 §19); entry points hide what's off. */
const Ctx = createContext<Flags>(Object.fromEntries(FLAGS.map((f) => [f, true])) as Flags);

export function FeaturesProvider({ value, children }: { value: Flags; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useFeature = (f: Flag) => useContext(Ctx)[f];
