"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ArenaAutocompleteField } from "@/components/arena-autocomplete-field";
import { getArenaLocationByName, type ArenaCatalogEntry } from "@/data/predefined-arenas";
import { resolveGigOverviewIndicator } from "@/data/scm-data";
import { GigEquipmentEditor } from "@/components/gig-equipment-editor";
import { MerchCompanyAutocompleteField } from "@/components/merch-company-autocomplete-field";
import { PromoterAutocompleteField } from "@/components/promoter-autocomplete-field";
import { ScmRepresentativeSelector } from "@/components/scm-representative-selector";
import type { ScmRepresentativeOption } from "@/lib/scm-representative-options";
import { scandinavianCountryOptions } from "@/lib/scandinavian-countries";
import { StatusBadge } from "@/components/status-badge";
import type { Gig, GigCommentField, GigOverviewIndicator } from "@/types/scm";

const overviewIndicatorOptions: Array<{
  value: GigOverviewIndicator;
  label: string;
}> = [
  { value: "identified", label: "Identified" },
  { value: "inProgress", label: "In Progress" },
  { value: "confirmed", label: "Confirmed" },
  { value: "noMerch", label: "No merch" },
];

function getIndicatorLabel(indicator: GigOverviewIndicator) {
  return (
    overviewIndicatorOptions.find((option) => option.value === indicator)?.label ?? "In Progress"
  );
}

function getIndicatorTone(indicator: GigOverviewIndicator) {
  if (indicator === "confirmed") {
    return "success" as const;
  }

  if (indicator === "identified") {
    return "warn" as const;
  }

  if (indicator === "noMerch") {
    return "danger" as const;
  }

  return "info" as const;
}

type GigOverviewEditorProps = {
  gig: Gig;
  arenaCatalog: readonly ArenaCatalogEntry[];
  coreDetailsAccess: "full" | "regionalManagerLimited" | "readOnly";
  canManageTemporaryGigManagers: boolean;
  scmStaffRepresentativeOptions: ScmRepresentativeOption[];
  temporaryGigManagerOptions: ScmRepresentativeOption[];
  temporaryGigManagers: Array<{
    staffProfileId: string;
    displayName: string;
    email: string;
    country: string;
    region: string;
    assignedAt: string;
    platformAccessEndsOn: string;
    visibleUntil: string;
  }>;
};

type StandardNoteFieldKey = "arenaNotes" | "securitySetup" | "generalComments";

type OverviewFormState = {
  artist: string;
  arena: string;
  city: string;
  country: string;
  date: string;
  startTime: string;
  endTime: string;
  promoter: string;
  merchCompany: string;
  merchRepresentative: string;
  scmRepresentative: string;
  projectManager: string;
  notes: string;
  ticketsSold: number;
  estimatedSpendPerVisitor: number;
  arenaNotes: string;
  securitySetup: string;
  generalComments: string;
  customNoteFields: GigCommentField[];
  overviewIndicator: GigOverviewIndicator;
};

function createCustomNoteField(): GigCommentField {
  return {
    id: `custom-note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "Custom heading",
    body: "",
  };
}

const standardNoteFieldOptions: Array<{
  key: StandardNoteFieldKey;
  label: string;
  placeholder: string;
}> = [
  {
    key: "arenaNotes",
    label: "Arena notes",
    placeholder: "Add arena notes for this gig.",
  },
  {
    key: "securitySetup",
    label: "Security setup",
    placeholder: "Add security notes for this gig.",
  },
  {
    key: "generalComments",
    label: "General comments",
    placeholder: "Add general comments for this gig.",
  },
];

function buildInitialState(gig: Gig): OverviewFormState {
  return {
    artist: gig.artist,
    arena: gig.arena,
    city: gig.city,
    country: gig.country,
    date: gig.date,
    startTime: gig.startTime,
    endTime: gig.endTime,
    promoter: gig.promoter,
    merchCompany: gig.merchCompany,
    merchRepresentative: gig.merchRepresentative,
    scmRepresentative: gig.scmRepresentative,
    projectManager: gig.projectManager ?? "",
    notes: gig.notes,
    ticketsSold: gig.ticketsSold,
    estimatedSpendPerVisitor: gig.estimatedSpendPerVisitor,
    arenaNotes: gig.arenaNotes ?? "",
    securitySetup: gig.securitySetup ?? "",
    generalComments: gig.generalComments ?? "",
    customNoteFields: gig.customNoteFields ?? [],
    overviewIndicator: resolveGigOverviewIndicator(gig),
  };
}

function formatTimelineDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function GigOverviewEditor({
  gig,
  arenaCatalog,
  coreDetailsAccess,
  canManageTemporaryGigManagers,
  scmStaffRepresentativeOptions,
  temporaryGigManagerOptions,
  temporaryGigManagers,
}: GigOverviewEditorProps) {
  const router = useRouter();
  const [form, setForm] = useState<OverviewFormState>(() => buildInitialState(gig));
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isScmRepresentativeSelectionValid, setIsScmRepresentativeSelectionValid] = useState(true);
  const [shareGigMessage, setShareGigMessage] = useState<string | null>(null);
  const [updatingTemporaryGigManagerId, setUpdatingTemporaryGigManagerId] = useState<
    string | null
  >(null);
  const [assignedTemporaryGigManagers, setAssignedTemporaryGigManagers] = useState(
    temporaryGigManagers,
  );
  const [visibleStandardNoteFields, setVisibleStandardNoteFields] = useState<StandardNoteFieldKey[]>(
    () =>
      standardNoteFieldOptions
        .filter(({ key }) => buildInitialState(gig)[key].trim())
        .map(({ key }) => key),
  );
  const [showNoteFieldPicker, setShowNoteFieldPicker] = useState(false);
  const totalSalesEstimate = Math.max(0, form.ticketsSold * form.estimatedSpendPerVisitor);
  const availableSuggestedNoteFields = standardNoteFieldOptions.filter(
    ({ key }) => !visibleStandardNoteFields.includes(key),
  );
  const hasFullCoreDetailAccess = coreDetailsAccess === "full";
  const hasRegionalManagerCoreAccess = coreDetailsAccess === "regionalManagerLimited";
  const hasAssignedTemporaryGigManagers = assignedTemporaryGigManagers.length > 0;

  useEffect(() => {
    setAssignedTemporaryGigManagers(temporaryGigManagers);
  }, [temporaryGigManagers]);

  function updateField<Key extends keyof OverviewFormState>(
    key: Key,
    value: OverviewFormState[Key],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateArenaAndLocation(nextArena: string) {
    const linkedLocation = getArenaLocationByName(arenaCatalog, nextArena);

    setForm((current) => ({
      ...current,
      arena: nextArena,
      city: linkedLocation?.city ?? current.city,
      country: linkedLocation?.country ?? current.country,
    }));
  }

  function updateCustomNoteField(
    fieldId: string,
    key: keyof Pick<GigCommentField, "title" | "body">,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      customNoteFields: current.customNoteFields.map((field) =>
        field.id === fieldId ? { ...field, [key]: value } : field,
      ),
    }));
  }

  function addCustomNoteField() {
    setForm((current) => ({
      ...current,
      customNoteFields: [...current.customNoteFields, createCustomNoteField()],
    }));
  }

  function addSuggestedNoteField(key: StandardNoteFieldKey | "custom") {
    if (key === "custom") {
      addCustomNoteField();
      setShowNoteFieldPicker(false);
      return;
    }

    setVisibleStandardNoteFields((current) =>
      current.includes(key) ? current : [...current, key],
    );
    setShowNoteFieldPicker(false);
  }

  function removeStandardNoteField(key: StandardNoteFieldKey) {
    setForm((current) => ({
      ...current,
      [key]: "",
    }));
    setVisibleStandardNoteFields((current) => current.filter((item) => item !== key));
  }

  function removeCustomNoteField(fieldId: string) {
    setForm((current) => ({
      ...current,
      customNoteFields: current.customNoteFields.filter((field) => field.id !== fieldId),
    }));
  }

  async function saveOverview(nextForm = form, successMessage = "Gig details saved.") {
    if (!isScmRepresentativeSelectionValid) {
      setSaveMessage(
        "Choose an SCM representative from the profile list, or use Temporary Gig Manager.",
      );
      return false;
    }

    setSaveMessage(null);
    setIsSaving(true);

    const response = await fetch(`/api/gigs/${gig.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nextForm),
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setSaveMessage(payload?.error ?? "Could not save the gig details.");
      setIsSaving(false);
      return false;
    }

    const sanitizedCustomNoteFields = nextForm.customNoteFields
      .map((field) => {
        const title = field.title.trim();
        const body = field.body.trim();

        if (!title && !body) {
          return null;
        }

        return {
          ...field,
          title: title || "Custom heading",
          body,
        };
      })
      .filter((field): field is GigCommentField => field !== null);

    setForm({
      ...nextForm,
      customNoteFields: sanitizedCustomNoteFields,
    });
    setVisibleStandardNoteFields(
      standardNoteFieldOptions
        .filter(({ key }) => nextForm[key].trim())
        .map(({ key }) => key),
    );
    setShowNoteFieldPicker(false);
    setSaveMessage(successMessage);
    setIsSaving(false);

    startTransition(() => {
      router.refresh();
    });

    return true;
  }

  function updateOverviewIndicator(nextIndicator: GigOverviewIndicator) {
    const nextForm = {
      ...form,
      overviewIndicator: nextIndicator,
    };

    setForm(nextForm);
    void saveOverview(nextForm, "Gig marker updated.");
  }

  function canEditCoreField(
    field:
      | "artist"
      | "arena"
      | "city"
      | "country"
      | "date"
      | "promoter"
      | "merchCompany"
      | "merchRepresentative"
      | "scmRepresentative"
      | "projectManager"
      | "ticketsSold"
      | "estimatedSpendPerVisitor",
  ) {
    if (hasFullCoreDetailAccess) {
      return true;
    }

    if (hasRegionalManagerCoreAccess) {
      return (
        field === "scmRepresentative" ||
        field === "ticketsSold" ||
        field === "estimatedSpendPerVisitor"
      );
    }

    return false;
  }

  async function assignTemporaryGigManager(
    staffProfileId: string,
    options?: {
      successMessage?: string | null;
      refresh?: boolean;
    },
  ) {
    setShareGigMessage(null);
    setUpdatingTemporaryGigManagerId(staffProfileId);

    const response = await fetch(`/api/gigs/${gig.id}/temporary-managers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staffProfileId }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          temporaryGigManagers?: typeof temporaryGigManagers;
        }
      | null;

    if (!response.ok) {
      setShareGigMessage(payload?.error ?? "Could not share gig info.");
      setUpdatingTemporaryGigManagerId(null);
      return false;
    }

    setAssignedTemporaryGigManagers(payload?.temporaryGigManagers ?? []);
    if (options?.successMessage !== null) {
      setShareGigMessage(
        options?.successMessage ?? "Gig info shared with Temporary Gig Manager access.",
      );
    }
    setUpdatingTemporaryGigManagerId(null);

    if (options?.refresh !== false) {
      startTransition(() => {
        router.refresh();
      });
    }

    return true;
  }

  async function assignTemporaryGigManagerAsRepresentative(option: ScmRepresentativeOption) {
    const didAssign = await assignTemporaryGigManager(option.id, {
      successMessage: null,
      refresh: false,
    });

    if (!didAssign) {
      return;
    }

    const nextForm = {
      ...form,
      scmRepresentative: option.displayName,
    };

    setForm(nextForm);
    const didSave = await saveOverview(
      nextForm,
      "SCM representative updated and gig info shared.",
    );

    setShareGigMessage(
      didSave
        ? "Gig info shared with Temporary Gig Manager access."
        : "Gig info shared, but the SCM representative could not be saved.",
    );
  }

  async function removeTemporaryGigManager(staffProfileId: string) {
    setShareGigMessage(null);
    setUpdatingTemporaryGigManagerId(staffProfileId);

    const response = await fetch(`/api/gigs/${gig.id}/temporary-managers`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ staffProfileId }),
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          temporaryGigManagers?: typeof temporaryGigManagers;
        }
      | null;

    if (!response.ok) {
      setShareGigMessage(payload?.error ?? "Could not remove Temporary Gig Manager.");
      setUpdatingTemporaryGigManagerId(null);
      return;
    }

    setAssignedTemporaryGigManagers(payload?.temporaryGigManagers ?? []);
    setShareGigMessage("Temporary Gig Manager access removed.");
    setUpdatingTemporaryGigManagerId(null);

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section className="content-grid">
      <div className="stack-column">
        <div className="card gig-overview-core-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Gig overview</p>
              <h2>Core details</h2>
            </div>
            <StatusBadge
              label={getIndicatorLabel(form.overviewIndicator)}
              tone={getIndicatorTone(form.overviewIndicator)}
            />
          </div>

          {hasRegionalManagerCoreAccess ? (
            <p className="muted small-text">
              Regional Manager can only edit Sales estimate and SCM representative in
              Core details.
            </p>
          ) : null}

          <div className="key-value-grid gig-overview-grid">
            <label className="key-value-card key-value-card-editable">
              <small>Artist</small>
              <input
                type="text"
                value={form.artist}
                disabled={!canEditCoreField("artist")}
                onChange={(event) => updateField("artist", event.currentTarget.value)}
              />
            </label>

            <label className="key-value-card key-value-card-editable">
              <small>Arena</small>
              <ArenaAutocompleteField
                value={form.arena}
                arenaCatalog={arenaCatalog}
                disabled={!canEditCoreField("arena")}
                onValueChange={updateArenaAndLocation}
              />
            </label>

            <div className="key-value-card key-value-card-editable">
              <small>City & country</small>
              <div className="overview-paired-fields">
                <label className="overview-stack-subfield">
                  <span>City</span>
                  <input
                    type="text"
                    value={form.city}
                    disabled={!canEditCoreField("city")}
                    onChange={(event) => updateField("city", event.currentTarget.value)}
                  />
                </label>

                <label className="overview-stack-subfield">
                  <span>Country</span>
                  <select
                    value={form.country}
                    disabled={!canEditCoreField("country")}
                    onChange={(event) => updateField("country", event.currentTarget.value)}
                  >
                    {scandinavianCountryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <label className="key-value-card key-value-card-editable">
              <small>Date</small>
              <input
                type="date"
                value={form.date}
                disabled={!canEditCoreField("date")}
                onChange={(event) => updateField("date", event.currentTarget.value)}
              />
            </label>

            <div className="key-value-card key-value-card-editable">
              <small>Promoter</small>
              <PromoterAutocompleteField
                value={form.promoter}
                placeholder="LIVE NATION"
                disabled={!canEditCoreField("promoter")}
                onValueChange={(nextValue) => updateField("promoter", nextValue)}
              />
            </div>

            <div className="key-value-card key-value-card-editable">
              <small>Merch details</small>
              <div className="overview-stack-fields">
                <MerchCompanyAutocompleteField
                  value={form.merchCompany}
                  placeholder="Merch company"
                  disabled={!canEditCoreField("merchCompany")}
                  onValueChange={(nextValue) => updateField("merchCompany", nextValue)}
                />
                <input
                  type="text"
                  value={form.merchRepresentative}
                  placeholder="Merch representative"
                  disabled={!canEditCoreField("merchRepresentative")}
                  onChange={(event) =>
                    updateField("merchRepresentative", event.currentTarget.value)
                  }
                />
              </div>
            </div>

            <div className="key-value-card key-value-card-editable overview-contact-card">
              <small>SCM & project manager</small>
              <div className="overview-stack-fields">
                <ScmRepresentativeSelector
                  label="SCM representative"
                  className="overview-stack-subfield"
                  value={form.scmRepresentative}
                  persistedValue={gig.scmRepresentative}
                  placeholder="Anton"
                  disabled={
                    !canEditCoreField("scmRepresentative") ||
                    isSaving ||
                    isPending ||
                    Boolean(updatingTemporaryGigManagerId)
                  }
                  scmStaffOptions={scmStaffRepresentativeOptions}
                  temporaryGigManagerOptions={temporaryGigManagerOptions}
                  onValueChange={(nextValue) => updateField("scmRepresentative", nextValue)}
                  onSelectionValidityChange={setIsScmRepresentativeSelectionValid}
                  onTemporaryGigManagerSelect={assignTemporaryGigManagerAsRepresentative}
                  showTemporaryGigManagerOption={canManageTemporaryGigManagers}
                  scmStaffHelperText="Type to search and choose an SCM Staff profile. Save details when you are done."
                  temporaryGigManagerHelperText="Choose a Staff profile to set the representative and share gig info for this specific gig."
                />

                <label className="overview-stack-subfield">
                  <span>Project manager</span>
                  <input
                    type="text"
                    value={form.projectManager}
                    disabled={!canEditCoreField("projectManager")}
                    onChange={(event) =>
                      updateField("projectManager", event.currentTarget.value)
                    }
                  />
                </label>

                {hasAssignedTemporaryGigManagers ? (
                  <div className="temporary-gig-manager-panel">
                    <div className="temporary-gig-manager-head">
                      <div className="temporary-gig-manager-copy">
                        <span>Temporary Gig Manager</span>
                        <small>Gig-specific access only</small>
                      </div>
                    </div>

                    <div className="temporary-gig-manager-list">
                      {assignedTemporaryGigManagers.map((manager) => (
                        <div
                          key={manager.staffProfileId}
                          className="temporary-gig-manager-item"
                          data-text-edit-exclude="true"
                        >
                          <div>
                            <strong>{manager.displayName}</strong>
                            <p className="muted small-text">
                              {manager.email} | {manager.region}, {manager.country}
                            </p>
                            <p className="muted small-text">
                              Platform access until{" "}
                              {formatTimelineDate(manager.platformAccessEndsOn)}. Visible in SCM
                              Staff until {formatTimelineDate(manager.visibleUntil)}.
                            </p>
                          </div>

                          {canManageTemporaryGigManagers ? (
                            <button
                              type="button"
                              className="text-link note-remove-button"
                              disabled={
                                updatingTemporaryGigManagerId === manager.staffProfileId ||
                                isPending
                              }
                              onClick={() => removeTemporaryGigManager(manager.staffProfileId)}
                            >
                              {updatingTemporaryGigManagerId === manager.staffProfileId
                                ? "Removing..."
                                : "Remove"}
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {shareGigMessage ? (
                  <p className="small-text equipment-save-message">{shareGigMessage}</p>
                ) : null}
              </div>
            </div>

            <div className="key-value-card key-value-card-editable sales-estimate-card">
              <small>Sales estimate (SEK)</small>
              <div className="sales-estimate-grid">
                <label className="sales-estimate-field">
                  <span>Ticket numbers</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.ticketsSold}
                    disabled={!canEditCoreField("ticketsSold")}
                    onChange={(event) =>
                      updateField("ticketsSold", Number(event.currentTarget.value) || 0)
                    }
                  />
                </label>

                <label className="sales-estimate-field">
                  <span>Estimated sales per person</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.estimatedSpendPerVisitor}
                    disabled={!canEditCoreField("estimatedSpendPerVisitor")}
                    onChange={(event) =>
                      updateField(
                        "estimatedSpendPerVisitor",
                        Number(event.currentTarget.value) || 0,
                      )
                    }
                  />
                </label>
              </div>

              <div className="sales-estimate-total">
                <span>Total estimate</span>
                <strong>{new Intl.NumberFormat("sv-SE").format(totalSalesEstimate)}</strong>
              </div>
            </div>
          </div>

          <div className="overview-editor-actions">
            {saveMessage ? (
              <p className="small-text equipment-save-message">{saveMessage}</p>
            ) : (
              <span />
            )}
            <button
              type="button"
              className="button"
              disabled={isSaving || isPending || !isScmRepresentativeSelectionValid}
              onClick={() => {
                void saveOverview(form);
              }}
            >
              {isSaving || isPending ? "Saving..." : "Save details"}
            </button>
          </div>
        </div>

        <div className="card">
          <GigEquipmentEditor gigId={gig.id} initialEquipment={gig.equipment ?? []} />
        </div>
      </div>

      <div className="stack-column">
        <div className="card">
          <div className="overview-indicator-panel">
            <p className="eyebrow">Overview marker</p>
            <div className="overview-indicator-buttons">
              {overviewIndicatorOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`overview-indicator-button ${option.value} ${
                    form.overviewIndicator === option.value ? "active" : ""
                  }`}
                  disabled={isSaving || isPending}
                  onClick={() => updateOverviewIndicator(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="section-head">
            <div>
              <p className="eyebrow">Notes</p>
              <h2>Gig notes</h2>
            </div>
          </div>

          <label className="field">
            <span>Internal notes</span>
            <textarea
              rows={10}
              placeholder="Add operational notes for this gig."
              value={form.notes}
              onChange={(event) => updateField("notes", event.currentTarget.value)}
            />
          </label>

          <div className="gig-planning-note-list">
            {standardNoteFieldOptions
              .filter(({ key }) => visibleStandardNoteFields.includes(key))
              .map((field) => (
                <label key={field.key} className="field note-editor-field">
                  <div className="note-editor-head">
                    <span>{field.label}</span>
                    <button
                      type="button"
                      className="text-link note-remove-button"
                      disabled={isSaving || isPending}
                      onClick={() => removeStandardNoteField(field.key)}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    placeholder={field.placeholder}
                    value={form[field.key]}
                    onChange={(event) => updateField(field.key, event.currentTarget.value)}
                  />
                </label>
              ))}

            {form.customNoteFields.map((field) => (
              <div key={field.id} className="field note-editor-field custom-note-field">
                <div className="note-editor-head">
                  <input
                    type="text"
                    className="custom-note-heading-input"
                    placeholder="Write your heading"
                    value={field.title}
                    onChange={(event) =>
                      updateCustomNoteField(field.id, "title", event.currentTarget.value)
                    }
                  />
                  <button
                    type="button"
                    className="text-link note-remove-button"
                    disabled={isSaving || isPending}
                    onClick={() => removeCustomNoteField(field.id)}
                  >
                    Remove
                  </button>
                </div>

                <textarea
                  rows={4}
                  placeholder="Write your comment"
                  value={field.body}
                  onChange={(event) =>
                    updateCustomNoteField(field.id, "body", event.currentTarget.value)
                  }
                />
              </div>
            ))}

            {showNoteFieldPicker ? (
              <div className="note-field-picker">
                <p className="small-text">Choose a heading for the new comment field.</p>
                <div className="note-field-picker-actions">
                  {availableSuggestedNoteFields.map((field) => (
                    <button
                      key={field.key}
                      type="button"
                      className="button ghost"
                      disabled={isSaving || isPending}
                      onClick={() => addSuggestedNoteField(field.key)}
                    >
                      {field.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="button ghost"
                    disabled={isSaving || isPending}
                    onClick={() => addSuggestedNoteField("custom")}
                  >
                    Custom heading
                  </button>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="button ghost"
              disabled={isSaving || isPending}
              onClick={() => setShowNoteFieldPicker((current) => !current)}
            >
              {showNoteFieldPicker ? "Hide suggestions" : "Add comment field"}
            </button>
          </div>

          {saveMessage ? (
            <div className="overview-editor-actions overview-editor-actions-status-only">
              <p className="small-text equipment-save-message">{saveMessage}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
