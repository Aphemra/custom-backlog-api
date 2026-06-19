import { useState, type ReactNode } from "react";

interface CollapsibleDetailsSectionProps {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleDetailsSection({ title, summary, defaultOpen = false, children }: CollapsibleDetailsSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={`collapsible-details-section ${isOpen ? "collapsible-details-section--open" : ""}`}>
      <button className="collapsible-details-section__header" type="button" onClick={() => setIsOpen((currentValue) => !currentValue)}>
        <span>
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </span>

        <span className="collapsible-details-section__chevron" aria-hidden="true">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      <div className="collapsible-details-section__content-shell">
        <div className="collapsible-details-section__content">{children}</div>
      </div>
    </section>
  );
}
