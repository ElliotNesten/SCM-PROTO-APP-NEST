"use client";

import { useState } from "react";

import { equipmentOptions } from "@/data/equipment-options";

type EquipmentCounts = Record<(typeof equipmentOptions)[number]["key"], number>;

const initialCounts = equipmentOptions.reduce((counts, item) => {
  counts[item.key] = 0;
  return counts;
}, {} as EquipmentCounts);

export function EquipmentSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [counts, setCounts] = useState<EquipmentCounts>(initialCounts);

  function updateCount(key: keyof EquipmentCounts, value: number) {
    setCounts((current) => ({
      ...current,
      [key]: Math.max(0, value),
    }));
  }

  return (
    <section className="card">
      {equipmentOptions.map((item) => (
        <input
          key={`hidden-${item.key}`}
          type="hidden"
          name={`equipment.${item.key}`}
          value={counts[item.key]}
        />
      ))}

      <div className="section-head">
        <div>
          <p className="eyebrow">Equipment</p>
          <h2>Counts and quantity planning</h2>
        </div>

        <button
          type="button"
          className="button ghost equipment-section-toggle"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? "Hide equipment" : "Open equipment"}
        </button>
      </div>

      {isOpen ? (
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
      ) : (
        <p className="muted">
          Open this section to set quantities for card terminals, cash registers, tents, tables,
          hotel rooms, and transport.
        </p>
      )}
    </section>
  );
}
