-- New public objects must not become Data API endpoints by default.
-- Existing object grants are managed explicitly by MIZAN migrations.
alter default privileges for role postgres in schema public revoke select, insert, update, delete, truncate, references, trigger on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke usage, select, update on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;
