export interface ManualTrophySyncInput {
  psnProfilesUrl: string;
  earnedTrophies: number;
  totalTrophies: number;
}

export interface TrophySyncPreviewChange {
  field: "psnProfilesUrl" | "earnedTrophies" | "totalTrophies";
  label: string;
  currentValue: string;
  nextValue: string;
}

export interface TrophySyncPreview {
  hasChanges: boolean;
  changes: TrophySyncPreviewChange[];
  warnings: string[];
  nextData: ManualTrophySyncInput;
}
