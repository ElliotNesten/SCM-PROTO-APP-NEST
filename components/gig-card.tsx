import Link from "next/link";

import { formatDateLabel, getGigSalesEstimate } from "@/data/scm-data";
import type { Gig } from "@/types/scm";

import { StatusBadge } from "@/components/status-badge";

export function GigCard({ gig }: { gig: Gig }) {
  return (
    <Link
      href={`/gigs/${gig.id}`}
      className="card gig-card"
      data-text-edit-exclude="true"
    >
      <div className="row">
        <StatusBadge label={gig.country} tone="neutral" />
        <StatusBadge label={gig.status} />
      </div>

      <div>
        <h3>{gig.artist}</h3>
        <p className="muted">
          {gig.arena}, {gig.city}
        </p>
      </div>

      <p className="meta-line">
        {formatDateLabel(gig.date)} | {gig.startTime} to {gig.endTime}
      </p>

      <div className="metric-strip">
        <div>
          <span className="metric-label">Staffing</span>
          <strong>{gig.staffingProgress}%</strong>
        </div>
        <div>
          <span className="metric-label">Lifecycle</span>
          <strong>{gig.progress}%</strong>
        </div>
      </div>

      <div className="progress-bar">
        <span style={{ width: `${gig.staffingProgress}%` }} />
      </div>

      <div className="progress-bar subtle">
        <span style={{ width: `${gig.progress}%` }} />
      </div>

      <div className="row footer-row">
        <div>
          <p className="meta-label">Rep</p>
          <strong>{gig.scmRepresentative}</strong>
        </div>
        <div className="align-right">
          <p className="meta-label">Estimate</p>
          <strong>{getGigSalesEstimate(gig).toLocaleString("en-GB")} SEK</strong>
        </div>
      </div>
    </Link>
  );
}
