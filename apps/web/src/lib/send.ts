"use client";
import { api } from "./client";

export interface SendResult {
  batchId: string;
  accepted: Array<{ id: string; materialId: string | null; state: string }>;
  rejected: Array<{ name: string; message: string }>;
}

/** Files above this go browser → storage directly (serverless request bodies are capped). */
const DIRECT_UPLOAD_OVER = 3 * 1024 * 1024;

/** Bring things in through CreatorSend. Returns the created material ids (originals are safe even if processing fails). */
export async function sendToCreator(input: { files?: File[]; urls?: string[]; text?: string; kind?: "camera" | "voice" }): Promise<SendResult> {
  const fd = new FormData();
  const files = input.files ?? [];
  const big = files.filter((f) => f.size > DIRECT_UPLOAD_OVER);
  const small = files.filter((f) => f.size <= DIRECT_UPLOAD_OVER);
  if (big.length) {
    const { uploads } = await api<{ uploads: Array<{ name: string; path: string; token: string }> }>("/api/v1/send/uploads", {
      method: "POST",
      json: { files: big.map((f) => ({ name: f.name, size: f.size })) },
    });
    // The storage client only for big files, loaded when needed: otherwise every page shipped the whole Supabase
    // client (~65 KB compressed) for this one branch (docs/performance.md, phase 4).
    const { createClient } = await import("./supabase/client");
    const storage = createClient().storage.from("creator-media");
    for (let i = 0; i < big.length; i++) {
      const u = uploads[i];
      const { error } = await storage.uploadToSignedUrl(u.path, u.token, big[i], { contentType: big[i].type || "application/octet-stream" });
      if (error) throw new Error(`We couldn't upload “${big[i].name}”. Please try again.`);
      fd.append("uploaded", `${u.path}::${big[i].name}`);
    }
  }
  for (const f of small) fd.append("files", f, f.name);
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
