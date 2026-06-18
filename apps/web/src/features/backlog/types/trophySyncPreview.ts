export interface ManualTrophySyncInput {
  psnProfilesUrl: string;
  earnedTrophies: number;
  totalTrophies: number;
}

export interface TrophySyncPreviewChange {
  field: "psnProfilesUrl" | "earnedTrophies" | "totalTrophies" | "completionPercent";
  label: string;
  currentValue: string;
  nextValue: string;
}

export type TrophySyncPreviewAlertSeverity = "info" | "warning";

export interface TrophySyncPreviewAlert {
  severity: TrophySyncPreviewAlertSeverity;
  title: string;
  message: string;
}

export interface TrophySyncPreview {
  hasChanges: boolean;
  changes: TrophySyncPreviewChange[];
  warnings: string[];
  alerts: TrophySyncPreviewAlert[];
  nextData: ManualTrophySyncInput;
  nextCompletionPercent: number;
}
