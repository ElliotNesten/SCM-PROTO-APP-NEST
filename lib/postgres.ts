import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

const globalForPostgres = globalThis as typeof globalThis & {
  __scmPostgresClient?: SqlClient;
  __scmPostgresSchemaPromise?: Promise<void>;
};

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

export function getPostgresClient() {
  if (!isDatabaseConfigured()) {
    return null;
  }

  if (!globalForPostgres.__scmPostgresClient) {
    globalForPostgres.__scmPostgresClient = postgres(getDatabaseUrl(), {
      max: 1,
      prepare: false,
    });
  }

  return globalForPostgres.__scmPostgresClient;
}

export async function ensureProductionStorageSchema() {
  const sql = getPostgresClient();

  if (!sql) {
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
        created_at text not null,
        updated_at text not null
      );

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

      create table if not exists system_email_templates (
        id text primary key,
        template_json text not null,
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
    `)
      .then(() => undefined);
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
