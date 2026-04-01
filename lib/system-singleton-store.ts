import {
  ensureProductionStorageSchema,
  getPostgresClient,
  parseJsonValue,
  serializeJson,
} from "@/lib/postgres";

type SingletonSettingRow = {
  value_json: string;
};

type ReadSingletonSystemSettingOptions<T> = {
  settingKey: string;
  normalize: (value: Partial<T> | null | undefined) => T;
  readFallback: () => Promise<T>;
};

type WriteSingletonSystemSettingOptions<T> = {
  settingKey: string;
  value: Partial<T> | null | undefined;
  normalize: (value: Partial<T> | null | undefined) => T;
  writeFallback: (value: T) => Promise<void>;
};

async function upsertSingletonSystemSetting(settingKey: string, value: unknown) {
  const sql = getPostgresClient();

  if (!sql) {
    return;
  }

  await ensureProductionStorageSchema();
  await sql`
    insert into system_singleton_settings (setting_key, value_json, updated_at)
    values (
      ${settingKey},
      ${serializeJson(value)},
      ${new Date().toISOString()}
    )
    on conflict (setting_key) do update set
      value_json = excluded.value_json,
      updated_at = excluded.updated_at
  `;
}

export async function readSingletonSystemSetting<T>({
  settingKey,
  normalize,
  readFallback,
}: ReadSingletonSystemSettingOptions<T>) {
  const sql = getPostgresClient();

  if (!sql) {
    return readFallback();
  }

  await ensureProductionStorageSchema();
  const rows = await sql<SingletonSettingRow[]>`
    select value_json
    from system_singleton_settings
    where setting_key = ${settingKey}
    limit 1
  `;

  if (rows[0]?.value_json) {
    return normalize(parseJsonValue<Partial<T>>(rows[0].value_json, {} as Partial<T>));
  }

  const fallbackValue = normalize(await readFallback());
  await upsertSingletonSystemSetting(settingKey, fallbackValue);
  return fallbackValue;
}

export async function writeSingletonSystemSetting<T>({
  settingKey,
  value,
  normalize,
  writeFallback,
}: WriteSingletonSystemSettingOptions<T>) {
  const normalizedValue = normalize(value);
  const sql = getPostgresClient();

  if (sql) {
    await upsertSingletonSystemSetting(settingKey, normalizedValue);
    return normalizedValue;
  }

  await writeFallback(normalizedValue);
  return normalizedValue;
}
