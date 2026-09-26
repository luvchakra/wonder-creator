
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_proposals": {
                  Row: {
                    "action": string,"conversation_id": string | null,"created_at": string,"creator_id": string,"domain": Database["public"]['Enums']["autonomy_domain"],"id": string,"impact": string,"payload": NonNullable<Json>,"plan": string,"resolved_at": string | null,"run_id": string | null,"status": string,"understood": string
                  }
                  Insert: {
                    "action": string,"conversation_id"?: string | null,"created_at"?: string,"creator_id": string,"domain": Database["public"]['Enums']["autonomy_domain"],"id"?: string,"impact": string,"payload"?: NonNullable<Json>,"plan": string,"resolved_at"?: string | null,"run_id"?: string | null,"status"?: string,"understood": string
                  }
                  Update: {
                    "action"?: string,"conversation_id"?: string | null,"created_at"?: string,"creator_id"?: string,"domain"?: Database["public"]['Enums']["autonomy_domain"],"id"?: string,"impact"?: string,"payload"?: NonNullable<Json>,"plan"?: string,"resolved_at"?: string | null,"run_id"?: string | null,"status"?: string,"understood"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_proposals_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_proposals_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_proposals_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "ai_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_run_steps": {
                  Row: {
                    "completed_at": string | null,"creator_id": string,"detail": NonNullable<Json>,"id": string,"run_id": string,"started_at": string,"status": string,"step": string
                  }
                  Insert: {
                    "completed_at"?: string | null,"creator_id": string,"detail"?: NonNullable<Json>,"id"?: string,"run_id": string,"started_at"?: string,"status"?: string,"step": string
                  }
                  Update: {
                    "completed_at"?: string | null,"creator_id"?: string,"detail"?: NonNullable<Json>,"id"?: string,"run_id"?: string,"started_at"?: string,"status"?: string,"step"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_run_steps_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_run_steps_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "ai_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_runs": {
                  Row: {
                    "artifact_id": string | null,"completed_at": string | null,"conversation_id": string | null,"correlation_id": string | null,"creator_id": string,"estimated_cost_usd": number | null,"failure_code": string | null,"id": string,"input_category": string | null,"input_tokens": number | null,"intent": string,"latency_ms": number | null,"model": string,"output_category": string | null,"output_tokens": number | null,"provider": string,"started_at": string,"status": string
                  }
                  Insert: {
                    "artifact_id"?: string | null,"completed_at"?: string | null,"conversation_id"?: string | null,"correlation_id"?: string | null,"creator_id": string,"estimated_cost_usd"?: number | null,"failure_code"?: string | null,"id"?: string,"input_category"?: string | null,"input_tokens"?: number | null,"intent": string,"latency_ms"?: number | null,"model": string,"output_category"?: string | null,"output_tokens"?: number | null,"provider": string,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "artifact_id"?: string | null,"completed_at"?: string | null,"conversation_id"?: string | null,"correlation_id"?: string | null,"creator_id"?: string,"estimated_cost_usd"?: number | null,"failure_code"?: string | null,"id"?: string,"input_category"?: string | null,"input_tokens"?: number | null,"intent"?: string,"latency_ms"?: number | null,"model"?: string,"output_category"?: string | null,"output_tokens"?: number | null,"provider"?: string,"started_at"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_runs_artifact_fk"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_runs_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_runs_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_tool_calls": {
                  Row: {
                    "autonomy_domain": Database["public"]['Enums']["autonomy_domain"],"created_at": string,"creator_id": string,"decision": string,"decision_reason": string | null,"id": string,"outcome": string | null,"run_id": string | null,"tool": string
                  }
                  Insert: {
                    "autonomy_domain": Database["public"]['Enums']["autonomy_domain"],"created_at"?: string,"creator_id": string,"decision": string,"decision_reason"?: string | null,"id"?: string,"outcome"?: string | null,"run_id"?: string | null,"tool": string
                  }
                  Update: {
                    "autonomy_domain"?: Database["public"]['Enums']["autonomy_domain"],"created_at"?: string,"creator_id"?: string,"decision"?: string,"decision_reason"?: string | null,"id"?: string,"outcome"?: string | null,"run_id"?: string | null,"tool"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_tool_calls_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_tool_calls_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "ai_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"artifact_contributors": {
                  Row: {
                    "added_by_creator_id": string,"artifact_id": string,"contributor_creator_id": string,"created_at": string,"role": string
                  }
                  Insert: {
                    "added_by_creator_id": string,"artifact_id": string,"contributor_creator_id": string,"created_at"?: string,"role": string
                  }
                  Update: {
                    "added_by_creator_id"?: string,"artifact_id"?: string,"contributor_creator_id"?: string,"created_at"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "artifact_contributors_added_by_creator_id_fkey"
      columns: ["added_by_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_contributors_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_contributors_contributor_creator_id_fkey"
      columns: ["contributor_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"artifact_versions": {
                  Row: {
                    "artifact_id": string,"author_kind": string,"change_summary": string | null,"content": string,"created_at": string,"created_by_ai_run_id": string | null,"created_by_creator_id": string | null,"creator_id": string,"generation_metadata": Json | null,"id": string,"label": string,"parent_version_id": string | null,"restored_from_version_id": string | null,"structured_content": Json | null,"version_number": number
                  }
                  Insert: {
                    "artifact_id": string,"author_kind": string,"change_summary"?: string | null,"content"?: string,"created_at"?: string,"created_by_ai_run_id"?: string | null,"created_by_creator_id"?: string | null,"creator_id": string,"generation_metadata"?: Json | null,"id"?: string,"label"?: string,"parent_version_id"?: string | null,"restored_from_version_id"?: string | null,"structured_content"?: Json | null,"version_number": number
                  }
                  Update: {
                    "artifact_id"?: string,"author_kind"?: string,"change_summary"?: string | null,"content"?: string,"created_at"?: string,"created_by_ai_run_id"?: string | null,"created_by_creator_id"?: string | null,"creator_id"?: string,"generation_metadata"?: Json | null,"id"?: string,"label"?: string,"parent_version_id"?: string | null,"restored_from_version_id"?: string | null,"structured_content"?: Json | null,"version_number"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "artifact_versions_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_versions_created_by_ai_run_id_fkey"
      columns: ["created_by_ai_run_id"]
isOneToOne: false
      referencedRelation: "ai_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_versions_created_by_creator_id_fkey"
      columns: ["created_by_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_versions_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_versions_parent_version_id_fkey"
      columns: ["parent_version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_versions_restored_from_version_id_fkey"
      columns: ["restored_from_version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"artifacts": {
                  Row: {
                    "artifact_type": string,"category": string,"cover_material_id": string | null,"created_at": string,"creator_id": string,"current_version_id": string | null,"description": string | null,"featured_on_profile": boolean,"id": string,"privacy": Database["public"]['Enums']["privacy_class"],"provenance_id": string,"search": unknown,"status": Database["public"]['Enums']["artifact_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "artifact_type": string,"category": string,"cover_material_id"?: string | null,"created_at"?: string,"creator_id": string,"current_version_id"?: string | null,"description"?: string | null,"featured_on_profile"?: boolean,"id"?: string,"privacy"?: Database["public"]['Enums']["privacy_class"],"provenance_id": string,"search"?: never,"status"?: Database["public"]['Enums']["artifact_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "artifact_type"?: string,"category"?: string,"cover_material_id"?: string | null,"created_at"?: string,"creator_id"?: string,"current_version_id"?: string | null,"description"?: string | null,"featured_on_profile"?: boolean,"id"?: string,"privacy"?: Database["public"]['Enums']["privacy_class"],"provenance_id"?: string,"search"?: never,"status"?: Database["public"]['Enums']["artifact_status"],"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "artifacts_cover_material_id_fkey"
      columns: ["cover_material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifacts_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifacts_current_version_fk"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifacts_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_records"
      referencedColumns: ["id"]
    }
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"actor_creator_id": string | null,"actor_user_id": string | null,"created_at": string,"id": number,"metadata": NonNullable<Json>,"object_id": string | null,"object_type": string,"request_id": string | null,"tenant_id": string | null
                  }
                  Insert: {
                    "action": string,"actor_creator_id"?: string | null,"actor_user_id"?: string | null,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"object_id"?: string | null,"object_type": string,"request_id"?: string | null,"tenant_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_creator_id"?: string | null,"actor_user_id"?: string | null,"created_at"?: string,"id"?: never,"metadata"?: NonNullable<Json>,"object_id"?: string | null,"object_type"?: string,"request_id"?: string | null,"tenant_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"conversation_attachments": {
                  Row: {
                    "artifact_id": string | null,"created_at": string,"creator_id": string,"id": string,"material_id": string | null,"message_id": string
                  }
                  Insert: {
                    "artifact_id"?: string | null,"created_at"?: string,"creator_id": string,"id"?: string,"material_id"?: string | null,"message_id": string
                  }
                  Update: {
                    "artifact_id"?: string | null,"created_at"?: string,"creator_id"?: string,"id"?: string,"material_id"?: string | null,"message_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_attachments_artifact_fk"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_attachments_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_attachments_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_attachments_message_id_fkey"
      columns: ["message_id"]
isOneToOne: false
      referencedRelation: "conversation_messages"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_messages": {
                  Row: {
                    "ai_run_id": string | null,"content": string,"conversation_id": string,"created_at": string,"creator_id": string,"id": string,"input_mode": string,"kind": string,"payload": NonNullable<Json>,"role": string,"search": unknown
                  }
                  Insert: {
                    "ai_run_id"?: string | null,"content"?: string,"conversation_id": string,"created_at"?: string,"creator_id": string,"id"?: string,"input_mode"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"role": string,"search"?: never
                  }
                  Update: {
                    "ai_run_id"?: string | null,"content"?: string,"conversation_id"?: string,"created_at"?: string,"creator_id"?: string,"id"?: string,"input_mode"?: string,"kind"?: string,"payload"?: NonNullable<Json>,"role"?: string,"search"?: never
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_messages_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"status": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creative_material_tags": {
                  Row: {
                    "creator_id": string,"material_id": string,"tag": string
                  }
                  Insert: {
                    "creator_id": string,"material_id": string,"tag": string
                  }
                  Update: {
                    "creator_id"?: string,"material_id"?: string,"tag"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creative_material_tags_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creative_material_tags_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    }
                  ]
                },"creative_materials": {
                  Row: {
                    "created_at": string,"creator_id": string,"description": string | null,"extracted_text": string | null,"id": string,"metadata": NonNullable<Json>,"privacy": Database["public"]['Enums']["privacy_class"],"processing_state": Database["public"]['Enums']["intake_state"],"provenance_id": string,"search": unknown,"security_status": Database["public"]['Enums']["security_status"],"source_note": string | null,"source_type": string | null,"source_url": string | null,"status": string,"storage_object_id": string | null,"text_content": string | null,"title": string | null,"type": Database["public"]['Enums']["material_type"],"understanding": Json | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"description"?: string | null,"extracted_text"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"privacy"?: Database["public"]['Enums']["privacy_class"],"processing_state"?: Database["public"]['Enums']["intake_state"],"provenance_id": string,"search"?: never,"security_status"?: Database["public"]['Enums']["security_status"],"source_note"?: string | null,"source_type"?: string | null,"source_url"?: string | null,"status"?: string,"storage_object_id"?: string | null,"text_content"?: string | null,"title"?: string | null,"type": Database["public"]['Enums']["material_type"],"understanding"?: Json | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"description"?: string | null,"extracted_text"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"privacy"?: Database["public"]['Enums']["privacy_class"],"processing_state"?: Database["public"]['Enums']["intake_state"],"provenance_id"?: string,"search"?: never,"security_status"?: Database["public"]['Enums']["security_status"],"source_note"?: string | null,"source_type"?: string | null,"source_url"?: string | null,"status"?: string,"storage_object_id"?: string | null,"text_content"?: string | null,"title"?: string | null,"type"?: Database["public"]['Enums']["material_type"],"understanding"?: Json | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creative_materials_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creative_materials_provenance_id_fkey"
      columns: ["provenance_id"]
isOneToOne: false
      referencedRelation: "provenance_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creative_materials_storage_object_id_fkey"
      columns: ["storage_object_id"]
isOneToOne: false
      referencedRelation: "storage_objects"
      referencedColumns: ["id"]
    }
                  ]
                },"creative_memories": {
                  Row: {
                    "category": Database["public"]['Enums']["memory_category"],"confidence": number,"created_at": string,"creator_id": string,"id": string,"last_used_at": string | null,"privacy": Database["public"]['Enums']["privacy_class"],"search": unknown,"source_id": string | null,"source_kind": string,"source_label": string | null,"statement": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "category": Database["public"]['Enums']["memory_category"],"confidence"?: number,"created_at"?: string,"creator_id": string,"id"?: string,"last_used_at"?: string | null,"privacy"?: Database["public"]['Enums']["privacy_class"],"search"?: never,"source_id"?: string | null,"source_kind": string,"source_label"?: string | null,"statement": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["memory_category"],"confidence"?: number,"created_at"?: string,"creator_id"?: string,"id"?: string,"last_used_at"?: string | null,"privacy"?: Database["public"]['Enums']["privacy_class"],"search"?: never,"source_id"?: string | null,"source_kind"?: string,"source_label"?: string | null,"statement"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creative_memories_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creative_memory_feedback": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"kind": string,"memory_id": string,"note": string | null
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"kind": string,"memory_id": string,"note"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"kind"?: string,"memory_id"?: string,"note"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "creative_memory_feedback_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creative_memory_feedback_memory_id_fkey"
      columns: ["memory_id"]
isOneToOne: false
      referencedRelation: "creative_memories"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_autonomy_policies": {
                  Row: {
                    "creator_id": string,"domain": Database["public"]['Enums']["autonomy_domain"],"level": Database["public"]['Enums']["autonomy_level"],"updated_at": string
                  }
                  Insert: {
                    "creator_id": string,"domain": Database["public"]['Enums']["autonomy_domain"],"level": Database["public"]['Enums']["autonomy_level"],"updated_at"?: string
                  }
                  Update: {
                    "creator_id"?: string,"domain"?: Database["public"]['Enums']["autonomy_domain"],"level"?: Database["public"]['Enums']["autonomy_level"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_autonomy_policies_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_blocks": {
                  Row: {
                    "blocked_creator_id": string,"blocker_creator_id": string,"created_at": string
                  }
                  Insert: {
                    "blocked_creator_id": string,"blocker_creator_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_creator_id"?: string,"blocker_creator_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_blocks_blocked_creator_id_fkey"
      columns: ["blocked_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creator_blocks_blocker_creator_id_fkey"
      columns: ["blocker_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_boundaries": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"kind": string,"label": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"kind": string,"label": string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"kind"?: string,"label"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_boundaries_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_disciplines": {
                  Row: {
                    "creator_id": string,"position": number,"value": string
                  }
                  Insert: {
                    "creator_id": string,"position"?: number,"value": string
                  }
                  Update: {
                    "creator_id"?: string,"position"?: number,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_disciplines_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_follows": {
                  Row: {
                    "created_at": string,"followed_creator_id": string,"follower_creator_id": string
                  }
                  Insert: {
                    "created_at"?: string,"followed_creator_id": string,"follower_creator_id": string
                  }
                  Update: {
                    "created_at"?: string,"followed_creator_id"?: string,"follower_creator_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_follows_followed_creator_id_fkey"
      columns: ["followed_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creator_follows_follower_creator_id_fkey"
      columns: ["follower_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_interests": {
                  Row: {
                    "creator_id": string,"position": number,"value": string
                  }
                  Insert: {
                    "creator_id": string,"position"?: number,"value": string
                  }
                  Update: {
                    "creator_id"?: string,"position"?: number,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_interests_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_languages": {
                  Row: {
                    "creator_id": string,"position": number,"value": string
                  }
                  Insert: {
                    "creator_id": string,"position"?: number,"value": string
                  }
                  Update: {
                    "creator_id"?: string,"position"?: number,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_languages_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_relationships": {
                  Row: {
                    "created_at": string,"creator_a": string,"creator_b": string,"last_met_at": string | null,"met_in_huddle_count": number
                  }
                  Insert: {
                    "created_at"?: string,"creator_a": string,"creator_b": string,"last_met_at"?: string | null,"met_in_huddle_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"creator_a"?: string,"creator_b"?: string,"last_met_at"?: string | null,"met_in_huddle_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_relationships_creator_a_fkey"
      columns: ["creator_a"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creator_relationships_creator_b_fkey"
      columns: ["creator_b"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_skills": {
                  Row: {
                    "creator_id": string,"position": number,"value": string
                  }
                  Insert: {
                    "creator_id": string,"position"?: number,"value": string
                  }
                  Update: {
                    "creator_id"?: string,"position"?: number,"value"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_skills_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creator_voice_profiles": {
                  Row: {
                    "code_switching": boolean,"color_preferences": (string)[],"composition_notes": string | null,"creator_id": string,"experimentation": string,"formality": string | null,"language_style": string | null,"narrative_style": string | null,"recurring_themes": (string)[],"tones": (string)[],"updated_at": string,"visual_moods": (string)[],"visual_styles": (string)[],"vocabulary": string | null,"writing_style": string | null
                  }
                  Insert: {
                    "code_switching"?: boolean,"color_preferences"?: (string)[],"composition_notes"?: string | null,"creator_id": string,"experimentation"?: string,"formality"?: string | null,"language_style"?: string | null,"narrative_style"?: string | null,"recurring_themes"?: (string)[],"tones"?: (string)[],"updated_at"?: string,"visual_moods"?: (string)[],"visual_styles"?: (string)[],"vocabulary"?: string | null,"writing_style"?: string | null
                  }
                  Update: {
                    "code_switching"?: boolean,"color_preferences"?: (string)[],"composition_notes"?: string | null,"creator_id"?: string,"experimentation"?: string,"formality"?: string | null,"language_style"?: string | null,"narrative_style"?: string | null,"recurring_themes"?: (string)[],"tones"?: (string)[],"updated_at"?: string,"visual_moods"?: (string)[],"visual_styles"?: (string)[],"vocabulary"?: string | null,"writing_style"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_voice_profiles_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: true
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"creators": {
                  Row: {
                    "avatar_object_id": string | null,"bio": string | null,"collaboration_availability": string,"created_at": string,"display_name": string,"handle": string | null,"id": string,"location": string | null,"onboarding_step": string,"show_location": boolean,"tenant_id": string,"updated_at": string,"user_id": string,"visibility": Database["public"]['Enums']["profile_visibility"]
                  }
                  Insert: {
                    "avatar_object_id"?: string | null,"bio"?: string | null,"collaboration_availability"?: string,"created_at"?: string,"display_name"?: string,"handle"?: string | null,"id"?: string,"location"?: string | null,"onboarding_step"?: string,"show_location"?: boolean,"tenant_id": string,"updated_at"?: string,"user_id": string,"visibility"?: Database["public"]['Enums']["profile_visibility"]
                  }
                  Update: {
                    "avatar_object_id"?: string | null,"bio"?: string | null,"collaboration_availability"?: string,"created_at"?: string,"display_name"?: string,"handle"?: string | null,"id"?: string,"location"?: string | null,"onboarding_step"?: string,"show_location"?: boolean,"tenant_id"?: string,"updated_at"?: string,"user_id"?: string,"visibility"?: Database["public"]['Enums']["profile_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "creators_avatar_fk"
      columns: ["avatar_object_id"]
isOneToOne: false
      referencedRelation: "storage_objects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "creators_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"domain_events": {
                  Row: {
                    "aggregate_id": string | null,"aggregate_type": string,"correlation_id": string | null,"creator_id": string | null,"event_type": string,"id": string,"occurred_at": string,"payload": NonNullable<Json>,"tenant_id": string | null
                  }
                  Insert: {
                    "aggregate_id"?: string | null,"aggregate_type": string,"correlation_id"?: string | null,"creator_id"?: string | null,"event_type": string,"id"?: string,"occurred_at"?: string,"payload"?: NonNullable<Json>,"tenant_id"?: string | null
                  }
                  Update: {
                    "aggregate_id"?: string | null,"aggregate_type"?: string,"correlation_id"?: string | null,"creator_id"?: string | null,"event_type"?: string,"id"?: string,"occurred_at"?: string,"payload"?: NonNullable<Json>,"tenant_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"event_consumptions": {
                  Row: {
                    "consumer": string,"event_id": string,"processed_at": string
                  }
                  Insert: {
                    "consumer": string,"event_id": string,"processed_at"?: string
                  }
                  Update: {
                    "consumer"?: string,"event_id"?: string,"processed_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_consumptions_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "domain_events"
      referencedColumns: ["id"]
    }
                  ]
                },"huddle_events": {
                  Row: {
                    "created_at": string,"creator_id": string | null,"event": string,"huddle_id": string,"id": number
                  }
                  Insert: {
                    "created_at"?: string,"creator_id"?: string | null,"event": string,"huddle_id": string,"id"?: never
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string | null,"event"?: string,"huddle_id"?: string,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"huddle_invitations": {
                  Row: {
                    "created_at": string,"huddle_id": string,"invited_by_creator_id": string,"invitee_creator_id": string
                  }
                  Insert: {
                    "created_at"?: string,"huddle_id": string,"invited_by_creator_id": string,"invitee_creator_id": string
                  }
                  Update: {
                    "created_at"?: string,"huddle_id"?: string,"invited_by_creator_id"?: string,"invitee_creator_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "huddle_invitations_huddle_id_fkey"
      columns: ["huddle_id"]
isOneToOne: false
      referencedRelation: "huddles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddle_invitations_invited_by_creator_id_fkey"
      columns: ["invited_by_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddle_invitations_invitee_creator_id_fkey"
      columns: ["invitee_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"huddle_join_requests": {
                  Row: {
                    "created_at": string,"huddle_id": string,"id": string,"message": string | null,"requester_creator_id": string,"resolved_at": string | null,"resolved_by_creator_id": string | null,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"huddle_id": string,"id"?: string,"message"?: string | null,"requester_creator_id": string,"resolved_at"?: string | null,"resolved_by_creator_id"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"huddle_id"?: string,"id"?: string,"message"?: string | null,"requester_creator_id"?: string,"resolved_at"?: string | null,"resolved_by_creator_id"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "huddle_join_requests_huddle_id_fkey"
      columns: ["huddle_id"]
isOneToOne: false
      referencedRelation: "huddles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddle_join_requests_requester_creator_id_fkey"
      columns: ["requester_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddle_join_requests_resolved_by_creator_id_fkey"
      columns: ["resolved_by_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"huddle_messages": {
                  Row: {
                    "body": string,"created_at": string,"creator_id": string,"huddle_id": string,"id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"creator_id": string,"huddle_id": string,"id"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"creator_id"?: string,"huddle_id"?: string,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "huddle_messages_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddle_messages_huddle_id_fkey"
      columns: ["huddle_id"]
isOneToOne: false
      referencedRelation: "huddles"
      referencedColumns: ["id"]
    }
                  ]
                },"huddle_participants": {
                  Row: {
                    "audio_on": boolean,"creator_id": string,"huddle_id": string,"joined_at": string | null,"last_seen_at": string,"left_at": string | null,"role": string,"status": string,"video_on": boolean
                  }
                  Insert: {
                    "audio_on"?: boolean,"creator_id": string,"huddle_id": string,"joined_at"?: string | null,"last_seen_at"?: string,"left_at"?: string | null,"role": string,"status": string,"video_on"?: boolean
                  }
                  Update: {
                    "audio_on"?: boolean,"creator_id"?: string,"huddle_id"?: string,"joined_at"?: string | null,"last_seen_at"?: string,"left_at"?: string | null,"role"?: string,"status"?: string,"video_on"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "huddle_participants_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddle_participants_huddle_id_fkey"
      columns: ["huddle_id"]
isOneToOne: false
      referencedRelation: "huddles"
      referencedColumns: ["id"]
    }
                  ]
                },"huddle_preserved_items": {
                  Row: {
                    "artifact_id": string | null,"created_at": string,"creator_id": string,"huddle_id": string,"id": string,"kind": string,"material_id": string | null
                  }
                  Insert: {
                    "artifact_id"?: string | null,"created_at"?: string,"creator_id": string,"huddle_id": string,"id"?: string,"kind": string,"material_id"?: string | null
                  }
                  Update: {
                    "artifact_id"?: string | null,"created_at"?: string,"creator_id"?: string,"huddle_id"?: string,"id"?: string,"kind"?: string,"material_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "huddle_preserved_items_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddle_preserved_items_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddle_preserved_items_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    }
                  ]
                },"huddles": {
                  Row: {
                    "discoverability": string,"dissolved_at": string | null,"id": string,"media_room_id": string | null,"started_at": string,"started_by_creator_id": string | null,"status": string,"topic": string | null
                  }
                  Insert: {
                    "discoverability"?: string,"dissolved_at"?: string | null,"id"?: string,"media_room_id"?: string | null,"started_at"?: string,"started_by_creator_id"?: string | null,"status"?: string,"topic"?: string | null
                  }
                  Update: {
                    "discoverability"?: string,"dissolved_at"?: string | null,"id"?: string,"media_room_id"?: string | null,"started_at"?: string,"started_by_creator_id"?: string | null,"status"?: string,"topic"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "huddles_started_by_creator_id_fkey"
      columns: ["started_by_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"intake_items": {
                  Row: {
                    "attempts": number,"batch_id": string,"created_at": string,"creator_id": string,"error_code": string | null,"error_message": string | null,"id": string,"input_kind": string,"instruction": string | null,"material_id": string | null,"source_url": string | null,"state": Database["public"]['Enums']["intake_state"],"storage_object_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"batch_id": string,"created_at"?: string,"creator_id": string,"error_code"?: string | null,"error_message"?: string | null,"id"?: string,"input_kind": string,"instruction"?: string | null,"material_id"?: string | null,"source_url"?: string | null,"state"?: Database["public"]['Enums']["intake_state"],"storage_object_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"batch_id"?: string,"created_at"?: string,"creator_id"?: string,"error_code"?: string | null,"error_message"?: string | null,"id"?: string,"input_kind"?: string,"instruction"?: string | null,"material_id"?: string | null,"source_url"?: string | null,"state"?: Database["public"]['Enums']["intake_state"],"storage_object_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "intake_items_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intake_items_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "intake_items_storage_object_id_fkey"
      columns: ["storage_object_id"]
isOneToOne: false
      referencedRelation: "storage_objects"
      referencedColumns: ["id"]
    }
                  ]
                },"jobs": {
                  Row: {
                    "attempts": number,"created_at": string,"creator_id": string,"id": string,"idempotency_key": string | null,"kind": string,"last_error": string | null,"max_attempts": number,"payload": NonNullable<Json>,"run_after": string,"status": Database["public"]['Enums']["job_status"],"subject_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"creator_id": string,"id"?: string,"idempotency_key"?: string | null,"kind": string,"last_error"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: Database["public"]['Enums']["job_status"],"subject_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"creator_id"?: string,"id"?: string,"idempotency_key"?: string | null,"kind"?: string,"last_error"?: string | null,"max_attempts"?: number,"payload"?: NonNullable<Json>,"run_after"?: string,"status"?: Database["public"]['Enums']["job_status"],"subject_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"licenses": {
                  Row: {
                    "attribution_required": boolean,"created_at": string,"creator_id": string,"derivatives_allowed": boolean,"ends_on": string | null,"exclusive": boolean,"id": string,"license_type": string,"licensee_name": string | null,"modification_allowed": boolean,"resale_allowed": boolean,"rights_id": string,"starts_on": string | null,"status": string,"territory": string
                  }
                  Insert: {
                    "attribution_required"?: boolean,"created_at"?: string,"creator_id": string,"derivatives_allowed"?: boolean,"ends_on"?: string | null,"exclusive"?: boolean,"id"?: string,"license_type": string,"licensee_name"?: string | null,"modification_allowed"?: boolean,"resale_allowed"?: boolean,"rights_id": string,"starts_on"?: string | null,"status"?: string,"territory"?: string
                  }
                  Update: {
                    "attribution_required"?: boolean,"created_at"?: string,"creator_id"?: string,"derivatives_allowed"?: boolean,"ends_on"?: string | null,"exclusive"?: boolean,"id"?: string,"license_type"?: string,"licensee_name"?: string | null,"modification_allowed"?: boolean,"resale_allowed"?: boolean,"rights_id"?: string,"starts_on"?: string | null,"status"?: string,"territory"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "licenses_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "licenses_rights_id_fkey"
      columns: ["rights_id"]
isOneToOne: false
      referencedRelation: "rights_records"
      referencedColumns: ["id"]
    }
                  ]
                },"lineage_edges": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"relationship": Database["public"]['Enums']["lineage_relationship"],"source_id": string,"source_type": string,"target_id": string,"target_type": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"relationship": Database["public"]['Enums']["lineage_relationship"],"source_id": string,"source_type": string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"relationship"?: Database["public"]['Enums']["lineage_relationship"],"source_id"?: string,"source_type"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lineage_edges_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"material_collection_items": {
                  Row: {
                    "added_at": string,"collection_id": string,"creator_id": string,"material_id": string
                  }
                  Insert: {
                    "added_at"?: string,"collection_id": string,"creator_id": string,"material_id": string
                  }
                  Update: {
                    "added_at"?: string,"collection_id"?: string,"creator_id"?: string,"material_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_collection_items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "material_collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "material_collection_items_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "material_collection_items_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    }
                  ]
                },"material_collections": {
                  Row: {
                    "created_at": string,"creator_id": string,"description": string | null,"id": string,"name": string,"privacy": Database["public"]['Enums']["privacy_class"]
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"description"?: string | null,"id"?: string,"name": string,"privacy"?: Database["public"]['Enums']["privacy_class"]
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"description"?: string | null,"id"?: string,"name"?: string,"privacy"?: Database["public"]['Enums']["privacy_class"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_collections_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_reports": {
                  Row: {
                    "context_id": string | null,"context_type": string,"created_at": string,"details": string | null,"id": string,"reason": string,"reported_creator_id": string | null,"reporter_creator_id": string,"status": string
                  }
                  Insert: {
                    "context_id"?: string | null,"context_type": string,"created_at"?: string,"details"?: string | null,"id"?: string,"reason": string,"reported_creator_id"?: string | null,"reporter_creator_id": string,"status"?: string
                  }
                  Update: {
                    "context_id"?: string | null,"context_type"?: string,"created_at"?: string,"details"?: string | null,"id"?: string,"reason"?: string,"reported_creator_id"?: string | null,"reporter_creator_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_reports_reported_creator_id_fkey"
      columns: ["reported_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_reports_reporter_creator_id_fkey"
      columns: ["reporter_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"provenance_records": {
                  Row: {
                    "ai_run_id": string | null,"conversation_id": string | null,"creator_id": string,"details": NonNullable<Json>,"huddle_id": string | null,"id": string,"origin": string,"original_filename": string | null,"received_at": string,"sha256": string | null,"source_url": string | null
                  }
                  Insert: {
                    "ai_run_id"?: string | null,"conversation_id"?: string | null,"creator_id": string,"details"?: NonNullable<Json>,"huddle_id"?: string | null,"id"?: string,"origin": string,"original_filename"?: string | null,"received_at"?: string,"sha256"?: string | null,"source_url"?: string | null
                  }
                  Update: {
                    "ai_run_id"?: string | null,"conversation_id"?: string | null,"creator_id"?: string,"details"?: NonNullable<Json>,"huddle_id"?: string | null,"id"?: string,"origin"?: string,"original_filename"?: string | null,"received_at"?: string,"sha256"?: string | null,"source_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "provenance_records_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"quality_reports": {
                  Row: {
                    "ai_run_id": string | null,"artifact_id": string,"checks": NonNullable<Json>,"created_at": string,"creator_id": string,"id": string,"suggestions": NonNullable<Json>,"version_id": string
                  }
                  Insert: {
                    "ai_run_id"?: string | null,"artifact_id": string,"checks"?: NonNullable<Json>,"created_at"?: string,"creator_id": string,"id"?: string,"suggestions"?: NonNullable<Json>,"version_id": string
                  }
                  Update: {
                    "ai_run_id"?: string | null,"artifact_id"?: string,"checks"?: NonNullable<Json>,"created_at"?: string,"creator_id"?: string,"id"?: string,"suggestions"?: NonNullable<Json>,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quality_reports_ai_run_id_fkey"
      columns: ["ai_run_id"]
isOneToOne: false
      referencedRelation: "ai_runs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quality_reports_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quality_reports_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quality_reports_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limit_counters": {
                  Row: {
                    "count": number,"key": string,"window_start": string
                  }
                  Insert: {
                    "count"?: number,"key": string,"window_start": string
                  }
                  Update: {
                    "count"?: number,"key"?: string,"window_start"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reference_items": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"material_id": string,"note": string | null,"shelf_id": string | null,"tags": (string)[]
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"material_id": string,"note"?: string | null,"shelf_id"?: string | null,"tags"?: (string)[]
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"material_id"?: string,"note"?: string | null,"shelf_id"?: string | null,"tags"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "reference_items_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reference_items_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reference_items_shelf_id_fkey"
      columns: ["shelf_id"]
isOneToOne: false
      referencedRelation: "reference_shelves"
      referencedColumns: ["id"]
    }
                  ]
                },"reference_shelves": {
                  Row: {
                    "created_at": string,"creator_id": string,"description": string | null,"id": string,"name": string,"position": number
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"description"?: string | null,"id"?: string,"name": string,"position"?: number
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"description"?: string | null,"id"?: string,"name"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reference_shelves_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"rights_events": {
                  Row: {
                    "created_at": string,"creator_id": string,"details": NonNullable<Json>,"event": string,"id": string,"rights_id": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"details"?: NonNullable<Json>,"event": string,"id"?: string,"rights_id": string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"details"?: NonNullable<Json>,"event"?: string,"id"?: string,"rights_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rights_events_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rights_events_rights_id_fkey"
      columns: ["rights_id"]
isOneToOne: false
      referencedRelation: "rights_records"
      referencedColumns: ["id"]
    }
                  ]
                },"rights_owners": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"owner_creator_id": string | null,"owner_name": string,"rights_id": string,"share_percent": number
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"owner_creator_id"?: string | null,"owner_name": string,"rights_id": string,"share_percent": number
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"owner_creator_id"?: string | null,"owner_name"?: string,"rights_id"?: string,"share_percent"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rights_owners_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rights_owners_owner_creator_id_fkey"
      columns: ["owner_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rights_owners_rights_id_fkey"
      columns: ["rights_id"]
isOneToOne: false
      referencedRelation: "rights_records"
      referencedColumns: ["id"]
    }
                  ]
                },"rights_records": {
                  Row: {
                    "artifact_id": string,"attribution_required": boolean,"copyright_holder": string,"copyright_registration": string | null,"created_at": string,"creator_id": string,"derivatives_allowed": boolean,"id": string,"notes": string | null,"ownership_kind": string,"updated_at": string
                  }
                  Insert: {
                    "artifact_id": string,"attribution_required"?: boolean,"copyright_holder": string,"copyright_registration"?: string | null,"created_at"?: string,"creator_id": string,"derivatives_allowed"?: boolean,"id"?: string,"notes"?: string | null,"ownership_kind"?: string,"updated_at"?: string
                  }
                  Update: {
                    "artifact_id"?: string,"attribution_required"?: boolean,"copyright_holder"?: string,"copyright_registration"?: string | null,"created_at"?: string,"creator_id"?: string,"derivatives_allowed"?: boolean,"id"?: string,"notes"?: string | null,"ownership_kind"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rights_records_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: true
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rights_records_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"search_embeddings": {
                  Row: {
                    "content_hash": string,"creator_id": string,"embedding": string,"model": string,"subject_id": string,"subject_type": string,"updated_at": string
                  }
                  Insert: {
                    "content_hash": string,"creator_id": string,"embedding": string,"model": string,"subject_id": string,"subject_type": string,"updated_at"?: string
                  }
                  Update: {
                    "content_hash"?: string,"creator_id"?: string,"embedding"?: string,"model"?: string,"subject_id"?: string,"subject_type"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "search_embeddings_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"storage_objects": {
                  Row: {
                    "bucket": string,"created_at": string,"creator_id": string,"declared_mime_type": string | null,"id": string,"mime_type": string,"original_filename": string | null,"path": string,"privacy": Database["public"]['Enums']["privacy_class"],"security_status": string,"sha256": string,"size_bytes": number
                  }
                  Insert: {
                    "bucket": string,"created_at"?: string,"creator_id": string,"declared_mime_type"?: string | null,"id"?: string,"mime_type": string,"original_filename"?: string | null,"path": string,"privacy"?: Database["public"]['Enums']["privacy_class"],"security_status"?: string,"sha256": string,"size_bytes": number
                  }
                  Update: {
                    "bucket"?: string,"created_at"?: string,"creator_id"?: string,"declared_mime_type"?: string | null,"id"?: string,"mime_type"?: string,"original_filename"?: string | null,"path"?: string,"privacy"?: Database["public"]['Enums']["privacy_class"],"security_status"?: string,"sha256"?: string,"size_bytes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "storage_objects_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_memberships": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["tenant_role"],"tenant_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["tenant_role"],"tenant_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["tenant_role"],"tenant_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_memberships_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"name": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_artifact_version":
{ Args: { "p_ai_run_id"?: string,"p_artifact_id": string,"p_author_kind": string,"p_change_summary"?: string,"p_content": string,"p_generation_metadata"?: Json,"p_label": string,"p_restored_from"?: string,"p_structured_content"?: Json }; Returns: {
              "artifact_id": string,
"author_kind": string,
"change_summary": string | null,
"content": string,
"created_at": string,
"created_by_ai_run_id": string | null,
"created_by_creator_id": string | null,
"creator_id": string,
"generation_metadata": Json | null,
"id": string,
"label": string,
"parent_version_id": string | null,
"restored_from_version_id": string | null,
"structured_content": Json | null,
"version_number": number
            }
                          SetofOptions: {
        from: "*"
        to: "artifact_versions"
        isOneToOne: true
        isSetofReturn: false
      } },
"handle_available":
{ Args: { "p_handle": string }; Returns: boolean
                           },
"huddle_cancel_request":
{ Args: { "p_request": string }; Returns: undefined
                           },
"huddle_cleanup_stale":
{ Args: { "p_timeout_seconds"?: number }; Returns: number
                           },
"huddle_end":
{ Args: { "p_huddle": string }; Returns: undefined
                           },
"huddle_enter":
{ Args: { "p_huddle": string }; Returns: undefined
                           },
"huddle_heartbeat":
{ Args: { "p_audio"?: boolean,"p_huddle": string,"p_video"?: boolean }; Returns: string
                           },
"huddle_invite":
{ Args: { "p_huddle": string,"p_invitee": string }; Returns: undefined
                           },
"huddle_leave":
{ Args: { "p_huddle": string }; Returns: boolean
                           },
"huddle_remove_participant":
{ Args: { "p_creator": string,"p_huddle": string }; Returns: undefined
                           },
"huddle_request_join":
{ Args: { "p_huddle": string,"p_message"?: string }; Returns: string
                           },
"huddle_resolve_request":
{ Args: { "p_approve": boolean,"p_request": string }; Returns: undefined
                           },
"huddle_start":
{ Args: { "p_discoverability"?: string,"p_topic": string }; Returns: string
                           },
"live_huddle_cards":
{ Args: { "p_creator"?: string,"p_limit"?: number }; Returns: {
              "huddle_id": string,"participant_count": number,"participant_ids": (string)[],"participant_names": (string)[],"started_at": string,"topic": string,"viewer_state": string
            }[]
                           },
"rate_limit_hit":
{ Args: { "p_key": string,"p_limit": number,"p_window_seconds": number }; Returns: boolean
                           },
"record_audit_log":
{ Args: { "p_action": string,"p_metadata"?: Json,"p_object_id": string,"p_object_type": string,"p_request_id"?: string }; Returns: undefined
                           },
"record_domain_event":
{ Args: { "p_aggregate_id": string,"p_aggregate_type": string,"p_correlation_id"?: string,"p_event_type": string,"p_payload"?: Json }; Returns: string
                           },
"semantic_search":
{ Args: { "p_limit"?: number,"p_min_similarity"?: number,"p_query": string }; Returns: {
              "similarity": number,"subject_id": string,"subject_type": string
            }[]
                           },
"similar_materials":
{ Args: { "p_limit"?: number,"p_material": string,"p_min_similarity"?: number }; Returns: {
              "material_id": string,"similarity": number
            }[]
                           },
"stale_search_subjects":
{ Args: { "p_creator"?: string,"p_limit"?: number }; Returns: {
              "creator_id": string,"subject_id": string,"subject_type": string
            }[]
                           }
          }
          Enums: {
            "artifact_status": "draft"|"in_review"|"final"|"published"|"archived","autonomy_domain": "creative_generation"|"research"|"transformation"|"organization"|"collaboration"|"communication"|"publishing"|"commerce"|"rights"|"destructive_actions","autonomy_level": "never"|"observe"|"suggest"|"draft"|"execute_with_approval"|"auto_execute","intake_state": "received"|"validating"|"security_review"|"extracting"|"normalizing"|"understood"|"ready"|"failed"|"quarantined","job_status": "pending"|"running"|"succeeded"|"failed"|"dead","lineage_relationship": "created_from"|"derived_from"|"adapted_from"|"references"|"contains_material"|"inspired_by"|"version_of","material_type": "idea"|"note"|"text"|"voice"|"image"|"sketch"|"document"|"pdf"|"audio"|"video"|"url"|"reference"|"research"|"conversation"|"inspiration","memory_category": "creative_preference"|"creative_voice"|"style_preference"|"creative_fact"|"creative_history"|"relationship_context"|"project_context"|"recurring_theme","privacy_class": "public"|"creator_private"|"shared"|"collaborator_only"|"huddle_ephemeral"|"system_restricted","profile_visibility": "public"|"creators_only"|"private","security_status": "pending"|"clean"|"quarantined"|"rejected","tenant_role": "owner"|"admin"|"member"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "artifact_status": ["draft", "in_review", "final", "published", "archived"],"autonomy_domain": ["creative_generation", "research", "transformation", "organization", "collaboration", "communication", "publishing", "commerce", "rights", "destructive_actions"],"autonomy_level": ["never", "observe", "suggest", "draft", "execute_with_approval", "auto_execute"],"intake_state": ["received", "validating", "security_review", "extracting", "normalizing", "understood", "ready", "failed", "quarantined"],"job_status": ["pending", "running", "succeeded", "failed", "dead"],"lineage_relationship": ["created_from", "derived_from", "adapted_from", "references", "contains_material", "inspired_by", "version_of"],"material_type": ["idea", "note", "text", "voice", "image", "sketch", "document", "pdf", "audio", "video", "url", "reference", "research", "conversation", "inspiration"],"memory_category": ["creative_preference", "creative_voice", "style_preference", "creative_fact", "creative_history", "relationship_context", "project_context", "recurring_theme"],"privacy_class": ["public", "creator_private", "shared", "collaborator_only", "huddle_ephemeral", "system_restricted"],"profile_visibility": ["public", "creators_only", "private"],"security_status": ["pending", "clean", "quarantined", "rejected"],"tenant_role": ["owner", "admin", "member"]
          }
        }
} as const

