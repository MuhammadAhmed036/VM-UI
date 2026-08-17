"use client";

import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ComponentCard } from "@/components/ComponentCard";
import { DeploymentWorkspace } from "@/components/DeploymentWorkspace";
import { BoxIcon } from "@/components/Icons";
import { getComponentsBySection } from "@/lib/deployment-catalog";
import type { DeployComponent, SectionId } from "@/lib/types";

const sectionCopy: Record<SectionId, { eyebrow: string; title: string; body: string }> = {
  main: {
    eyebrow: "Main services",
    title: "Deploy the SafeCity core stack",
    body: "Scan the Ubuntu VM for existing release packages, configure the site values, and automate the deployment steps from the provided procedures.",
  },
  consumer: {
    eyebrow: "Consumer",
    title: "Configure and deploy YOLO consumers",
    body: "All YOLO Stage2 worker, NATS, PostgreSQL, retention, and event-viewer configuration lives here.",
  },
  ui: {
    eyebrow: "UI",
    title: "Deploy the dashboard last",
    body: "Select the dashboard tar package, write the UI .env values from the form, deploy, and apply later changes with update-env.sh.",
  },
};

export default function Home() {
  const [activeSection, setActiveSection] = useState<SectionId>("main");
  const components = useMemo(() => getComponentsBySection(activeSection), [activeSection]);
  const [selectedComponentId, setSelectedComponentId] = useState<string>(components[0]?.id ?? "");
  const selectedComponent: DeployComponent | null =
    components.find((component) => component.id === selectedComponentId) ?? components[0] ?? null;
  const copy = sectionCopy[activeSection];

  function changeSection(section: SectionId) {
    const nextComponents = getComponentsBySection(section);
    setActiveSection(section);
    setSelectedComponentId(nextComponents[0]?.id ?? "");
  }

  return (
    <main className="app-shell">
      <AppHeader active={activeSection} onChange={changeSection} />

      <div className="page-container">
        <section className="hero-section">
          <div>
            <span className="eyebrow">{copy.eyebrow}</span>
            <h1>{copy.title}</h1>
            <p>{copy.body}</p>
          </div>
          <div className="vm-state-card">
            <div className="vm-state-icon"><BoxIcon /></div>
            <div>
              <span>Package source</span>
              <strong>Existing tar files on Ubuntu VM</strong>
            </div>
            <div className="online-dot" />
          </div>
        </section>

        <section>
          <div className="section-heading">
            <div>
              <h2>{activeSection === "main" ? "Deployment modules" : `${copy.eyebrow} module`}</h2>
              <p>Select the module, scan packages, review configuration, then deploy.</p>
            </div>
            <span className="component-count">{components.length} module{components.length === 1 ? "" : "s"}</span>
          </div>

          <div className="component-grid">
            {components.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                selected={selectedComponent?.id === component.id}
                onClick={() => setSelectedComponentId(component.id)}
              />
            ))}
          </div>
        </section>

        {selectedComponent ? (
          <DeploymentWorkspace key={selectedComponent.id} component={selectedComponent} />
        ) : (
          <section className="select-hint">
            <div className="select-hint-mark">1</div>
            <div>
              <strong>Select a module to continue</strong>
              <span>The deployment workspace will open here.</span>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
