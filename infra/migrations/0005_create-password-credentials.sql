CREATE TABLE public.orgawork_password_credentials (
  user_id uuid PRIMARY KEY,
  password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT orgawork_password_credentials_user_fk
    FOREIGN KEY (user_id)
    REFERENCES public.orgawork_users (id)
    ON DELETE CASCADE,
  CONSTRAINT orgawork_password_credentials_hash_check
    CHECK (
      password_hash LIKE '$argon2id$%'
      AND char_length(password_hash) BETWEEN 80 AND 512
    ),
  CONSTRAINT orgawork_password_credentials_version_check
    CHECK (version > 0),
  CONSTRAINT orgawork_password_credentials_time_check
    CHECK (
      password_changed_at >= created_at
      AND updated_at >= created_at
      AND updated_at >= password_changed_at
    )
);

CREATE INDEX orgawork_password_credentials_changed_index
  ON public.orgawork_password_credentials (password_changed_at);

CREATE OR REPLACE FUNCTION public.orgawork_validate_password_credential_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $orgawork_validate_password_credential_update$
BEGIN
  IF NEW.user_id <> OLD.user_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'Password credential ownership fields are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Password credential version is invalid'
      USING ERRCODE = '23514';
  END IF;

  IF (
    NEW.password_changed_at < OLD.password_changed_at
    OR NEW.updated_at < OLD.updated_at
    OR NEW.updated_at < NEW.password_changed_at
  ) THEN
    RAISE EXCEPTION 'Password credential timestamp is invalid'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.password_hash = OLD.password_hash THEN
    RAISE EXCEPTION 'Password credential hash must rotate on update'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$orgawork_validate_password_credential_update$;

CREATE TRIGGER orgawork_password_credentials_validate_update
BEFORE UPDATE ON public.orgawork_password_credentials
FOR EACH ROW
EXECUTE FUNCTION public.orgawork_validate_password_credential_update();

REVOKE ALL ON TABLE public.orgawork_password_credentials FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.orgawork_password_credentials
  TO orgawork_runtime;

REVOKE ALL ON FUNCTION public.orgawork_validate_password_credential_update() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orgawork_validate_password_credential_update()
  TO orgawork_runtime;
