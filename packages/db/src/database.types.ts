
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
                    "action": string,"conversation_id": string | null,"created_at": string,"creator_id": string,"decision_note": string | null,"domain": Database["public"]['Enums']["autonomy_domain"],"expires_at": string,"id": string,"impact": string,"payload": NonNullable<Json>,"plan": string,"resolved_at": string | null,"run_id": string | null,"status": string,"supersedes": string | null,"understood": string
                  }
                  Insert: {
                    "action": string,"conversation_id"?: string | null,"created_at"?: string,"creator_id": string,"decision_note"?: string | null,"domain": Database["public"]['Enums']["autonomy_domain"],"expires_at"?: string,"id"?: string,"impact": string,"payload"?: NonNullable<Json>,"plan": string,"resolved_at"?: string | null,"run_id"?: string | null,"status"?: string,"supersedes"?: string | null,"understood": string
                  }
                  Update: {
                    "action"?: string,"conversation_id"?: string | null,"created_at"?: string,"creator_id"?: string,"decision_note"?: string | null,"domain"?: Database["public"]['Enums']["autonomy_domain"],"expires_at"?: string,"id"?: string,"impact"?: string,"payload"?: NonNullable<Json>,"plan"?: string,"resolved_at"?: string | null,"run_id"?: string | null,"status"?: string,"supersedes"?: string | null,"understood"?: string
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
    },{
      foreignKeyName: "ai_proposals_supersedes_fkey"
      columns: ["supersedes"]
isOneToOne: false
      referencedRelation: "ai_proposals"
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
                    "artifact_id": string | null,"cancel_requested_at": string | null,"completed_at": string | null,"conversation_id": string | null,"correlation_id": string | null,"creator_id": string,"estimated_cost_usd": number | null,"failure_code": string | null,"id": string,"input_category": string | null,"input_tokens": number | null,"intent": string,"intent_brief": Json | null,"latency_ms": number | null,"model": string,"output_category": string | null,"output_tokens": number | null,"provider": string,"request": Json | null,"retry_of": string | null,"started_at": string,"status": string
                  }
                  Insert: {
                    "artifact_id"?: string | null,"cancel_requested_at"?: string | null,"completed_at"?: string | null,"conversation_id"?: string | null,"correlation_id"?: string | null,"creator_id": string,"estimated_cost_usd"?: number | null,"failure_code"?: string | null,"id"?: string,"input_category"?: string | null,"input_tokens"?: number | null,"intent": string,"intent_brief"?: Json | null,"latency_ms"?: number | null,"model": string,"output_category"?: string | null,"output_tokens"?: number | null,"provider": string,"request"?: Json | null,"retry_of"?: string | null,"started_at"?: string,"status"?: string
                  }
                  Update: {
                    "artifact_id"?: string | null,"cancel_requested_at"?: string | null,"completed_at"?: string | null,"conversation_id"?: string | null,"correlation_id"?: string | null,"creator_id"?: string,"estimated_cost_usd"?: number | null,"failure_code"?: string | null,"id"?: string,"input_category"?: string | null,"input_tokens"?: number | null,"intent"?: string,"intent_brief"?: Json | null,"latency_ms"?: number | null,"model"?: string,"output_category"?: string | null,"output_tokens"?: number | null,"provider"?: string,"request"?: Json | null,"retry_of"?: string | null,"started_at"?: string,"status"?: string
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
    },{
      foreignKeyName: "ai_runs_retry_of_fkey"
      columns: ["retry_of"]
isOneToOne: true
      referencedRelation: "ai_runs"
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
                },"artifact_change_proposals": {
                  Row: {
                    "artifact_id": string,"base_version_id": string,"content": string,"created_at": string,"creator_id": string | null,"decided_at": string | null,"decided_by": string | null,"decision_note": string | null,"id": string,"resulting_version_id": string | null,"status": string,"summary": string
                  }
                  Insert: {
                    "artifact_id": string,"base_version_id": string,"content": string,"created_at"?: string,"creator_id"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"resulting_version_id"?: string | null,"status"?: string,"summary": string
                  }
                  Update: {
                    "artifact_id"?: string,"base_version_id"?: string,"content"?: string,"created_at"?: string,"creator_id"?: string | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_note"?: string | null,"id"?: string,"resulting_version_id"?: string | null,"status"?: string,"summary"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "artifact_change_proposals_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_change_proposals_base_version_id_fkey"
      columns: ["base_version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_change_proposals_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_change_proposals_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_change_proposals_resulting_version_id_fkey"
      columns: ["resulting_version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"artifact_comments": {
                  Row: {
                    "artifact_id": string,"body": string,"created_at": string,"creator_id": string | null,"id": string,"quote": string | null,"resolved_at": string | null,"resolved_by": string | null,"version_id": string | null
                  }
                  Insert: {
                    "artifact_id": string,"body": string,"created_at"?: string,"creator_id"?: string | null,"id"?: string,"quote"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"version_id"?: string | null
                  }
                  Update: {
                    "artifact_id"?: string,"body"?: string,"created_at"?: string,"creator_id"?: string | null,"id"?: string,"quote"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "artifact_comments_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_comments_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_comments_resolved_by_fkey"
      columns: ["resolved_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_comments_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"artifact_contributors": {
                  Row: {
                    "access": string,"added_by_creator_id": string,"artifact_id": string,"contributor_creator_id": string,"created_at": string,"role": string
                  }
                  Insert: {
                    "access"?: string,"added_by_creator_id": string,"artifact_id": string,"contributor_creator_id": string,"created_at"?: string,"role": string
                  }
                  Update: {
                    "access"?: string,"added_by_creator_id"?: string,"artifact_id"?: string,"contributor_creator_id"?: string,"created_at"?: string,"role"?: string
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
                },"artifact_shares": {
                  Row: {
                    "allow_download": boolean,"allow_embed": boolean,"artifact_id": string,"created_at": string,"creator_id": string,"expires_at": string | null,"id": string,"kind": string,"label": string | null,"last_accessed_at": string | null,"recipient_creator_id": string | null,"revoked_at": string | null,"token_hash": string | null,"version_id": string | null
                  }
                  Insert: {
                    "allow_download"?: boolean,"allow_embed"?: boolean,"artifact_id": string,"created_at"?: string,"creator_id": string,"expires_at"?: string | null,"id"?: string,"kind": string,"label"?: string | null,"last_accessed_at"?: string | null,"recipient_creator_id"?: string | null,"revoked_at"?: string | null,"token_hash"?: string | null,"version_id"?: string | null
                  }
                  Update: {
                    "allow_download"?: boolean,"allow_embed"?: boolean,"artifact_id"?: string,"created_at"?: string,"creator_id"?: string,"expires_at"?: string | null,"id"?: string,"kind"?: string,"label"?: string | null,"last_accessed_at"?: string | null,"recipient_creator_id"?: string | null,"revoked_at"?: string | null,"token_hash"?: string | null,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "artifact_shares_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_shares_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_shares_recipient_creator_id_fkey"
      columns: ["recipient_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "artifact_shares_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
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
                    "artifact_type": string,"category": string,"cover_material_id": string | null,"created_at": string,"creator_id": string,"current_version_id": string | null,"description": string | null,"featured_on_profile": boolean,"id": string,"made_for": string | null,"privacy": Database["public"]['Enums']["privacy_class"],"provenance_id": string,"search": unknown,"status": Database["public"]['Enums']["artifact_status"],"title": string,"updated_at": string
                  }
                  Insert: {
                    "artifact_type": string,"category": string,"cover_material_id"?: string | null,"created_at"?: string,"creator_id": string,"current_version_id"?: string | null,"description"?: string | null,"featured_on_profile"?: boolean,"id"?: string,"made_for"?: string | null,"privacy"?: Database["public"]['Enums']["privacy_class"],"provenance_id": string,"search"?: never,"status"?: Database["public"]['Enums']["artifact_status"],"title": string,"updated_at"?: string
                  }
                  Update: {
                    "artifact_type"?: string,"category"?: string,"cover_material_id"?: string | null,"created_at"?: string,"creator_id"?: string,"current_version_id"?: string | null,"description"?: string | null,"featured_on_profile"?: boolean,"id"?: string,"made_for"?: string | null,"privacy"?: Database["public"]['Enums']["privacy_class"],"provenance_id"?: string,"search"?: never,"status"?: Database["public"]['Enums']["artifact_status"],"title"?: string,"updated_at"?: string
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
                },"brand_profiles": {
                  Row: {
                    "commercial_boundaries": string | null,"creator_id": string,"deliverables": (string)[],"exclusivity": string | null,"expertise": (string)[],"industries": (string)[],"niches": (string)[],"open_to_brands": boolean,"platforms": (string)[],"prior_collaborations": (string)[],"regions": (string)[],"turnaround": string | null,"updated_at": string,"usage_rights": string | null
                  }
                  Insert: {
                    "commercial_boundaries"?: string | null,"creator_id": string,"deliverables"?: (string)[],"exclusivity"?: string | null,"expertise"?: (string)[],"industries"?: (string)[],"niches"?: (string)[],"open_to_brands"?: boolean,"platforms"?: (string)[],"prior_collaborations"?: (string)[],"regions"?: (string)[],"turnaround"?: string | null,"updated_at"?: string,"usage_rights"?: string | null
                  }
                  Update: {
                    "commercial_boundaries"?: string | null,"creator_id"?: string,"deliverables"?: (string)[],"exclusivity"?: string | null,"expertise"?: (string)[],"industries"?: (string)[],"niches"?: (string)[],"open_to_brands"?: boolean,"platforms"?: (string)[],"prior_collaborations"?: (string)[],"regions"?: (string)[],"turnaround"?: string | null,"updated_at"?: string,"usage_rights"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "brand_profiles_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: true
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_deliverables": {
                  Row: {
                    "artifact_id": string | null,"campaign_id": string,"created_at": string,"creator_id": string,"description": string | null,"due_on": string | null,"format": string | null,"id": string,"proposed_by": string,"review_note": string | null,"status": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "artifact_id"?: string | null,"campaign_id": string,"created_at"?: string,"creator_id": string,"description"?: string | null,"due_on"?: string | null,"format"?: string | null,"id"?: string,"proposed_by": string,"review_note"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "artifact_id"?: string | null,"campaign_id"?: string,"created_at"?: string,"creator_id"?: string,"description"?: string | null,"due_on"?: string | null,"format"?: string | null,"id"?: string,"proposed_by"?: string,"review_note"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_deliverables_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_deliverables_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_deliverables_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_deliverables_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"campaign_invitations": {
                  Row: {
                    "campaign_id": string,"creator_id": string,"invited_at": string,"note": string | null,"responded_at": string | null,"response_note": string | null,"status": string
                  }
                  Insert: {
                    "campaign_id": string,"creator_id": string,"invited_at"?: string,"note"?: string | null,"responded_at"?: string | null,"response_note"?: string | null,"status"?: string
                  }
                  Update: {
                    "campaign_id"?: string,"creator_id"?: string,"invited_at"?: string,"note"?: string | null,"responded_at"?: string | null,"response_note"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaign_invitations_campaign_id_fkey"
      columns: ["campaign_id"]
isOneToOne: false
      referencedRelation: "campaigns"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaign_invitations_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"campaigns": {
                  Row: {
                    "brand_name": string,"brief": string,"channels": (string)[],"created_at": string,"due_on": string | null,"id": string,"owner_creator_id": string,"project_id": string | null,"status": string,"title": string,"updated_at": string,"usage_rights": string
                  }
                  Insert: {
                    "brand_name": string,"brief": string,"channels"?: (string)[],"created_at"?: string,"due_on"?: string | null,"id"?: string,"owner_creator_id": string,"project_id"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"usage_rights": string
                  }
                  Update: {
                    "brand_name"?: string,"brief"?: string,"channels"?: (string)[],"created_at"?: string,"due_on"?: string | null,"id"?: string,"owner_creator_id"?: string,"project_id"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"usage_rights"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "campaigns_owner_creator_id_fkey"
      columns: ["owner_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "campaigns_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"carousel_slides": {
                  Row: {
                    "artifact_id": string,"asset_id": string | null,"created_at": string,"creator_id": string,"display_text": string,"id": string,"image_transform": NonNullable<Json>,"order_index": number,"overlay": NonNullable<Json>,"pending_asset_id": string | null,"source_text": string,"updated_at": string
                  }
                  Insert: {
                    "artifact_id": string,"asset_id"?: string | null,"created_at"?: string,"creator_id": string,"display_text"?: string,"id"?: string,"image_transform"?: NonNullable<Json>,"order_index": number,"overlay"?: NonNullable<Json>,"pending_asset_id"?: string | null,"source_text"?: string,"updated_at"?: string
                  }
                  Update: {
                    "artifact_id"?: string,"asset_id"?: string | null,"created_at"?: string,"creator_id"?: string,"display_text"?: string,"id"?: string,"image_transform"?: NonNullable<Json>,"order_index"?: number,"overlay"?: NonNullable<Json>,"pending_asset_id"?: string | null,"source_text"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "carousel_slides_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "carousels"
      referencedColumns: ["artifact_id"]
    },{
      foreignKeyName: "carousel_slides_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "image_generation_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "carousel_slides_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "carousel_slides_pending_asset_id_fkey"
      columns: ["pending_asset_id"]
isOneToOne: false
      referencedRelation: "image_generation_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"carousels": {
                  Row: {
                    "artifact_id": string,"aspect_ratio": string,"created_at": string,"creator_id": string,"generation_id": string | null,"requested_count": number,"seeded_at": string | null,"source_version": number | null,"updated_at": string,"visual_style": string
                  }
                  Insert: {
                    "artifact_id": string,"aspect_ratio"?: string,"created_at"?: string,"creator_id": string,"generation_id"?: string | null,"requested_count": number,"seeded_at"?: string | null,"source_version"?: number | null,"updated_at"?: string,"visual_style"?: string
                  }
                  Update: {
                    "artifact_id"?: string,"aspect_ratio"?: string,"created_at"?: string,"creator_id"?: string,"generation_id"?: string | null,"requested_count"?: number,"seeded_at"?: string | null,"source_version"?: number | null,"updated_at"?: string,"visual_style"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "carousels_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: true
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "carousels_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "carousels_generation_id_fkey"
      columns: ["generation_id"]
isOneToOne: false
      referencedRelation: "image_generations"
      referencedColumns: ["id"]
    }
                  ]
                },"collaboration_profiles": {
                  Row: {
                    "commercial_boundaries": string | null,"contact_preference": string,"creator_id": string,"exclusivity": string,"interests": (string)[],"project_types": (string)[],"rate_guidance": string | null,"rate_visibility": string,"region": string | null,"rights_preferences": string | null,"turnaround": string | null,"updated_at": string,"work_mode": string
                  }
                  Insert: {
                    "commercial_boundaries"?: string | null,"contact_preference"?: string,"creator_id": string,"exclusivity"?: string,"interests"?: (string)[],"project_types"?: (string)[],"rate_guidance"?: string | null,"rate_visibility"?: string,"region"?: string | null,"rights_preferences"?: string | null,"turnaround"?: string | null,"updated_at"?: string,"work_mode"?: string
                  }
                  Update: {
                    "commercial_boundaries"?: string | null,"contact_preference"?: string,"creator_id"?: string,"exclusivity"?: string,"interests"?: (string)[],"project_types"?: (string)[],"rate_guidance"?: string | null,"rate_visibility"?: string,"region"?: string | null,"rights_preferences"?: string | null,"turnaround"?: string | null,"updated_at"?: string,"work_mode"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "collaboration_profiles_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: true
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"collaborator_shortlist": {
                  Row: {
                    "candidate_creator_id": string,"created_at": string,"creator_id": string,"id": string,"note": string | null,"project_id": string | null
                  }
                  Insert: {
                    "candidate_creator_id": string,"created_at"?: string,"creator_id": string,"id"?: string,"note"?: string | null,"project_id"?: string | null
                  }
                  Update: {
                    "candidate_creator_id"?: string,"created_at"?: string,"creator_id"?: string,"id"?: string,"note"?: string | null,"project_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "collaborator_shortlist_candidate_creator_id_fkey"
      columns: ["candidate_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collaborator_shortlist_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "collaborator_shortlist_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"contribution_edits": {
                  Row: {
                    "changes": NonNullable<Json>,"contribution_id": string,"created_at": string,"editor_creator_id": string | null,"id": string
                  }
                  Insert: {
                    "changes": NonNullable<Json>,"contribution_id": string,"created_at"?: string,"editor_creator_id"?: string | null,"id"?: string
                  }
                  Update: {
                    "changes"?: NonNullable<Json>,"contribution_id"?: string,"created_at"?: string,"editor_creator_id"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contribution_edits_contribution_id_fkey"
      columns: ["contribution_id"]
isOneToOne: false
      referencedRelation: "contributions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contribution_edits_editor_creator_id_fkey"
      columns: ["editor_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"contributions": {
                  Row: {
                    "artifact_id": string | null,"attribution": string,"compensation_note": string | null,"contributor_creator_id": string,"created_at": string,"credit_line": string | null,"description": string,"id": string,"kind": string,"material_id": string | null,"project_id": string | null,"recorded_by": string | null,"retracted_at": string | null,"retracted_reason": string | null,"rights_relationship": string,"share_percent": number | null,"source": string,"source_id": string | null,"version_id": string | null
                  }
                  Insert: {
                    "artifact_id"?: string | null,"attribution"?: string,"compensation_note"?: string | null,"contributor_creator_id": string,"created_at"?: string,"credit_line"?: string | null,"description"?: string,"id"?: string,"kind": string,"material_id"?: string | null,"project_id"?: string | null,"recorded_by"?: string | null,"retracted_at"?: string | null,"retracted_reason"?: string | null,"rights_relationship"?: string,"share_percent"?: number | null,"source": string,"source_id"?: string | null,"version_id"?: string | null
                  }
                  Update: {
                    "artifact_id"?: string | null,"attribution"?: string,"compensation_note"?: string | null,"contributor_creator_id"?: string,"created_at"?: string,"credit_line"?: string | null,"description"?: string,"id"?: string,"kind"?: string,"material_id"?: string | null,"project_id"?: string | null,"recorded_by"?: string | null,"retracted_at"?: string | null,"retracted_reason"?: string | null,"rights_relationship"?: string,"share_percent"?: number | null,"source"?: string,"source_id"?: string | null,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "contributions_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_contributor_creator_id_fkey"
      columns: ["contributor_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributions_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    }
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
                    "collection_id": string | null,"created_at": string,"creator_id": string,"id": string,"project_id": string | null,"status": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "collection_id"?: string | null,"created_at"?: string,"creator_id": string,"id"?: string,"project_id"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Update: {
                    "collection_id"?: string | null,"created_at"?: string,"creator_id"?: string,"id"?: string,"project_id"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "material_collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
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
                },"creator_ai_keys": {
                  Row: {
                    "created_at": string,"creator_id": string,"default_model": string | null,"hint": string,"last_error": string | null,"models": (string)[],"provider": string,"rotated_at": string | null,"status": string,"use_for_brain": boolean,"validated_at": string | null,"vault_secret_id": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"default_model"?: string | null,"hint": string,"last_error"?: string | null,"models"?: (string)[],"provider": string,"rotated_at"?: string | null,"status": string,"use_for_brain"?: boolean,"validated_at"?: string | null,"vault_secret_id": string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"default_model"?: string | null,"hint"?: string,"last_error"?: string | null,"models"?: (string)[],"provider"?: string,"rotated_at"?: string | null,"status"?: string,"use_for_brain"?: boolean,"validated_at"?: string | null,"vault_secret_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creator_ai_keys_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
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
                },"crew_activity": {
                  Row: {
                    "actor_creator_id": string | null,"created_at": string,"crew_id": string,"detail": NonNullable<Json>,"id": string,"kind": string,"subject_creator_id": string | null
                  }
                  Insert: {
                    "actor_creator_id"?: string | null,"created_at"?: string,"crew_id": string,"detail"?: NonNullable<Json>,"id"?: string,"kind": string,"subject_creator_id"?: string | null
                  }
                  Update: {
                    "actor_creator_id"?: string | null,"created_at"?: string,"crew_id"?: string,"detail"?: NonNullable<Json>,"id"?: string,"kind"?: string,"subject_creator_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_activity_actor_creator_id_fkey"
      columns: ["actor_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_activity_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_activity_subject_creator_id_fkey"
      columns: ["subject_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"crew_invite_messages": {
                  Row: {
                    "author_creator_id": string | null,"body": string,"created_at": string,"crew_id": string,"id": string,"invitee_creator_id": string
                  }
                  Insert: {
                    "author_creator_id"?: string | null,"body": string,"created_at"?: string,"crew_id": string,"id"?: string,"invitee_creator_id": string
                  }
                  Update: {
                    "author_creator_id"?: string | null,"body"?: string,"created_at"?: string,"crew_id"?: string,"id"?: string,"invitee_creator_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_invite_messages_author_creator_id_fkey"
      columns: ["author_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_invite_messages_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_invite_messages_invitee_creator_id_fkey"
      columns: ["invitee_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"crew_members": {
                  Row: {
                    "access": string,"compensation_note": string | null,"creator_id": string,"crew_id": string,"decline_note": string | null,"ended_at": string | null,"expires_at": string | null,"invite_note": string | null,"invited_at": string | null,"invited_by": string | null,"joined_at": string | null,"rights_note": string | null,"role_title": string | null,"scope": string | null,"status": string
                  }
                  Insert: {
                    "access"?: string,"compensation_note"?: string | null,"creator_id": string,"crew_id": string,"decline_note"?: string | null,"ended_at"?: string | null,"expires_at"?: string | null,"invite_note"?: string | null,"invited_at"?: string | null,"invited_by"?: string | null,"joined_at"?: string | null,"rights_note"?: string | null,"role_title"?: string | null,"scope"?: string | null,"status": string
                  }
                  Update: {
                    "access"?: string,"compensation_note"?: string | null,"creator_id"?: string,"crew_id"?: string,"decline_note"?: string | null,"ended_at"?: string | null,"expires_at"?: string | null,"invite_note"?: string | null,"invited_at"?: string | null,"invited_by"?: string | null,"joined_at"?: string | null,"rights_note"?: string | null,"role_title"?: string | null,"scope"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_members_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_members_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_members_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"crew_message_reads": {
                  Row: {
                    "creator_id": string,"crew_id": string,"last_read_at": string
                  }
                  Insert: {
                    "creator_id": string,"crew_id": string,"last_read_at"?: string
                  }
                  Update: {
                    "creator_id"?: string,"crew_id"?: string,"last_read_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_message_reads_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_message_reads_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    }
                  ]
                },"crew_messages": {
                  Row: {
                    "body": string,"context_id": string | null,"context_kind": string | null,"created_at": string,"creator_id": string | null,"crew_id": string,"drafted_by_ai": boolean,"huddle_id": string | null,"id": string,"item_id": string | null
                  }
                  Insert: {
                    "body": string,"context_id"?: string | null,"context_kind"?: string | null,"created_at"?: string,"creator_id"?: string | null,"crew_id": string,"drafted_by_ai"?: boolean,"huddle_id"?: string | null,"id"?: string,"item_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"context_id"?: string | null,"context_kind"?: string | null,"created_at"?: string,"creator_id"?: string | null,"crew_id"?: string,"drafted_by_ai"?: boolean,"huddle_id"?: string | null,"id"?: string,"item_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "crew_messages_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_messages_crew_id_fkey"
      columns: ["crew_id"]
isOneToOne: false
      referencedRelation: "crews"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_messages_huddle_id_fkey"
      columns: ["huddle_id"]
isOneToOne: false
      referencedRelation: "huddles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crew_messages_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "project_items"
      referencedColumns: ["id"]
    }
                  ]
                },"crews": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"name": string,"project_id": string,"purpose": string,"status": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"name": string,"project_id": string,"purpose"?: string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"name"?: string,"project_id"?: string,"purpose"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "crews_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "crews_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"direct_messages": {
                  Row: {
                    "artifact_id": string | null,"body": string,"created_at": string,"creator_id": string | null,"drafted_by_ai": boolean,"id": string,"project_id": string | null,"thread_id": string
                  }
                  Insert: {
                    "artifact_id"?: string | null,"body": string,"created_at"?: string,"creator_id"?: string | null,"drafted_by_ai"?: boolean,"id"?: string,"project_id"?: string | null,"thread_id": string
                  }
                  Update: {
                    "artifact_id"?: string | null,"body"?: string,"created_at"?: string,"creator_id"?: string | null,"drafted_by_ai"?: boolean,"id"?: string,"project_id"?: string | null,"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "direct_messages_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_messages_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_messages_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_messages_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "direct_threads"
      referencedColumns: ["id"]
    }
                  ]
                },"direct_thread_reads": {
                  Row: {
                    "creator_id": string,"last_read_at": string,"thread_id": string
                  }
                  Insert: {
                    "creator_id": string,"last_read_at"?: string,"thread_id": string
                  }
                  Update: {
                    "creator_id"?: string,"last_read_at"?: string,"thread_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "direct_thread_reads_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_thread_reads_thread_id_fkey"
      columns: ["thread_id"]
isOneToOne: false
      referencedRelation: "direct_threads"
      referencedColumns: ["id"]
    }
                  ]
                },"direct_threads": {
                  Row: {
                    "created_at": string,"creator_a": string,"creator_b": string,"id": string,"last_message_at": string | null
                  }
                  Insert: {
                    "created_at"?: string,"creator_a": string,"creator_b": string,"id"?: string,"last_message_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"creator_a"?: string,"creator_b"?: string,"id"?: string,"last_message_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "direct_threads_creator_a_fkey"
      columns: ["creator_a"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "direct_threads_creator_b_fkey"
      columns: ["creator_b"]
isOneToOne: false
      referencedRelation: "creators"
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
                },"huddle_history": {
                  Row: {
                    "creator_id": string,"ended_at": string | null,"huddle_id": string,"joined_at": string,"left_at": string | null,"met": NonNullable<Json>,"role": string,"started_at": string,"topic": string | null
                  }
                  Insert: {
                    "creator_id": string,"ended_at"?: string | null,"huddle_id": string,"joined_at": string,"left_at"?: string | null,"met"?: NonNullable<Json>,"role": string,"started_at": string,"topic"?: string | null
                  }
                  Update: {
                    "creator_id"?: string,"ended_at"?: string | null,"huddle_id"?: string,"joined_at"?: string,"left_at"?: string | null,"met"?: NonNullable<Json>,"role"?: string,"started_at"?: string,"topic"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "huddle_history_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"huddle_invitations": {
                  Row: {
                    "created_at": string,"huddle_id": string,"invited_by_creator_id": string,"invitee_creator_id": string,"responded_at": string | null,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"huddle_id": string,"invited_by_creator_id": string,"invitee_creator_id": string,"responded_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"huddle_id"?: string,"invited_by_creator_id"?: string,"invitee_creator_id"?: string,"responded_at"?: string | null,"status"?: string
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
                    "chat_saving_since": string | null,"description": string | null,"discoverability": string,"dissolved_at": string | null,"id": string,"media_room_id": string | null,"related_artifact_id": string | null,"related_material_id": string | null,"started_at": string,"started_by_creator_id": string | null,"status": string,"topic": string | null
                  }
                  Insert: {
                    "chat_saving_since"?: string | null,"description"?: string | null,"discoverability"?: string,"dissolved_at"?: string | null,"id"?: string,"media_room_id"?: string | null,"related_artifact_id"?: string | null,"related_material_id"?: string | null,"started_at"?: string,"started_by_creator_id"?: string | null,"status"?: string,"topic"?: string | null
                  }
                  Update: {
                    "chat_saving_since"?: string | null,"description"?: string | null,"discoverability"?: string,"dissolved_at"?: string | null,"id"?: string,"media_room_id"?: string | null,"related_artifact_id"?: string | null,"related_material_id"?: string | null,"started_at"?: string,"started_by_creator_id"?: string | null,"status"?: string,"topic"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "huddles_related_artifact_id_fkey"
      columns: ["related_artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddles_related_material_id_fkey"
      columns: ["related_material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "huddles_started_by_creator_id_fkey"
      columns: ["started_by_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"image_asset_revisions": {
                  Row: {
                    "asset_id": string | null,"completed_at": string | null,"created_at": string,"creator_id": string,"error_code": string | null,"generation_id": string,"id": string,"idempotency_key": string | null,"instruction": string | null,"kind": string,"result_asset_id": string | null,"slide_id": string | null,"slide_text": string | null,"status": string
                  }
                  Insert: {
                    "asset_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"creator_id": string,"error_code"?: string | null,"generation_id": string,"id"?: string,"idempotency_key"?: string | null,"instruction"?: string | null,"kind"?: string,"result_asset_id"?: string | null,"slide_id"?: string | null,"slide_text"?: string | null,"status"?: string
                  }
                  Update: {
                    "asset_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"creator_id"?: string,"error_code"?: string | null,"generation_id"?: string,"id"?: string,"idempotency_key"?: string | null,"instruction"?: string | null,"kind"?: string,"result_asset_id"?: string | null,"slide_id"?: string | null,"slide_text"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "image_asset_revisions_asset_id_fkey"
      columns: ["asset_id"]
isOneToOne: false
      referencedRelation: "image_generation_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_asset_revisions_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_asset_revisions_generation_id_fkey"
      columns: ["generation_id"]
isOneToOne: false
      referencedRelation: "image_generations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_asset_revisions_result_asset_id_fkey"
      columns: ["result_asset_id"]
isOneToOne: false
      referencedRelation: "image_generation_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_asset_revisions_slide_id_fkey"
      columns: ["slide_id"]
isOneToOne: false
      referencedRelation: "carousel_slides"
      referencedColumns: ["id"]
    }
                  ]
                },"image_generation_assets": {
                  Row: {
                    "created_at": string,"creator_id": string,"direction_label": string | null,"generation_id": string,"height": number | null,"id": string,"position": number | null,"rationale": string | null,"replaced_by": string | null,"revision_of": string | null,"saved_material_id": string | null,"selected": boolean,"sequence": number,"storage_object_id": string,"thumbnail_object_id": string | null,"width": number | null
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"direction_label"?: string | null,"generation_id": string,"height"?: number | null,"id"?: string,"position"?: number | null,"rationale"?: string | null,"replaced_by"?: string | null,"revision_of"?: string | null,"saved_material_id"?: string | null,"selected"?: boolean,"sequence": number,"storage_object_id": string,"thumbnail_object_id"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"direction_label"?: string | null,"generation_id"?: string,"height"?: number | null,"id"?: string,"position"?: number | null,"rationale"?: string | null,"replaced_by"?: string | null,"revision_of"?: string | null,"saved_material_id"?: string | null,"selected"?: boolean,"sequence"?: number,"storage_object_id"?: string,"thumbnail_object_id"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "image_generation_assets_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_generation_assets_generation_id_fkey"
      columns: ["generation_id"]
isOneToOne: false
      referencedRelation: "image_generations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_generation_assets_replaced_by_fkey"
      columns: ["replaced_by"]
isOneToOne: false
      referencedRelation: "image_generation_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_generation_assets_revision_of_fkey"
      columns: ["revision_of"]
isOneToOne: false
      referencedRelation: "image_generation_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_generation_assets_saved_material_id_fkey"
      columns: ["saved_material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_generation_assets_storage_object_id_fkey"
      columns: ["storage_object_id"]
isOneToOne: false
      referencedRelation: "storage_objects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_generation_assets_thumbnail_object_id_fkey"
      columns: ["thumbnail_object_id"]
isOneToOne: false
      referencedRelation: "storage_objects"
      referencedColumns: ["id"]
    }
                  ]
                },"image_generations": {
                  Row: {
                    "artifact_id": string | null,"aspect_ratio": string,"completed_at": string | null,"context": NonNullable<Json>,"context_hash": string,"created_at": string,"creator_id": string,"error_code": string | null,"id": string,"idempotency_key": string | null,"latency_ms": number | null,"material_id": string | null,"model": string,"prompt_version": string,"provider": string,"purpose": string,"quality_intent": string,"requested_count": number,"routing_version": string,"source_material_ids": (string)[],"source_version": number | null,"status": string,"variation": number
                  }
                  Insert: {
                    "artifact_id"?: string | null,"aspect_ratio": string,"completed_at"?: string | null,"context"?: NonNullable<Json>,"context_hash": string,"created_at"?: string,"creator_id": string,"error_code"?: string | null,"id"?: string,"idempotency_key"?: string | null,"latency_ms"?: number | null,"material_id"?: string | null,"model": string,"prompt_version": string,"provider": string,"purpose": string,"quality_intent": string,"requested_count": number,"routing_version": string,"source_material_ids"?: (string)[],"source_version"?: number | null,"status"?: string,"variation"?: number
                  }
                  Update: {
                    "artifact_id"?: string | null,"aspect_ratio"?: string,"completed_at"?: string | null,"context"?: NonNullable<Json>,"context_hash"?: string,"created_at"?: string,"creator_id"?: string,"error_code"?: string | null,"id"?: string,"idempotency_key"?: string | null,"latency_ms"?: number | null,"material_id"?: string | null,"model"?: string,"prompt_version"?: string,"provider"?: string,"purpose"?: string,"quality_intent"?: string,"requested_count"?: number,"routing_version"?: string,"source_material_ids"?: (string)[],"source_version"?: number | null,"status"?: string,"variation"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "image_generations_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_generations_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "image_generations_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
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
                },"license_requests": {
                  Row: {
                    "artifact_id": string,"counter_terms": Json | null,"created_at": string,"id": string,"license_id": string | null,"owner_creator_id": string,"proposed_use": string,"requester_creator_id": string,"responded_at": string | null,"response_note": string | null,"status": string,"terms": NonNullable<Json>,"updated_at": string
                  }
                  Insert: {
                    "artifact_id": string,"counter_terms"?: Json | null,"created_at"?: string,"id"?: string,"license_id"?: string | null,"owner_creator_id": string,"proposed_use": string,"requester_creator_id": string,"responded_at"?: string | null,"response_note"?: string | null,"status"?: string,"terms": NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "artifact_id"?: string,"counter_terms"?: Json | null,"created_at"?: string,"id"?: string,"license_id"?: string | null,"owner_creator_id"?: string,"proposed_use"?: string,"requester_creator_id"?: string,"responded_at"?: string | null,"response_note"?: string | null,"status"?: string,"terms"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "license_requests_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "license_requests_license_id_fkey"
      columns: ["license_id"]
isOneToOne: false
      referencedRelation: "licenses"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "license_requests_owner_creator_id_fkey"
      columns: ["owner_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "license_requests_requester_creator_id_fkey"
      columns: ["requester_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"licenses": {
                  Row: {
                    "attribution_required": boolean,"created_at": string,"creator_id": string,"derivatives_allowed": boolean,"edition_size": number | null,"ends_on": string | null,"exclusive": boolean,"fee_amount": number | null,"fee_currency": string | null,"id": string,"license_type": string,"licensee_creator_id": string | null,"licensee_name": string | null,"mode": string,"modification_allowed": boolean,"permitted_use": string | null,"resale_allowed": boolean,"rights_id": string,"starts_on": string | null,"status": string,"territory": string,"usage_channels": (string)[]
                  }
                  Insert: {
                    "attribution_required"?: boolean,"created_at"?: string,"creator_id": string,"derivatives_allowed"?: boolean,"edition_size"?: number | null,"ends_on"?: string | null,"exclusive"?: boolean,"fee_amount"?: number | null,"fee_currency"?: string | null,"id"?: string,"license_type": string,"licensee_creator_id"?: string | null,"licensee_name"?: string | null,"mode"?: string,"modification_allowed"?: boolean,"permitted_use"?: string | null,"resale_allowed"?: boolean,"rights_id": string,"starts_on"?: string | null,"status"?: string,"territory"?: string,"usage_channels"?: (string)[]
                  }
                  Update: {
                    "attribution_required"?: boolean,"created_at"?: string,"creator_id"?: string,"derivatives_allowed"?: boolean,"edition_size"?: number | null,"ends_on"?: string | null,"exclusive"?: boolean,"fee_amount"?: number | null,"fee_currency"?: string | null,"id"?: string,"license_type"?: string,"licensee_creator_id"?: string | null,"licensee_name"?: string | null,"mode"?: string,"modification_allowed"?: boolean,"permitted_use"?: string | null,"resale_allowed"?: boolean,"rights_id"?: string,"starts_on"?: string | null,"status"?: string,"territory"?: string,"usage_channels"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "licenses_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "licenses_licensee_creator_id_fkey"
      columns: ["licensee_creator_id"]
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
                    "added_at": string,"collection_id": string,"creator_id": string,"material_id": string,"position": number | null
                  }
                  Insert: {
                    "added_at"?: string,"collection_id": string,"creator_id": string,"material_id": string,"position"?: number | null
                  }
                  Update: {
                    "added_at"?: string,"collection_id"?: string,"creator_id"?: string,"material_id"?: string,"position"?: number | null
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
                    "cover_material_id": string | null,"created_at": string,"creator_id": string,"description": string | null,"id": string,"name": string,"privacy": Database["public"]['Enums']["privacy_class"],"status": string,"updated_at": string
                  }
                  Insert: {
                    "cover_material_id"?: string | null,"created_at"?: string,"creator_id": string,"description"?: string | null,"id"?: string,"name": string,"privacy"?: Database["public"]['Enums']["privacy_class"],"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "cover_material_id"?: string | null,"created_at"?: string,"creator_id"?: string,"description"?: string | null,"id"?: string,"name"?: string,"privacy"?: Database["public"]['Enums']["privacy_class"],"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "material_collections_cover_material_id_fkey"
      columns: ["cover_material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
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
                },"ownership_assertions": {
                  Row: {
                    "artifact_id": string,"claim": string,"created_at": string,"creator_id": string,"id": string,"project_id": string,"responded_at": string | null,"responded_by": string | null,"response_note": string | null,"share_percent": number | null,"statement": string,"status": string
                  }
                  Insert: {
                    "artifact_id": string,"claim": string,"created_at"?: string,"creator_id": string,"id"?: string,"project_id": string,"responded_at"?: string | null,"responded_by"?: string | null,"response_note"?: string | null,"share_percent"?: number | null,"statement": string,"status"?: string
                  }
                  Update: {
                    "artifact_id"?: string,"claim"?: string,"created_at"?: string,"creator_id"?: string,"id"?: string,"project_id"?: string,"responded_at"?: string | null,"responded_by"?: string | null,"response_note"?: string | null,"share_percent"?: number | null,"statement"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ownership_assertions_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ownership_assertions_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ownership_assertions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ownership_assertions_responded_by_fkey"
      columns: ["responded_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"project_completions": {
                  Row: {
                    "acknowledged_open": boolean,"completed_by": string | null,"created_at": string,"crew_dissolved": boolean,"id": string,"note": string | null,"open_items": NonNullable<Json>,"outcome": string,"project_id": string,"reopened_at": string | null,"reopened_by": string | null
                  }
                  Insert: {
                    "acknowledged_open"?: boolean,"completed_by"?: string | null,"created_at"?: string,"crew_dissolved"?: boolean,"id"?: string,"note"?: string | null,"open_items"?: NonNullable<Json>,"outcome": string,"project_id": string,"reopened_at"?: string | null,"reopened_by"?: string | null
                  }
                  Update: {
                    "acknowledged_open"?: boolean,"completed_by"?: string | null,"created_at"?: string,"crew_dissolved"?: boolean,"id"?: string,"note"?: string | null,"open_items"?: NonNullable<Json>,"outcome"?: string,"project_id"?: string,"reopened_at"?: string | null,"reopened_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_completions_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_completions_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_completions_reopened_by_fkey"
      columns: ["reopened_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"project_items": {
                  Row: {
                    "added_at": string,"artifact_id": string | null,"collection_id": string | null,"conversation_id": string | null,"creator_id": string,"huddle_id": string | null,"id": string,"kind": string,"label": string | null,"material_id": string | null,"note": string | null,"position": number | null,"project_id": string,"reference_id": string | null,"shared": boolean,"shared_at": string | null
                  }
                  Insert: {
                    "added_at"?: string,"artifact_id"?: string | null,"collection_id"?: string | null,"conversation_id"?: string | null,"creator_id": string,"huddle_id"?: string | null,"id"?: string,"kind": string,"label"?: string | null,"material_id"?: string | null,"note"?: string | null,"position"?: number | null,"project_id": string,"reference_id"?: string | null,"shared"?: boolean,"shared_at"?: string | null
                  }
                  Update: {
                    "added_at"?: string,"artifact_id"?: string | null,"collection_id"?: string | null,"conversation_id"?: string | null,"creator_id"?: string,"huddle_id"?: string | null,"id"?: string,"kind"?: string,"label"?: string | null,"material_id"?: string | null,"note"?: string | null,"position"?: number | null,"project_id"?: string,"reference_id"?: string | null,"shared"?: boolean,"shared_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_items_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_items_collection_id_fkey"
      columns: ["collection_id"]
isOneToOne: false
      referencedRelation: "material_collections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_items_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_items_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_items_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_items_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_items_reference_id_fkey"
      columns: ["reference_id"]
isOneToOne: false
      referencedRelation: "reference_items"
      referencedColumns: ["id"]
    }
                  ]
                },"project_milestones": {
                  Row: {
                    "created_at": string,"created_by": string | null,"description": string | null,"done_at": string | null,"due_on": string | null,"id": string,"project_id": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"done_at"?: string | null,"due_on"?: string | null,"id"?: string,"project_id": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"description"?: string | null,"done_at"?: string | null,"due_on"?: string | null,"id"?: string,"project_id"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_milestones_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_milestones_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_rights_events": {
                  Row: {
                    "actor_creator_id": string | null,"created_at": string,"details": NonNullable<Json>,"event": string,"id": string,"project_id": string
                  }
                  Insert: {
                    "actor_creator_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"event": string,"id"?: string,"project_id": string
                  }
                  Update: {
                    "actor_creator_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"event"?: string,"id"?: string,"project_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_rights_events_actor_creator_id_fkey"
      columns: ["actor_creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_rights_events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"project_rights_policies": {
                  Row: {
                    "agreement": string | null,"attribution": string,"derivatives": string,"project_id": string,"publication_signoff": boolean,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "agreement"?: string | null,"attribution"?: string,"derivatives"?: string,"project_id": string,"publication_signoff"?: boolean,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "agreement"?: string | null,"attribution"?: string,"derivatives"?: string,"project_id"?: string,"publication_signoff"?: boolean,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_rights_policies_project_id_fkey"
      columns: ["project_id"]
isOneToOne: true
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_rights_policies_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"project_task_assignees": {
                  Row: {
                    "assigned_at": string,"assigned_by": string | null,"creator_id": string,"task_id": string
                  }
                  Insert: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"creator_id": string,"task_id": string
                  }
                  Update: {
                    "assigned_at"?: string,"assigned_by"?: string | null,"creator_id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_task_assignees_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_task_assignees_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_task_assignees_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "project_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"project_task_comments": {
                  Row: {
                    "body": string,"created_at": string,"creator_id": string | null,"id": string,"task_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"creator_id"?: string | null,"id"?: string,"task_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"creator_id"?: string | null,"id"?: string,"task_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_task_comments_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_task_comments_task_id_fkey"
      columns: ["task_id"]
isOneToOne: false
      referencedRelation: "project_tasks"
      referencedColumns: ["id"]
    }
                  ]
                },"project_tasks": {
                  Row: {
                    "approved_by": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"depends_on": string | null,"description": string | null,"due_on": string | null,"id": string,"item_id": string | null,"milestone_id": string | null,"needs_approval": boolean,"project_id": string,"status": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "approved_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"depends_on"?: string | null,"description"?: string | null,"due_on"?: string | null,"id"?: string,"item_id"?: string | null,"milestone_id"?: string | null,"needs_approval"?: boolean,"project_id": string,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "approved_by"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"depends_on"?: string | null,"description"?: string | null,"due_on"?: string | null,"id"?: string,"item_id"?: string | null,"milestone_id"?: string | null,"needs_approval"?: boolean,"project_id"?: string,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_tasks_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_tasks_depends_on_fkey"
      columns: ["depends_on"]
isOneToOne: false
      referencedRelation: "project_tasks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_tasks_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "project_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_tasks_milestone_id_fkey"
      columns: ["milestone_id"]
isOneToOne: false
      referencedRelation: "project_milestones"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "project_tasks_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "brief": string,"budget_amount": number | null,"budget_currency": string | null,"budget_enabled": boolean,"budget_note": string | null,"cover_material_id": string | null,"created_at": string,"creator_id": string,"goals": (string)[],"id": string,"rights_note": string | null,"status": string,"status_changed_at": string,"title": string,"updated_at": string
                  }
                  Insert: {
                    "brief"?: string,"budget_amount"?: number | null,"budget_currency"?: string | null,"budget_enabled"?: boolean,"budget_note"?: string | null,"cover_material_id"?: string | null,"created_at"?: string,"creator_id": string,"goals"?: (string)[],"id"?: string,"rights_note"?: string | null,"status"?: string,"status_changed_at"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "brief"?: string,"budget_amount"?: number | null,"budget_currency"?: string | null,"budget_enabled"?: boolean,"budget_note"?: string | null,"cover_material_id"?: string | null,"created_at"?: string,"creator_id"?: string,"goals"?: (string)[],"id"?: string,"rights_note"?: string | null,"status"?: string,"status_changed_at"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "projects_cover_material_id_fkey"
      columns: ["cover_material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "projects_creator_id_fkey"
      columns: ["creator_id"]
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
                },"publication_attempts": {
                  Row: {
                    "attempt_no": number,"creator_id": string,"error": string | null,"external_id": string | null,"external_url": string | null,"finished_at": string | null,"http_status": number | null,"id": string,"outcome": string | null,"publication_id": string,"started_at": string
                  }
                  Insert: {
                    "attempt_no": number,"creator_id": string,"error"?: string | null,"external_id"?: string | null,"external_url"?: string | null,"finished_at"?: string | null,"http_status"?: number | null,"id"?: string,"outcome"?: string | null,"publication_id": string,"started_at"?: string
                  }
                  Update: {
                    "attempt_no"?: number,"creator_id"?: string,"error"?: string | null,"external_id"?: string | null,"external_url"?: string | null,"finished_at"?: string | null,"http_status"?: number | null,"id"?: string,"outcome"?: string | null,"publication_id"?: string,"started_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publication_attempts_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publication_attempts_publication_id_fkey"
      columns: ["publication_id"]
isOneToOne: false
      referencedRelation: "publications"
      referencedColumns: ["id"]
    }
                  ]
                },"publication_metrics": {
                  Row: {
                    "artifact_id": string,"creator_id": string,"destination_id": string | null,"id": string,"metric": string,"observed_at": string,"publication_id": string,"received_at": string,"reported_by": string,"value": number
                  }
                  Insert: {
                    "artifact_id": string,"creator_id": string,"destination_id"?: string | null,"id"?: string,"metric": string,"observed_at": string,"publication_id": string,"received_at"?: string,"reported_by": string,"value": number
                  }
                  Update: {
                    "artifact_id"?: string,"creator_id"?: string,"destination_id"?: string | null,"id"?: string,"metric"?: string,"observed_at"?: string,"publication_id"?: string,"received_at"?: string,"reported_by"?: string,"value"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "publication_metrics_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publication_metrics_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publication_metrics_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "publishing_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publication_metrics_publication_id_fkey"
      columns: ["publication_id"]
isOneToOne: false
      referencedRelation: "publications"
      referencedColumns: ["id"]
    }
                  ]
                },"publication_signoffs": {
                  Row: {
                    "artifact_id": string,"created_at": string,"creator_id": string,"decision": string,"note": string | null,"version_id": string
                  }
                  Insert: {
                    "artifact_id": string,"created_at"?: string,"creator_id": string,"decision": string,"note"?: string | null,"version_id": string
                  }
                  Update: {
                    "artifact_id"?: string,"created_at"?: string,"creator_id"?: string,"decision"?: string,"note"?: string | null,"version_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publication_signoffs_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publication_signoffs_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publication_signoffs_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"publications": {
                  Row: {
                    "approved_at": string | null,"artifact_id": string,"attempts": number,"caption": string | null,"created_at": string,"creator_id": string,"description": string | null,"destination_id": string | null,"destination_kind": string,"destination_name": string,"external_id": string | null,"external_url": string | null,"failure_reason": string | null,"id": string,"idempotency_key": string,"metadata": NonNullable<Json>,"prepared_by": string,"published_at": string | null,"scheduled_for": string | null,"status": string,"title": string,"updated_at": string,"version_id": string | null
                  }
                  Insert: {
                    "approved_at"?: string | null,"artifact_id": string,"attempts"?: number,"caption"?: string | null,"created_at"?: string,"creator_id": string,"description"?: string | null,"destination_id"?: string | null,"destination_kind": string,"destination_name": string,"external_id"?: string | null,"external_url"?: string | null,"failure_reason"?: string | null,"id"?: string,"idempotency_key"?: string,"metadata"?: NonNullable<Json>,"prepared_by"?: string,"published_at"?: string | null,"scheduled_for"?: string | null,"status"?: string,"title": string,"updated_at"?: string,"version_id"?: string | null
                  }
                  Update: {
                    "approved_at"?: string | null,"artifact_id"?: string,"attempts"?: number,"caption"?: string | null,"created_at"?: string,"creator_id"?: string,"description"?: string | null,"destination_id"?: string | null,"destination_kind"?: string,"destination_name"?: string,"external_id"?: string | null,"external_url"?: string | null,"failure_reason"?: string | null,"id"?: string,"idempotency_key"?: string,"metadata"?: NonNullable<Json>,"prepared_by"?: string,"published_at"?: string | null,"scheduled_for"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string,"version_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "publications_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publications_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publications_destination_id_fkey"
      columns: ["destination_id"]
isOneToOne: false
      referencedRelation: "publishing_destinations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "publications_version_id_fkey"
      columns: ["version_id"]
isOneToOne: false
      referencedRelation: "artifact_versions"
      referencedColumns: ["id"]
    }
                  ]
                },"publishing_destinations": {
                  Row: {
                    "created_at": string,"creator_id": string,"id": string,"kind": string,"last_used_at": string | null,"name": string,"signing_secret": string,"status": string,"url": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"id"?: string,"kind": string,"last_used_at"?: string | null,"name": string,"signing_secret": string,"status"?: string,"url": string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"id"?: string,"kind"?: string,"last_used_at"?: string | null,"name"?: string,"signing_secret"?: string,"status"?: string,"url"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publishing_destinations_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"publishing_preferences": {
                  Row: {
                    "caption_style": string | null,"creator_id": string,"default_destinations": NonNullable<Json>,"default_tags": (string)[],"preferred_time": string | null,"time_zone": string | null,"updated_at": string
                  }
                  Insert: {
                    "caption_style"?: string | null,"creator_id": string,"default_destinations"?: NonNullable<Json>,"default_tags"?: (string)[],"preferred_time"?: string | null,"time_zone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "caption_style"?: string | null,"creator_id"?: string,"default_destinations"?: NonNullable<Json>,"default_tags"?: (string)[],"preferred_time"?: string | null,"time_zone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "publishing_preferences_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: true
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"quality_reports": {
                  Row: {
                    "ai_run_id": string | null,"applied": NonNullable<Json>,"artifact_id": string,"checks": NonNullable<Json>,"created_at": string,"creator_id": string,"dismissed": NonNullable<Json>,"id": string,"suggestions": NonNullable<Json>,"version_id": string
                  }
                  Insert: {
                    "ai_run_id"?: string | null,"applied"?: NonNullable<Json>,"artifact_id": string,"checks"?: NonNullable<Json>,"created_at"?: string,"creator_id": string,"dismissed"?: NonNullable<Json>,"id"?: string,"suggestions"?: NonNullable<Json>,"version_id": string
                  }
                  Update: {
                    "ai_run_id"?: string | null,"applied"?: NonNullable<Json>,"artifact_id"?: string,"checks"?: NonNullable<Json>,"created_at"?: string,"creator_id"?: string,"dismissed"?: NonNullable<Json>,"id"?: string,"suggestions"?: NonNullable<Json>,"version_id"?: string
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
                    "artifact_id": string,"attribution_required": boolean,"commercial_channels": (string)[],"commercial_use": string,"copyright_holder": string,"copyright_registration": string | null,"created_at": string,"creator_id": string,"derivatives_allowed": boolean,"id": string,"notes": string | null,"ownership_kind": string,"updated_at": string
                  }
                  Insert: {
                    "artifact_id": string,"attribution_required"?: boolean,"commercial_channels"?: (string)[],"commercial_use"?: string,"copyright_holder": string,"copyright_registration"?: string | null,"created_at"?: string,"creator_id": string,"derivatives_allowed"?: boolean,"id"?: string,"notes"?: string | null,"ownership_kind"?: string,"updated_at"?: string
                  }
                  Update: {
                    "artifact_id"?: string,"attribution_required"?: boolean,"commercial_channels"?: (string)[],"commercial_use"?: string,"copyright_holder"?: string,"copyright_registration"?: string | null,"created_at"?: string,"creator_id"?: string,"derivatives_allowed"?: boolean,"id"?: string,"notes"?: string | null,"ownership_kind"?: string,"updated_at"?: string
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
                },"scrapbook_attachments": {
                  Row: {
                    "artifact_id": string | null,"creator_id": string,"id": string,"material_id": string | null,"position": number,"post_id": string
                  }
                  Insert: {
                    "artifact_id"?: string | null,"creator_id": string,"id"?: string,"material_id"?: string | null,"position"?: number,"post_id": string
                  }
                  Update: {
                    "artifact_id"?: string | null,"creator_id"?: string,"id"?: string,"material_id"?: string | null,"position"?: number,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scrapbook_attachments_artifact_id_fkey"
      columns: ["artifact_id"]
isOneToOne: false
      referencedRelation: "artifacts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scrapbook_attachments_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scrapbook_attachments_material_id_fkey"
      columns: ["material_id"]
isOneToOne: false
      referencedRelation: "creative_materials"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scrapbook_attachments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "scrapbook_posts"
      referencedColumns: ["id"]
    }
                  ]
                },"scrapbook_posts": {
                  Row: {
                    "body": string,"created_at": string,"creator_id": string,"id": string,"kind": string,"reply_policy": string,"updated_at": string,"visibility": string
                  }
                  Insert: {
                    "body"?: string,"created_at"?: string,"creator_id": string,"id"?: string,"kind"?: string,"reply_policy"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"creator_id"?: string,"id"?: string,"kind"?: string,"reply_policy"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scrapbook_posts_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"scrapbook_replies": {
                  Row: {
                    "body": string,"created_at": string,"creator_id": string,"id": string,"post_id": string
                  }
                  Insert: {
                    "body": string,"created_at"?: string,"creator_id": string,"id"?: string,"post_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"creator_id"?: string,"id"?: string,"post_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "scrapbook_replies_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "scrapbook_replies_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "scrapbook_posts"
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
                },"soundtrack_favourites": {
                  Row: {
                    "created_at": string,"creator_id": string,"track_id": string
                  }
                  Insert: {
                    "created_at"?: string,"creator_id": string,"track_id": string
                  }
                  Update: {
                    "created_at"?: string,"creator_id"?: string,"track_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "soundtrack_favourites_creator_id_fkey"
      columns: ["creator_id"]
isOneToOne: false
      referencedRelation: "creators"
      referencedColumns: ["id"]
    }
                  ]
                },"soundtrack_files": {
                  Row: {
                    "mirrored_at": string,"sha256": string,"size_bytes": number,"storage_path": string,"track_id": string
                  }
                  Insert: {
                    "mirrored_at"?: string,"sha256": string,"size_bytes": number,"storage_path": string,"track_id": string
                  }
                  Update: {
                    "mirrored_at"?: string,"sha256"?: string,"size_bytes"?: number,"storage_path"?: string,"track_id"?: string
                  }
                  Relationships: [
                    
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
            "accept_artifact_proposal":
{ Args: { "p_confirm_stale"?: boolean,"p_proposal": string }; Returns: {
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
"act_on_license_request":
{ Args: { "p_action": string,"p_request": string }; Returns: {
              "artifact_id": string,
"counter_terms": Json | null,
"created_at": string,
"id": string,
"license_id": string | null,
"owner_creator_id": string,
"proposed_use": string,
"requester_creator_id": string,
"responded_at": string | null,
"response_note": string | null,
"status": string,
"terms": NonNullable<Json>,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "license_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"approve_publication":
{ Args: { "p_publication": string }; Returns: {
              "approved_at": string | null,
"artifact_id": string,
"attempts": number,
"caption": string | null,
"created_at": string,
"creator_id": string,
"description": string | null,
"destination_id": string | null,
"destination_kind": string,
"destination_name": string,
"external_id": string | null,
"external_url": string | null,
"failure_reason": string | null,
"id": string,
"idempotency_key": string,
"metadata": NonNullable<Json>,
"prepared_by": string,
"published_at": string | null,
"scheduled_for": string | null,
"status": string,
"title": string,
"updated_at": string,
"version_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "publications"
        isOneToOne: true
        isSetofReturn: false
      } },
"artifact_access_of":
{ Args: { "p_artifact": string }; Returns: string
                           },
"assert_ownership":
{ Args: { "p_artifact": string,"p_claim": string,"p_project": string,"p_share"?: number,"p_statement": string }; Returns: string
                           },
"brand_summary_of":
{ Args: { "p_creator": string }; Returns: Json
                           },
"byok_remove":
{ Args: { "p_creator": string,"p_provider": string }; Returns: undefined
                           },
"byok_secret":
{ Args: { "p_creator": string,"p_provider": string }; Returns: string
                           },
"byok_store":
{ Args: { "p_creator": string,"p_hint": string,"p_models": (string)[],"p_provider": string,"p_secret": string,"p_status": string }; Returns: {
              "created_at": string,
"creator_id": string,
"default_model": string | null,
"hint": string,
"last_error": string | null,
"models": (string)[],
"provider": string,
"rotated_at": string | null,
"status": string,
"use_for_brain": boolean,
"validated_at": string | null,
"vault_secret_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "creator_ai_keys"
        isOneToOne: true
        isSetofReturn: false
      } },
"byok_update":
{ Args: { "p_clear_default"?: boolean,"p_creator": string,"p_default_model"?: string,"p_error"?: string,"p_models"?: (string)[],"p_provider": string,"p_status"?: string,"p_use_for_brain"?: boolean }; Returns: {
              "created_at": string,
"creator_id": string,
"default_model": string | null,
"hint": string,
"last_error": string | null,
"models": (string)[],
"provider": string,
"rotated_at": string | null,
"status": string,
"use_for_brain": boolean,
"validated_at": string | null,
"vault_secret_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "creator_ai_keys"
        isOneToOne: true
        isSetofReturn: false
      } },
"campaign_agree_deliverable":
{ Args: { "p_deliverable": string }; Returns: undefined
                           },
"campaign_invite":
{ Args: { "p_campaign": string,"p_creator": string,"p_note"?: string }; Returns: undefined
                           },
"campaign_propose_deliverable":
{ Args: { "p_campaign": string,"p_creator": string,"p_description"?: string,"p_due_on"?: string,"p_format"?: string,"p_title": string }; Returns: string
                           },
"campaign_respond":
{ Args: { "p_accept": boolean,"p_campaign": string,"p_note"?: string }; Returns: undefined
                           },
"campaign_review_deliverable":
{ Args: { "p_approve": boolean,"p_deliverable": string,"p_note"?: string }; Returns: undefined
                           },
"campaign_submission":
{ Args: { "p_deliverable": string }; Returns: Json
                           },
"campaign_submit_deliverable":
{ Args: { "p_artifact": string,"p_deliverable": string }; Returns: undefined
                           },
"campaign_withdraw_invite":
{ Args: { "p_campaign": string,"p_creator": string }; Returns: undefined
                           },
"can_message_creator":
{ Args: { "p_other": string }; Returns: boolean
                           },
"cancel_publication":
{ Args: { "p_publication": string }; Returns: {
              "approved_at": string | null,
"artifact_id": string,
"attempts": number,
"caption": string | null,
"created_at": string,
"creator_id": string,
"description": string | null,
"destination_id": string | null,
"destination_kind": string,
"destination_name": string,
"external_id": string | null,
"external_url": string | null,
"failure_reason": string | null,
"id": string,
"idempotency_key": string,
"metadata": NonNullable<Json>,
"prepared_by": string,
"published_at": string | null,
"scheduled_for": string | null,
"status": string,
"title": string,
"updated_at": string,
"version_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "publications"
        isOneToOne: true
        isSetofReturn: false
      } },
"carousel_seed":
{ Args: { "p_artifact": string,"p_rows": Json }; Returns: number
                           },
"collaboration_profile_of":
{ Args: { "p_creator": string }; Returns: Json
                           },
"collaborator_save_version":
{ Args: { "p_artifact": string,"p_base_version": string,"p_content": string,"p_summary"?: string }; Returns: {
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
"commercial_stance":
{ Args: { "p_artifact": string }; Returns: {
              "commercial_channels": (string)[],"commercial_use": string
            }[]
                           },
"complete_project":
{ Args: { "p_acknowledge_open"?: boolean,"p_confirm_title": string,"p_dissolve_crew": boolean,"p_note"?: string,"p_outcome": string,"p_project": string }; Returns: string
                           },
"contribution_retract":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           },
"contribution_update":
{ Args: { "p_attribution"?: string,"p_clear_share"?: boolean,"p_compensation"?: string,"p_credit_line"?: string,"p_description"?: string,"p_id": string,"p_rights"?: string,"p_share"?: number }; Returns: undefined
                           },
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
"creator_reachable":
{ Args: { "p_creator": string }; Returns: boolean
                           },
"crew_invite":
{ Args: { "p_access"?: string,"p_compensation"?: string,"p_creator": string,"p_crew": string,"p_expires_in_days"?: number,"p_note"?: string,"p_rights"?: string,"p_role_title"?: string,"p_scope"?: string }; Returns: undefined
                           },
"crew_invite_answer":
{ Args: { "p_body": string,"p_crew": string,"p_invitee": string }; Returns: undefined
                           },
"crew_invite_ask":
{ Args: { "p_body": string,"p_crew": string }; Returns: undefined
                           },
"crew_leave":
{ Args: { "p_crew": string }; Returns: undefined
                           },
"crew_my_invitation":
{ Args: { "p_crew": string }; Returns: Json
                           },
"crew_overview":
{ Args: { "p_crew": string }; Returns: Json
                           },
"crew_remove":
{ Args: { "p_creator": string,"p_crew": string }; Returns: undefined
                           },
"crew_respond":
{ Args: { "p_accept": boolean,"p_crew": string,"p_note"?: string }; Returns: undefined
                           },
"crew_set_role":
{ Args: { "p_access"?: string,"p_clear_title"?: boolean,"p_creator": string,"p_crew": string,"p_role_title"?: string }; Returns: undefined
                           },
"decline_artifact_proposal":
{ Args: { "p_note"?: string,"p_proposal": string }; Returns: undefined
                           },
"derivative_permission":
{ Args: { "p_artifact": string }; Returns: string
                           },
"find_collaborators":
{ Args: { "p_availability"?: (string)[],"p_interest"?: string,"p_limit"?: number,"p_location"?: string,"p_network_only"?: boolean,"p_project"?: string,"p_terms"?: (string)[] }; Returns: {
              "availability": string,"bio": string,"creator_id": string,"disciplines": (string)[],"display_name": string,"follows_me": boolean,"handle": string,"i_follow": boolean,"in_project": string,"interest_match": boolean,"interests": (string)[],"languages": (string)[],"location": string,"location_match": boolean,"matched_terms": (string)[],"met_in_huddles": number,"published_pieces": number,"shared_crews": number,"skills": (string)[],"worked_together": number
            }[]
                           },
"handle_available":
{ Args: { "p_handle": string }; Returns: boolean
                           },
"huddle_cancel_request":
{ Args: { "p_request": string }; Returns: undefined
                           },
"huddle_cleanup_stale":
{ Args: { "p_timeout_seconds"?: number }; Returns: number
                           },
"huddle_configure":
{ Args: { "p_allow_saving_chat"?: boolean,"p_clear_related"?: boolean,"p_description"?: string,"p_huddle": string,"p_related_artifact"?: string,"p_related_material"?: string }; Returns: {
              "chat_saving_since": string | null,
"description": string | null,
"discoverability": string,
"dissolved_at": string | null,
"id": string,
"media_room_id": string | null,
"related_artifact_id": string | null,
"related_material_id": string | null,
"started_at": string,
"started_by_creator_id": string | null,
"status": string,
"topic": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "huddles"
        isOneToOne: true
        isSetofReturn: false
      } },
"huddle_decline_invite":
{ Args: { "p_huddle": string }; Returns: undefined
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
"huddle_moment":
{ Args: { "p_huddle": string,"p_message": string }; Returns: Json
                           },
"huddle_related":
{ Args: { "p_huddle": string }; Returns: Json
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
"open_creator_share":
{ Args: { "p_share": string }; Returns: Json
                           },
"open_direct_thread":
{ Args: { "p_other": string }; Returns: string
                           },
"open_share_link":
{ Args: { "p_token": string }; Returns: Json
                           },
"project_open_items_of":
{ Args: { "p_project": string }; Returns: Json
                           },
"project_rights_summary":
{ Args: { "p_project": string }; Returns: {
              "active_licenses": number,"artifact_id": string,"attribution_required": boolean,"co_owners": Json,"collaborators": Json,"copyright_holder": string,"derivatives_allowed": boolean,"exclusive_licenses": number,"owner_id": string,"owner_name": string,"ownership_kind": string,"signoffs": Json,"title": string
            }[]
                           },
"project_role_of":
{ Args: { "p_project": string }; Returns: string
                           },
"project_shared_item":
{ Args: { "p_item": string }; Returns: Json
                           },
"project_shared_items":
{ Args: { "p_project": string }; Returns: {
              "detail": string,"item_id": string,"kind": string,"mine": boolean,"shared_at": string,"shared_by": string,"shared_by_name": string,"title": string
            }[]
                           },
"publication_signoff_status":
{ Args: { "p_artifact": string }; Returns: {
              "creator_id": string,"decided_at": string,"decision": string,"name": string,"note": string
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
"reopen_project":
{ Args: { "p_project": string }; Returns: undefined
                           },
"respond_license_request":
{ Args: { "p_counter"?: Json,"p_decision": string,"p_note"?: string,"p_request": string }; Returns: {
              "artifact_id": string,
"counter_terms": Json | null,
"created_at": string,
"id": string,
"license_id": string | null,
"owner_creator_id": string,
"proposed_use": string,
"requester_creator_id": string,
"responded_at": string | null,
"response_note": string | null,
"status": string,
"terms": NonNullable<Json>,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "license_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"respond_ownership_assertion":
{ Args: { "p_assertion": string,"p_note"?: string,"p_response": string }; Returns: undefined
                           },
"revoke_artifact_share":
{ Args: { "p_share": string }; Returns: {
              "allow_download": boolean,
"allow_embed": boolean,
"artifact_id": string,
"created_at": string,
"creator_id": string,
"expires_at": string | null,
"id": string,
"kind": string,
"label": string | null,
"last_accessed_at": string | null,
"recipient_creator_id": string | null,
"revoked_at": string | null,
"token_hash": string | null,
"version_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "artifact_shares"
        isOneToOne: true
        isSetofReturn: false
      } },
"scrapbook_attachment_details":
{ Args: { "p_posts": (string)[] }; Returns: {
              "attachment_id": string,"can_open": boolean,"excerpt": string,"file_path": string,"item_id": string,"item_type": string,"kind": string,"mime_type": string,"post_id": string,"title": string
            }[]
                           },
"scrapbook_can_reply":
{ Args: { "p_post": string }; Returns: boolean
                           },
"semantic_search":
{ Args: { "p_limit"?: number,"p_min_similarity"?: number,"p_query": string }; Returns: {
              "similarity": number,"subject_id": string,"subject_type": string
            }[]
                           },
"shared_with_me":
{ Args: Record<PropertyKey, never>; Returns: {
              "artifact_type": string,"creator_name": string,"expires_at": string,"share_id": string,"shared_at": string,"title": string
            }[]
                           },
"sign_off_publication":
{ Args: { "p_artifact": string,"p_decision": string,"p_note"?: string }; Returns: undefined
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
                           },
"unread_messages":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"kind": string,"latest_at": string,"latest_author": string,"project_id": string,"title": string,"unread": number
            }[]
                           },
"withdraw_artifact_proposal":
{ Args: { "p_proposal": string }; Returns: undefined
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

