import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

const globalForPostgres = globalThis as typeof globalThis & {
  __scmPostgresClient?: SqlClient;
  __scmPostgresSchemaPromise?: Promise<void>;
  __scmPostgresSchemaFailed?: boolean;
  __scmPostgresUnavailable?: boolean;
};

const defaultProductionConnectTimeoutSeconds = 3;
const defaultNonProductionConnectTimeoutSeconds = 30;

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    ""
  );
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

function parsePositiveNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getConnectTimeoutSeconds() {
  const configuredTimeout =
    parsePositiveNumber(process.env.SCM_POSTGRES_CONNECT_TIMEOUT?.trim()) ??
    parsePositiveNumber(process.env.PGCONNECT_TIMEOUT?.trim());

  if (configuredTimeout !== null) {
    return configuredTimeout;
  }

  return process.env.NODE_ENV === "production"
    ? defaultProductionConnectTimeoutSeconds
    : defaultNonProductionConnectTimeoutSeconds;
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    return String(error.code).trim().toUpperCase();
  }

  return "";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.trim().toLowerCase();
  }

  return String(error ?? "").trim().toLowerCase();
}

function shouldMarkPostgresUnavailable(error: unknown) {
  const errorCode = getErrorCode(error);

  if (
    errorCode === "ECONNREFUSED" ||
    errorCode === "ENOTFOUND" ||
    errorCode === "ETIMEDOUT" ||
    errorCode === "ETIMEOUT" ||
    errorCode === "EHOSTUNREACH" ||
    errorCode === "ECONNRESET"
  ) {
    return true;
  }

  const message = getErrorMessage(error);

  return (
    message.includes("connect_timeout") ||
    message.includes("connection refused") ||
    message.includes("connection terminated") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("could not connect") ||
    message.includes("can't reach database") ||
    message.includes("getaddrinfo")
  );
}

async function markPostgresUnavailable() {
  globalForPostgres.__scmPostgresUnavailable = true;
  globalForPostgres.__scmPostgresSchemaPromise = undefined;

  const client = globalForPostgres.__scmPostgresClient;
  globalForPostgres.__scmPostgresClient = undefined;

  if (!client) {
    return;
  }

  try {
    await client.end({ timeout: 0 });
  } catch {
    // Swallow shutdown errors so callers can fall back to file-backed storage immediately.
  }
}

export function getPostgresClient() {
  if (!isDatabaseConfigured() || globalForPostgres.__scmPostgresUnavailable) {
    return null;
  }

  if (!globalForPostgres.__scmPostgresClient) {
    globalForPostgres.__scmPostgresClient = postgres(getDatabaseUrl(), {
      max: 1,
      prepare: false,
      // Fail fast in production so the app can use its bundled JSON fallback
      // instead of appearing frozen while an unreachable database times out.
      connect_timeout: getConnectTimeoutSeconds(),
    });
  }

  return globalForPostgres.__scmPostgresClient;
}

export async function ensureProductionStorageSchema() {
  const sql = getPostgresClient();

  if (!sql || globalForPostgres.__scmPostgresSchemaFailed) {
    return;
  }

  if (!globalForPostgres.__scmPostgresSchemaPromise) {
    globalForPostgres.__scmPostgresSchemaPromise = sql
      .unsafe(`
      create table if not exists staff_profiles (
        id text primary key,
        display_name text not null,
        email text not null,
        email_lower text not null unique,
        phone text not null,
        country text not null,
        region text not null,
        regions_json text not null,
        roles_json text not null,
        priority integer not null,
        availability text not null,
        approval_status text not null,
        access_role_label text not null,
        registration_status text not null,
        registration_label text not null,
        profile_approved boolean not null,
        profile_approval_label text not null,
        profile_image_name text not null,
        profile_image_url text,
        bank_name text not null,
        bank_details text not null,
        personal_number text not null,
        driver_license_manual boolean not null,
        driver_license_automatic boolean not null,
        allergies text not null,
        role_profiles_json text not null,
        profile_comments text not null,
        documents_json text not null,
        pending_records_json text not null,
        is_deleted boolean not null default false,
        created_at text not null,
        updated_at text not null
      );

      alter table staff_profiles
        add column if not exists is_deleted boolean not null default false;

      create table if not exists staff_app_accounts (
        id text primary key,
        linked_staff_profile_id text,
        created_from_application_id text,
        display_name text not null,
        email text not null,
        email_lower text not null unique,
        phone text not null,
        country text not null,
        region text not null,
        role_scopes_json text not null,
        profile_image_url text,
        password_hash text not null,
        is_active boolean not null,
        must_complete_onboarding boolean not null,
        password_set_at text,
        activated_at text,
        last_login_at text,
        created_at text not null,
        updated_at text not null
      );

      create table if not exists scm_staff_profiles (
        id text primary key,
        display_name text not null,
        email text not null,
        email_lower text not null,
        password_hash text not null,
        password_plaintext text,
        phone text not null,
        role_key text not null,
        country text not null,
        regions_json text not null,
        assigned_gig_ids_json text not null,
        linked_staff_id text,
        linked_staff_name text,
        profile_image_name text not null,
        profile_image_url text,
        notes text not null,
        is_deleted boolean not null default false,
        created_at text not null,
        updated_at text not null
      );

      create index if not exists idx_scm_staff_profiles_email_lower
        on scm_staff_profiles (email_lower);

      create table if not exists staff_applications (
        id text primary key,
        status text not null,
        profile_image_name text not null,
        profile_image_url text not null,
        display_name text not null,
        email text not null,
        email_lower text not null,
        phone text not null,
        country text not null,
        region text not null,
        submitted_at text not null,
        reviewed_at text,
        reviewed_by_profile_id text,
        reviewed_by_name text,
        rejection_reason text,
        converted_staff_profile_id text,
        approval_email_status text not null,
        approval_email_last_attempt_at text,
        approval_email_error text,
        password_setup_token_id text
      );

      create index if not exists idx_staff_applications_email_lower
        on staff_applications (email_lower);

      create table if not exists password_setup_tokens (
        id text primary key,
        email text not null,
        email_lower text not null,
        staff_profile_id text not null,
        staff_app_account_id text not null,
        application_id text,
        token_hash text not null unique,
        created_at text not null,
        expires_at text not null,
        consumed_at text,
        invalidated_at text
      );

      alter table password_setup_tokens
        add column if not exists subject_type text not null default 'staffApp';

      alter table password_setup_tokens
        add column if not exists scm_staff_profile_id text;

      create index if not exists idx_password_setup_tokens_account_id
        on password_setup_tokens (staff_app_account_id);

      create table if not exists staff_onboarding (
        id text primary key,
        staff_profile_id text not null,
        staff_app_account_id text not null unique,
        personal_number text not null,
        bank_name text not null,
        bank_account text not null,
        allergies text not null,
        driver_license_manual boolean not null,
        driver_license_automatic boolean not null,
        saved_at text not null,
        updated_at text not null,
        welcome_acknowledged_at text
      );

      create table if not exists archived_staff_documents (
        archived_id text primary key,
        source_profile_id text not null,
        archived_at text not null,
        record_json text not null
      );

      create table if not exists staff_documents (
        id text primary key,
        user_id text not null,
        gig_id text not null,
        shift_id text not null,
        gig_date text not null,
        generated_at text not null,
        document_kind text not null,
        record_json text not null
      );

      create index if not exists idx_staff_documents_user_id
        on staff_documents (user_id);

      create index if not exists idx_staff_documents_gig_id
        on staff_documents (gig_id);

      create table if not exists system_email_templates (
        id text primary key,
        template_json text not null,
        updated_at text not null
      );

      create table if not exists system_singleton_settings (
        setting_key text primary key,
        value_json text not null,
        updated_at text not null
      );

      create table if not exists gigs (
        id text primary key,
        artist text not null,
        date text not null,
        country text not null,
        status text not null,
        gig_json text not null,
        created_at text not null,
        updated_at text not null
      );

      create index if not exists idx_gigs_date
        on gigs (date);

      create table if not exists shifts (
        id text primary key,
        gig_id text not null,
        shift_json text not null,
        created_at text not null,
        updated_at text not null
      );

      create index if not exists idx_shifts_gig_id
        on shifts (gig_id);
    `)
      .then(() => undefined)
      .catch(async (error) => {
        if (shouldMarkPostgresUnavailable(error)) {
          await markPostgresUnavailable();
          console.error(
            "Failed to connect to the SCM Postgres database. Falling back to bundled data where possible.",
            error,
          );
          return;
        }

        // If schema bootstrap fails, keep the client available so existing
        // tables can still serve live data instead of forcing bundled fallback.
        globalForPostgres.__scmPostgresSchemaFailed = true;
        globalForPostgres.__scmPostgresSchemaPromise = undefined;
        console.error(
          "Failed to ensure the SCM Postgres schema. Continuing with existing tables and falling back only where necessary.",
          error,
        );
      });
  }

  await globalForPostgres.__scmPostgresSchemaPromise;
}

export function serializeJson(value: unknown) {
  return JSON.stringify(value);
}

export function parseJsonValue<T>(value: string | null | undefined, fallback: T) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
