-- Columns are added by init_db after migrations. SQLite does not support
-- ALTER TABLE ADD COLUMN IF NOT EXISTS, so keeping that repair in Rust makes
-- startup safe for databases created by development builds.
SELECT 1;
