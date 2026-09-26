import type { Db, Json } from "@wonder/db";
import { fromDbError } from "../errors";
import type { AggregateType, DomainEventType } from "./types";

export * from "./types";

export interface EventInput {
  type: DomainEventType;
  aggregate: AggregateType;
  aggregateId: string | null;
  payload?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Publish a domain event. The database stamps actor, creator and tenant from the JWT,
 * so a caller can never publish an event on behalf of someone else.
 */
export async function publishEvent(db: Db, e: EventInput): Promise<string> {
  const { data, error } = await db.rpc("record_domain_event", {
    p_event_type: e.type,
    p_aggregate_type: e.aggregate,
    p_aggregate_id: e.aggregateId as string,
    p_payload: (e.payload ?? {}) as Json,
    p_correlation_id: e.correlationId,
  });
  if (error) throw fromDbError(error);
  return data as string;
}

export interface AuditInput {
  action: string;
  objectType: string;
  objectId: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

/** Append to the immutable audit log (metadata must never contain secrets or raw content). */
export async function audit(db: Db, a: AuditInput): Promise<void> {
  const { error } = await db.rpc("record_audit_log", {
    p_action: a.action,
    p_object_type: a.objectType,
    p_object_id: a.objectId as string,
    p_metadata: (a.metadata ?? {}) as Json,
    p_request_id: a.requestId,
  });
  if (error) throw fromDbError(error);
}
