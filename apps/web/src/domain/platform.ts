export type PlatformFamily = "playstation" | "xbox" | "nintendo" | "pc" | "mixed";

export type PlatformId = "ps1" | "ps2" | "ps3" | "ps4" | "ps5" | "psp" | "ps-vita" | "psvr" | "psvr2";

export interface Platform {
  id: PlatformId;
  name: string;
  shortName: string;
  family: PlatformFamily;
}
