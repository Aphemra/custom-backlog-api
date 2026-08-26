import type {
  PortableImportPreview,
  PortableImportResult,
} from "../../domain/portableData";
import { requestJson } from "./apiClient";

export const portableDataApi = {
  preview(portableData: unknown): Promise<PortableImportPreview> {
    return requestJson<PortableImportPreview>("/api/data/imports/preview", {
      method: "POST",
      body: JSON.stringify(portableData),
    });
  },

  import(portableData: unknown): Promise<PortableImportResult> {
    return requestJson<PortableImportResult>("/api/data/imports", {
      method: "POST",
      body: JSON.stringify(portableData),
    });
  },
};
