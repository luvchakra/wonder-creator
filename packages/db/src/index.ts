import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Database, Json } from "./database.types";

/** Supabase client bound to the Wonder Creator schema. */
export type Db = SupabaseClient<Database>;

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

/** A non-null JSON value (jsonb columns declared NOT NULL). */
export type JsonValue = NonNullable<import("./database.types").Json>;
