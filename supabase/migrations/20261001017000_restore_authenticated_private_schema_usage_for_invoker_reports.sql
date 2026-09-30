-- Invoker report RPCs call private authorization helpers.
-- Schema USAGE does not expose private functions; EXECUTE remains individually governed.
grant usage on schema private to authenticated;
