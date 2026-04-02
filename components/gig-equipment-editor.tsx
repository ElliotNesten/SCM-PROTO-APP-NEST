"use client";

import { useState } from "react";

import { equipmentOptions } from "@/data/equipment-options";
import type { GigEquipmentItem } from "@/types/scm";

type EquipmentCounts = Record<(typeof equipmentOptions)[number]["key"], number>;

function buildEquipmentCounts(initialEquipment: GigEquipmentItem[]) {
  const savedCounts = new Map(initialEquipment.map((item) => [item.key, item.quantity]));

  return equipmentOptions.reduce((counts, item) => {
    counts[item.key] = savedCounts.get(item.key) ?? 0;
    return counts;
  }, {} as EquipmentCounts);
}

export function GigEquipmentEditor({
  gigId,
  initialEquipment,
}: {
  gigId: string;
  initialEquipment: GigEquipmentItem[];
}) {
  const [counts, setCounts] = useState<EquipmentCounts>(
    buildEquipmentCounts(initialEquipment),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const registeredCount = equipmentOptions.filter((item) => counts[item.key] > 0).length;

  function updateCount(key: keyof EquipmentCounts, value: number) {
    setCounts((current) => ({
      ...current,
      [key]: Math.max(0, value),
    }));
  }

  async function saveEquipment() {
    setSaveMessage(null);
    setIsSaving(true);

    try {
      const payload = {
        equipment: equipmentOptions.map((item) => ({
          key: item.key,
          label: item.label,
          quantity: counts[item.key],
        })),
      };

      const response = await fetch(`/api/gigs/${gigId}/equipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        setSaveMessage("Could not save equipment.");
        return;
      }

      setSaveMessage("Equipment saved.");
    } catch {
      setSaveMessage("Could not save equipment.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="equipment-editor">
      <div className="section-head">
        <div>
          <p className="eyebrow">Equipment</p>
          <h2>Register and update quantities</h2>
        </div>
        <button
          type="button"
          className="button ghost"
          onClick={() => {
            setIsOpen((current) => !current);
          }}
        >
          {isOpen ? "Hide equipment" : "Open equipment"}
        </button>
      </div>

      {!isOpen ? (
        <p className="small-text equipment-collapsed-copy">
          {registeredCount > 0
            ? `${registeredCount} equipment categories are registered for this gig.`
            : "No equipment has been registered for this gig yet."}
        </p>
      ) : null}

      {isOpen ? (
        <>
          <div className="equipment-list">
            {equipmentOptions.map((item) => (
              <div key={item.key} className="equipment-row">
                <div className="equipment-row-copy">
                  <strong>{item.label}</strong>
                  <p className="small-text">{item.helper}</p>
                </div>

                <div className="equipment-quantity-controls">
                  <button
                    type="button"
                    className="equipment-stepper"
                    aria-label={`Decrease ${item.label}`}
                    onClick={() => updateCount(item.key, counts[item.key] - 1)}
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className="equipment-quantity-input"
                    value={counts[item.key]}
                    onChange={(event) =>
                      updateCount(item.key, Number(event.currentTarget.value) || 0)
                    }
                  />

                  <button
                    type="button"
                    className="equipment-stepper"
                    aria-label={`Increase ${item.label}`}
                    onClick={() => updateCount(item.key, counts[item.key] + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="equipment-editor-actions">
            {saveMessage ? (
              <p className="small-text equipment-save-message">{saveMessage}</p>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="button"
              disabled={isSaving}
              onClick={() => {
                void saveEquipment();
              }}
            >
              {isSaving ? "Saving..." : "Save equipment"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
