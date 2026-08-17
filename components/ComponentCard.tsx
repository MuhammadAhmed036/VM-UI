import type { DeployComponent } from "@/lib/types";
import { ChevronIcon, DatabaseIcon, LayersIcon, NetworkIcon, PlayIcon, ScreenIcon, ServerIcon } from "./Icons";

function ComponentIcon({ type }: { type: DeployComponent["icon"] }) {
  const className = "component-icon-svg";
  if (type === "play") return <PlayIcon className={className} />;
  if (type === "network") return <NetworkIcon className={className} />;
  if (type === "database") return <DatabaseIcon className={className} />;
  if (type === "stack") return <LayersIcon className={className} />;
  if (type === "screen") return <ScreenIcon className={className} />;
  return <ServerIcon className={className} />;
}

export function ComponentCard({ component, selected, onClick }: { component: DeployComponent; selected: boolean; onClick: () => void }) {
  return (
    <button className={selected ? "component-card selected" : "component-card"} onClick={onClick}>
      <div className="component-icon-wrap"><ComponentIcon type={component.icon} /></div>
      <div className="component-card-copy">
        <strong>{component.name}</strong>
        <span>{component.description}</span>
      </div>
      <ChevronIcon className="component-chevron" />
    </button>
  );
}
