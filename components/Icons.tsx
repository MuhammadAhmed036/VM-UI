import type { SVGProps } from "react";

function IconBase({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

export function ServerIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></IconBase>;
}
export function PlayIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><circle cx="12" cy="12" r="9"/><path d="m10 9 5 3-5 3Z"/></IconBase>;
}
export function NetworkIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="9" y="15" width="6" height="6" rx="1.5"/><path d="M6 9v2h12V9M12 11v4"/></IconBase>;
}
export function DatabaseIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></IconBase>;
}
export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z"/></IconBase>;
}
export function RefreshIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.2 6.2L4 9M5.5 15A7 7 0 0 0 17.8 17.8L20 15"/></IconBase>;
}
export function TerminalIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M12 15h5"/></IconBase>;
}
export function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m5 12 4 4L19 6"/></IconBase>;
}
export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase>;
}
export function BoxIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/></IconBase>;
}
export function LayersIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></IconBase>;
}
export function ScreenIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></IconBase>;
}
export function StopIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><rect x="7" y="7" width="10" height="10" rx="1.5"/></IconBase>;
}
export function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z"/></IconBase>;
}
export function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 0 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.37 9c.18.58.74 1 1.55 1H21a2 2 0 0 1 0 4h-.08a1.7 1.7 0 0 0-1.55 1Z"/></IconBase>;
}
