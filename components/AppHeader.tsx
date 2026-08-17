import type { SectionId } from "@/lib/types";

const sections: { id: SectionId; label: string }[] = [
  { id: "main", label: "Main" },
  { id: "consumer", label: "Consumer" },
  { id: "ui", label: "UI" },
];

export function AppHeader({ active, onChange }: { active: SectionId; onChange: (id: SectionId) => void }) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="brand-block">
          <div className="brand-logo">DM</div>
          <div>
            <div className="brand-name">Deployment Manager</div>
            <div className="brand-subtitle">Local deployment console</div>
          </div>
        </div>

        <nav className="main-nav" aria-label="Deployment sections">
          {sections.map((section) => (
            <button
              key={section.id}
              className={active === section.id ? "nav-item active" : "nav-item"}
              onClick={() => onChange(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="preview-badge"><span /> UI Preview</div>
      </div>
    </header>
  );
}
