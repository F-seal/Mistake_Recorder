import type { ReactNode, SVGProps } from "react";

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function Svg({
  size = 22,
  className,
  strokeWidth = 1.6,
  children,
  ...props
}: IconProps & { children: ReactNode } & Omit<SVGProps<SVGSVGElement>, "children">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function RulebookIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4.5h12.5A1.5 1.5 0 0 1 19 6v13.5H6.5A1.5 1.5 0 0 1 5 18V4.5Z" />
      <path d="M5 6.5A2 2 0 0 1 7 4.5h12" />
      <path d="M8.5 9.5h7M8.5 13h5.5" />
    </Svg>
  );
}

export function InsightsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h16" />
      <path d="M7 20V12M12 20V7M17 20v-5" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.83-2.83.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3h4v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9c.2.6.76 1 1.4 1H21v4h-.09c-.64 0-1.2.4-1.51 1Z" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m14.5 6-6 6 6 6" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9.5 6 6 6-6 6" />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </Svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14 8 3 3" />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 7h15M9 7V4.5h6V7M6.5 7l.8 12h9.4l.8-12M10 10.5v5M14 10.5v5" />
    </Svg>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h16v11H4V8ZM3 4h18v4H3V4Z" />
      <path d="M9 12h6" />
    </Svg>
  );
}

export function RestoreIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 8h16v11H4V8ZM3 4h18v4H3V4Z" />
      <path d="M12 16v-5M9.5 13.5 12 11l2.5 2.5" />
    </Svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5c.55 4.65 2.35 6.45 7 7-4.65.55-6.45 2.35-7 7-.55-4.65-2.35-6.45-7-7 4.65-.55 6.45-2.35 7-7Z" />
      <path d="M18.5 16.5c.2 1.55.8 2.15 2.35 2.35-1.55.2-2.15.8-2.35 2.35-.2-1.55-.8-2.15-2.35-2.35 1.55-.2 2.15-.8 2.35-2.35Z" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
    </Svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 15.5v-11M7.5 8.5 12 4l4.5 4.5M5 19.5h14" />
    </Svg>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h8M17 12v3M20 12v2" />
    </Svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 12h15M12 4c2.2 2.2 3.3 5 3.3 8S14.2 17.8 12 20c-2.2-2.2-3.3-5-3.3-8S9.8 6.2 12 4Z" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9.5v5M12 17.5h.01" />
    </Svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m4 12 16-8-5.5 16-3.2-6.3L4 12Z" />
      <path d="m11.3 13.7 3.2-3.2" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </Svg>
  );
}
