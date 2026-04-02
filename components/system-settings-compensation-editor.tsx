"use client";

import { useState } from "react";

import { formatHourlyRateLabel, normalizeHourlyRate } from "@/lib/compensation";
import {
  compensationCountries,
  compensationCurrencyByCountry,
  type CompensationCountry,
  type SystemCompensationSettings,
} from "@/types/compensation";
import { staffRoleKeys, type StaffRoleKey } from "@/types/staff-role";

export function SystemSettingsCompensationEditor({
  initialSettings,
}: {
  initialSettings: SystemCompensationSettings;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function updateRate(
    country: CompensationCountry,
    roleKey: StaffRoleKey,
    value: number,
  ) {
    setSettings((currentSettings) => ({
      ...currentSettings,
      defaultHourlyRates: {
        ...currentSettings.defaultHourlyRates,
        [country]: {
          ...currentSettings.defaultHourlyRates[country],
          [roleKey]: normalizeHourlyRate(value),
        },
      },
    }));
  }

  async function saveSettings() {
    setFeedbackMessage(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/system-settings/compensation", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          defaultHourlyRates: settings.defaultHourlyRates,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; settings?: SystemCompensationSettings }
        | null;

      if (!response.ok || !payload?.settings) {
        setFeedbackMessage(payload?.error ?? "Could not save compensation settings.");
        return;
      }

      setSettings(payload.settings);
      setFeedbackMessage("Compensation settings saved.");
    } catch {
      setFeedbackMessage("Could not save compensation settings.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="card system-settings-editor system-settings-compensation-card">
      <div className="system-settings-copy">
        <p className="eyebrow">COMPENSATION</p>
        <h2>Standard hourly wages</h2>
        <p>
          Set the default hourly wage per country and role. New profiles start on
          the standard wage, and profile-specific overrides can still be confirmed
          later when needed.
        </p>
      </div>

      <div className="system-settings-compensation-grid">
        {compensationCountries.map((country) => (
          <section key={country} className="system-settings-compensation-country-card">
            <div className="system-settings-compensation-country-head">
              <div>
                <strong>{country}</strong>
                <span>{compensationCurrencyByCountry[country]} defaults</span>
              </div>
              <span className="chip">
                {formatHourlyRateLabel(country, settings.defaultHourlyRates[country].Seller)}
              </span>
            </div>

            <div className="system-settings-compensation-role-grid">
              {staffRoleKeys.map((roleKey) => (
                <label key={`${country}-${roleKey}`} className="field-label">
                  {roleKey}
                  <input
                    className="input"
                    type="number"
                    min={1}
                    step={1}
                    value={settings.defaultHourlyRates[country][roleKey]}
                    onChange={(event) =>
                      updateRate(
                        country,
                        roleKey,
                        Number(event.currentTarget.value || 0),
                      )
                    }
                  />
                  <small className="helper-caption">
                    {formatHourlyRateLabel(
                      country,
                      settings.defaultHourlyRates[country][roleKey],
                    )}
                  </small>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="system-settings-actions">
        {feedbackMessage ? (
          <p className="system-settings-feedback">{feedbackMessage}</p>
        ) : (
          <span />
        )}

        <button
          type="button"
          className="button"
          onClick={() => void saveSettings()}
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save compensation"}
        </button>
      </div>
    </section>
  );
}
