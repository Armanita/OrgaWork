DO $orgawork_roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'orgawork_migration'
  ) THEN
    CREATE ROLE orgawork_migration
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'orgawork_runtime'
  ) THEN
    CREATE ROLE orgawork_runtime
      NOLOGIN
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOINHERIT
      NOREPLICATION;
  END IF;
END
$orgawork_roles$;

ALTER ROLE orgawork_migration
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION;

ALTER ROLE orgawork_runtime
  NOLOGIN
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION;

DO $orgawork_database_grants$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO orgawork_migration',
    current_database()
  );
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO orgawork_runtime',
    current_database()
  );
END
$orgawork_database_grants$;

GRANT USAGE, CREATE ON SCHEMA public TO orgawork_migration;
GRANT SELECT, INSERT
  ON TABLE public.orgawork_migration_history
  TO orgawork_migration;

REVOKE ALL ON SCHEMA public FROM orgawork_runtime;
GRANT USAGE ON SCHEMA public TO orgawork_runtime;
REVOKE CREATE ON SCHEMA public FROM orgawork_runtime;
REVOKE ALL
  ON TABLE public.orgawork_migration_history
  FROM orgawork_runtime;
