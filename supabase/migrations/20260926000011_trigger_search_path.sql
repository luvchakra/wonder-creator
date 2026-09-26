-- Pin search_path on trigger functions (Supabase advisor 0011). They only use pg_catalog builtins.
alter function app.touch_updated_at() set search_path = '';
alter function app.prevent_mutation() set search_path = '';
alter function app.protect_creator_bindings() set search_path = '';
alter function app.guard_autonomy_level() set search_path = '';
alter function app.guard_material_pipeline_state() set search_path = '';
alter function app.guard_version_immutable() set search_path = '';
