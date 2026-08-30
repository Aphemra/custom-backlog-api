import { Tooltip } from "./Tooltip";

export function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="6" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="18" r="1" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  );
}

export function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function ShowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function HideIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12s3.5-6 9-6c2.1 0 4 0.7 5.5 1.8" />
      <path d="M21 12s-3.5 6-9 6c-2.1 0-4-0.7-5.5-1.8" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

export function GameListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
      <path d="M8 6h12" />
      <path d="M8 12h12" />
      <path d="M8 18h6" />
      <path d="M18 15v6" />
      <path d="M15 18h6" />
    </svg>
  );
}

export function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="m20 4-9 9" />
      <path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </svg>
  );
}

export function AccountLoginIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <path d="M3 19c0-3.3 2-5 5-5 1.7 0 3.1.5 4 1.5" />
      <path d="M14 12h7" />
      <path d="m18 8 4 4-4 4" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="7.5" cy="16.5" r="3.5" />
      <path d="m10 14 9-9" />
      <path d="m16 5 3 3" />
      <path d="m14 10 2 2" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14 4 6 6" />
      <path d="m16 8-5.5 5.5" />
      <path d="m8.5 11.5-4 4 4 4 4-4" />
      <path d="m4 20 5-5" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5v1a4 4 0 0 0 4 4" />
      <path d="M16 6h3v1a4 4 0 0 1-4 4" />
      <path d="M12 12v4" />
      <path d="M9 20h6" />
      <path d="M10 16h4v4h-4z" />
    </svg>
  );
}

export type TrophyGrade = "bronze" | "silver" | "gold" | "platinum" | "secret";

const trophyGradeLabels: Readonly<Record<TrophyGrade, string>> = {
  bronze: "Bronze trophy",
  silver: "Silver trophy",
  gold: "Gold trophy",
  platinum: "Platinum trophy",
  secret: "Secret trophy",
};

interface TrophyGradeIconProps {
  readonly grade: TrophyGrade;
  readonly label?: string;
}

export function TrophyGradeIcon({ grade, label }: TrophyGradeIconProps) {
  const accessibleLabel = label ?? trophyGradeLabels[grade];

  return (
    <Tooltip content={accessibleLabel} placement="top" alignment="center">
      <span
        className={`trophy-grade-icon trophy-grade-icon--${grade}`}
        role="img"
        aria-label={accessibleLabel}
        tabIndex={0}
      >
        <TrophyIcon />
      </span>
    </Tooltip>
  );
}

export function SyncIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M18.5 9a7 7 0 0 0-12-2L4 9" />
      <path d="M5.5 15a7 7 0 0 0 12 2l2.5-2" />
    </svg>
  );
}

export function BackupRestoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 4v14" />
      <path d="m4 14 4 4 4-4" />
      <path d="M16 20V6" />
      <path d="m12 10 4-4 4 4" />
    </svg>
  );
}

export function TuneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}
