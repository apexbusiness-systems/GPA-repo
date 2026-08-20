# Migration Rollback Scripts

Paired `down` scripts for `supabase/migrations/`. Run in reverse order via `psql`. Each is destructive to its own objects only.

| Up | Down |
|---|---|
| 009_entitlements.sql | `drop policy if exists entitlements_select on public.entitlements; drop policy if exists subscriptions_select on public.subscriptions; drop table if exists public.entitlements, public.subscriptions; drop type if exists entitlement_status, subscription_tier;` |
| 008_session_lifecycle.sql | `alter table public.coaching_responses drop column if exists latency_ms, drop column if exists request_id; drop index if exists advice_events_created_idx, advice_events_request_idx; alter table public.advice_events drop column if exists client_version, drop column if exists request_id; alter table public.sessions drop constraint if exists sessions_status_check, drop column if exists client_version, drop column if exists ended_at, drop column if exists status;` |
| 007_broadcast.sql | `drop trigger if exists coaching_responses_broadcast on public.coaching_responses; drop function if exists public.broadcast_coaching_response(); drop policy if exists session_channel_recv on realtime.messages; drop table if exists public.coaching_responses;` |
| 006_retrieval.sql | `drop function if exists public.retrieval_candidates(uuid, text[], vector, int);` |
| 005_rls.sql | `-- policies only:` drop each `*_select/_insert/_update` policy named in the file; RLS flags may stay on. |
| 004_users.sql | `drop table if exists public.advice_events, public.sessions, public.profiles; drop type if exists coaching_mode, playstyle;` |
| 003_embeddings.sql | `drop table if exists public.embeddings;` (extension `vector` retained) |
| 002_knowledge.sql | `drop table if exists public.media_evidence, public.claims, public.entities, public.source_records, public.knowledge_sources; drop type if exists claim_status, source_license, source_type;` |
| 001_titles.sql | `drop table if exists public.titles; drop type if exists compliance_status, anti_cheat_class;` |

Edge Function rollback: `supabase functions deploy <name> --version <previous>` (deploys are versioned; see release runbook).
