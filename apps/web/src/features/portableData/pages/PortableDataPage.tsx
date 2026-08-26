import { useState, type ChangeEvent } from "react";
import type {
  PortableDataCounts,
  PortableImportPreview,
  PortableImportResult,
} from "../../../domain/portableData";
import { ApiError } from "../../../services/api/apiClient";
import { portableDataApi } from "../../../services/api/portableDataApi";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof SyntaxError) {
    return "The selected file is not valid JSON.";
  }

  return "Something unexpected went wrong while handling portable data.";
}

function formatDate(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

interface CountComparisonProps {
  readonly current: PortableDataCounts;
  readonly incoming: PortableDataCounts;
}

function CountComparison({ current, incoming }: CountComparisonProps) {
  const rows = [
    ["Library games", current.libraryGames, incoming.libraryGames],
    ["Collections", current.collections, incoming.collections],
    ["Collection memberships", current.memberships, incoming.memberships],
    ["Saved views", current.savedViews, incoming.savedViews],
    ["PlayStation links", current.playstationLinks, incoming.playstationLinks],
    ["Metadata entries", current.metadataEntries, incoming.metadataEntries],
    ["Trophy snapshots", current.trophySnapshots, incoming.trophySnapshots],
    ["Trophy alerts", current.trophyAlerts, incoming.trophyAlerts],
    ["Cached-image records", current.cachedImages, incoming.cachedImages],
  ] as const;

  return (
    <div
      className="import-comparison"
      role="table"
      aria-label="Import comparison"
    >
      <div
        className="import-comparison__row import-comparison__header"
        role="row"
      >
        <span role="columnheader">Data</span>
        <span role="columnheader">Current</span>
        <span role="columnheader">Incoming</span>
      </div>

      {rows.map(([label, currentCount, incomingCount]) => (
        <div className="import-comparison__row" role="row" key={label}>
          <strong role="cell">{label}</strong>
          <span role="cell">{currentCount}</span>
          <span role="cell">{incomingCount}</span>
        </div>
      ))}
    </div>
  );
}

export function PortableDataPage() {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const [portableData, setPortableData] = useState<unknown>(null);

  const [preview, setPreview] = useState<PortableImportPreview | null>(null);

  const [result, setResult] = useState<PortableImportResult | null>(null);

  const [acknowledged, setAcknowledged] = useState(false);

  const [isReadingFile, setIsReadingFile] = useState(false);

  const [isImporting, setIsImporting] = useState(false);

  const [fileInputKey, setFileInputKey] = useState(0);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFileSelection(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];

    setSelectedFileName(null);
    setPortableData(null);
    setPreview(null);
    setResult(null);
    setAcknowledged(false);
    setErrorMessage(null);

    if (file === undefined) {
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("Portable data files cannot exceed 25 MB.");

      return;
    }

    setIsReadingFile(true);

    try {
      const parsedData: unknown = JSON.parse(await file.text());

      const importPreview = await portableDataApi.preview(parsedData);

      setSelectedFileName(file.name);
      setPortableData(parsedData);
      setPreview(importPreview);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsReadingFile(false);
    }
  }

  async function handleImport(): Promise<void> {
    if (portableData === null || preview === null || !acknowledged) {
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);

    try {
      const importResult = await portableDataApi.import(portableData);

      setResult(importResult);
      setSelectedFileName(null);
      setPortableData(null);
      setPreview(null);
      setAcknowledged(false);

      setFileInputKey((currentKey) => currentKey + 1);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  }

  function cancelPreview() {
    setPortableData(null);
    setPreview(null);
    setSelectedFileName(null);
    setAcknowledged(false);

    setFileInputKey((currentKey) => currentKey + 1);
  }

  return (
    <section className="library-page" aria-labelledby="portable-data-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Local data safety</p>

          <h2 id="portable-data-title">Import / Export</h2>

          <p className="library-heading__description">
            Download a portable copy of your backlog or restore one after
            reviewing exactly what will be replaced.
          </p>
        </div>
      </div>

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      {result === null ? null : (
        <div className="notice notice--success import-success" role="status">
          <strong>Portable data imported successfully.</strong>

          <span>
            A safety backup was created as <code>{result.backup.fileName}</code>{" "}
            before anything was replaced.
          </span>
        </div>
      )}

      <div className="portable-data-grid">
        <article className="data-action-card">
          <div>
            <p className="eyebrow">Portable copy</p>

            <h3>Export your backlog</h3>

            <p>
              Downloads library games, archive states, manual ordering,
              Collections, saved views, PlayStation links, trophy history,
              alerts, metadata, and rebuildable image-cache records as JSON.
            </p>
          </div>

          <ul className="data-action-card__details">
            <li>Saved directly to your computer</li>

            <li>Readable without SQLite tools</li>

            <li>Safe to import into this app later</li>
          </ul>

          <a
            className="button button--primary data-download-link"
            href="/api/data/export"
            download
          >
            Download portable export
          </a>
        </article>

        <article className="data-action-card data-action-card--caution">
          <div>
            <p className="eyebrow">Restore or transfer</p>

            <h3>Import portable data</h3>

            <p>
              Select an export to validate it and compare its contents with your
              current backlog. Selecting a file does not change anything.
            </p>
          </div>

          <label className="file-picker">
            <span>
              {isReadingFile ? "Validating file…" : "Choose JSON export"}
            </span>

            <input
              key={fileInputKey}
              type="file"
              accept="application/json,.json"
              disabled={isReadingFile || isImporting}
              onChange={(event) => void handleFileSelection(event)}
            />
          </label>

          {selectedFileName === null ? null : (
            <p className="selected-file">
              Selected: <strong>{selectedFileName}</strong>
            </p>
          )}
        </article>
      </div>

      {preview === null ? null : (
        <section
          className="import-preview"
          aria-labelledby="import-preview-title"
        >
          <div className="import-preview__heading">
            <div>
              <p className="eyebrow">Validated export</p>

              <h3 id="import-preview-title">Review replacement</h3>
            </div>

            <span className="format-badge">
              Format v{preview.formatVersion}
            </span>
          </div>

          <p className="import-preview__date">
            Exported {formatDate(preview.exportedAt)}
          </p>

          <CountComparison
            current={preview.current}
            incoming={preview.incoming}
          />

          <div className="replacement-warning">
            <strong>
              This replaces all portable backlog and integration data.
            </strong>

            <span>
              Immediately before replacement, the API creates a restorable
              SQLite backup. If any write fails, the database transaction is
              rolled back.
            </span>
          </div>

          <label className="import-acknowledgement">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={isImporting}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />

            <span>
              I understand that the incoming data will replace my current
              library, Collections, saved views, metadata, trophy history,
              alerts, and image-cache records.
            </span>
          </label>

          <div className="form-actions">
            <button
              className="button button--quiet"
              type="button"
              disabled={isImporting}
              onClick={cancelPreview}
            >
              Cancel
            </button>

            <button
              className="button button--danger"
              type="button"
              disabled={!acknowledged || isImporting}
              onClick={() => void handleImport()}
            >
              {isImporting
                ? "Creating backup and importing…"
                : "Back up and replace data"}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
