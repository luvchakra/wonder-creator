"use client";
import { api } from "./client";

export interface SendResult {
  batchId: string;
  accepted: Array<{ id: string; materialId: string | null; state: string }>;
  rejected: Array<{ name: string; message: string }>;
}

/** Bring things in through CreatorSend. Returns the created material ids (originals are safe even if processing fails). */
export async function sendToCreator(input: { files?: File[]; urls?: string[]; text?: string; kind?: "camera" | "voice" }): Promise<SendResult> {
  const fd = new FormData();
  for (const f of input.files ?? []) fd.append("files", f, f.name);
  if (input.urls?.length) fd.append("urls", input.urls.join("\n"));
  if (input.text) fd.append("text", input.text);
  if (input.kind) fd.append("kind", input.kind);
  return api<SendResult>("/api/v1/send", { method: "POST", body: fd });
}

export const PENDING_TURN_KEY = "wc.pendingTurn";
export interface PendingTurn {
  message: string;
  materialIds: string[];
  inputMode: "text" | "voice";
  rejected?: SendResult["rejected"];
}
