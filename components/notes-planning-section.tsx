"use client";

import { useState } from "react";

export function NotesPlanningSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [arenaNotes, setArenaNotes] = useState("");
  const [securitySetup, setSecuritySetup] = useState("");
  const [generalComments, setGeneralComments] = useState("");

  return (
    <section className="card">
      <input type="hidden" name="arenaNotes" value={arenaNotes} />
      <input type="hidden" name="securitySetup" value={securitySetup} />
      <input type="hidden" name="generalComments" value={generalComments} />

      <div className="section-head">
        <div>
          <p className="eyebrow">Notes & planning</p>
          <h2>Internal notes and planning</h2>
        </div>

        <button
          type="button"
          className="button ghost equipment-section-toggle"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? "Hide notes & planning" : "Open notes & planning"}
        </button>
      </div>

      {isOpen ? (
        <div className="field-grid single-column">
          <label className="field">
            <span>Arena notes</span>
            <textarea
              name="arenaNotes-visible"
              placeholder="High traffic expected before doors."
              value={arenaNotes}
              onChange={(event) => setArenaNotes(event.currentTarget.value)}
            />
          </label>
          <label className="field">
            <span>Security setup</span>
            <textarea
              name="securitySetup-visible"
              placeholder="Security notes and access requirements."
              value={securitySetup}
              onChange={(event) => setSecuritySetup(event.currentTarget.value)}
            />
          </label>
          <label className="field">
            <span>General comments</span>
            <textarea
              name="generalComments-visible"
              placeholder="Internal draft notes."
              value={generalComments}
              onChange={(event) => setGeneralComments(event.currentTarget.value)}
            />
          </label>
        </div>
      ) : (
        <p className="muted">
          Open this section to add arena notes, security setup, and general planning comments.
        </p>
      )}
    </section>
  );
}
