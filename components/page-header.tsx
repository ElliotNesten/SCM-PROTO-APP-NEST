import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  leading,
  actions,
  eyebrow = "SCM PLATFORM",
}: {
  title: string;
  subtitle: string;
  leading?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        {leading ? <div className="page-header-leading">{leading}</div> : null}
        <div className="page-header-copy">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}
