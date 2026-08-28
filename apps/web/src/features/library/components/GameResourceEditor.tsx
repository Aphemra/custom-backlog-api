import { useEffect, useState } from "react";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { SortableList } from "../../../components/sortable/SortableList";
import {
  gameResourceProviderLabels,
  gameResourceTypeLabels,
  gameResourceTypes,
  type GameResource,
  type GameResourceType,
} from "../../../domain/gameResource";
import { gameResourceApi } from "../../../services/api/gameResourceApi";

interface GameResourceEditorProps {
  readonly gameId: string;
}

interface ResourceDraft {
  resourceType: GameResourceType;
  url: string;
  label: string;
}

const emptyDraft: ResourceDraft = {
  resourceType: "guide",
  url: "",
  label: "",
};

function readErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The resource could not be saved.";
}

export function GameResourceEditor({ gameId }: GameResourceEditorProps) {
  const [resources, setResources] = useState<readonly GameResource[]>([]);
  const [draft, setDraft] = useState<ResourceDraft>(emptyDraft);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null,
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [busyResourceId, setBusyResourceId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resourcePendingDeletion, setResourcePendingDeletion] =
    useState<GameResource | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void gameResourceApi
      .list(gameId, controller.signal)
      .then((loadedResources) => {
        setResources(loadedResources);
        setLoadState("ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setErrorMessage(readErrorMessage(error));
        setLoadState("error");
      });

    return () => {
      controller.abort();
    };
  }, [gameId]);

  function resetDraft() {
    setDraft(emptyDraft);
    setEditingResourceId(null);
  }

  function beginEditing(resource: GameResource) {
    setDraft({
      resourceType: resource.resourceType,
      url: resource.url,
      label: resource.label ?? "",
    });
    setEditingResourceId(resource.id);
    setErrorMessage(null);
  }

  async function saveResource() {
    const url = draft.url.trim();
    const label = draft.label.trim();

    if (url.length === 0) {
      setErrorMessage("Enter the HTTPS address for this resource.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      if (editingResourceId === null) {
        const resource = await gameResourceApi.create(gameId, {
          resourceType: draft.resourceType,
          url,
          label: label.length === 0 ? null : label,
        });

        setResources((currentResources) => [...currentResources, resource]);
      } else {
        const resource = await gameResourceApi.update(
          gameId,
          editingResourceId,
          {
            resourceType: draft.resourceType,
            url,
            label: label.length === 0 ? null : label,
          },
        );

        setResources((currentResources) =>
          currentResources.map((candidate) =>
            candidate.id === resource.id ? resource : candidate,
          ),
        );
      }

      resetDraft();
    } catch (error: unknown) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function reorderResources(reorderedResources: readonly GameResource[]) {
    const previousResources = resources;

    setResources(reorderedResources);
    setBusyResourceId("resource-order");
    setErrorMessage(null);

    try {
      const savedResources = await gameResourceApi.reorder(
        gameId,
        reorderedResources.map((resource) => resource.id),
      );

      setResources(savedResources);
    } catch (error: unknown) {
      setResources(previousResources);
      setErrorMessage(readErrorMessage(error));
    } finally {
      setBusyResourceId(null);
    }
  }

  async function deleteResource(resource: GameResource) {
    setBusyResourceId(resource.id);
    setErrorMessage(null);

    try {
      await gameResourceApi.deletePermanently(gameId, resource.id);

      setResources((currentResources) =>
        currentResources.filter((candidate) => candidate.id !== resource.id),
      );

      if (editingResourceId === resource.id) {
        resetDraft();
      }

      setResourcePendingDeletion(null);
    } catch (error: unknown) {
      setErrorMessage(readErrorMessage(error));
    } finally {
      setBusyResourceId(null);
    }
  }

  const isBusy = isSaving || busyResourceId !== null;

  return (
    <section
      className="resource-editor"
      aria-labelledby={`game-resources-${gameId}`}
    >
      <div className="resource-editor__heading">
        <div>
          <h3 id={`game-resources-${gameId}`}>Useful links</h3>
          <p>
            Add trophy pages, guides, or interactive maps. Known providers are
            detected automatically from the address.
          </p>
        </div>

        <span>{resources.length}</span>
      </div>

      {loadState === "loading" ? (
        <p className="resource-editor__message" role="status">
          Loading links…
        </p>
      ) : null}

      {loadState === "error" ? (
        <p className="resource-editor__message">
          Existing links could not be loaded.
        </p>
      ) : null}

      {loadState === "ready" && resources.length === 0 ? (
        <p className="resource-editor__message">
          No trophy pages, guides, or maps have been added.
        </p>
      ) : null}

      {resources.length === 0 ? null : (
        <SortableList
          items={resources}
          disabled={isBusy}
          ariaLabel="Useful links"
          getItemLabel={(resource) =>
            resource.label ??
            `${gameResourceProviderLabels[resource.provider]} ${
              gameResourceTypeLabels[resource.resourceType]
            }`
          }
          onReorder={(reorderedResources) =>
            void reorderResources(reorderedResources)
          }
          renderItem={(resource, controls) => {
            const resourceIsBusy = busyResourceId === resource.id;
            const displayName =
              resource.label ??
              `${gameResourceProviderLabels[resource.provider]} ${
                gameResourceTypeLabels[resource.resourceType]
              }`;

            return (
              <div className="resource-item">
                <div className="resource-item__order">
                  {controls.dragHandle}

                  <button
                    className="order-button"
                    type="button"
                    disabled={!controls.canMoveUp}
                    onClick={controls.moveUp}
                    aria-label={`Move ${displayName} up`}
                  >
                    ↑
                  </button>

                  <span className="order-number">{controls.position}</span>

                  <button
                    className="order-button"
                    type="button"
                    disabled={!controls.canMoveDown}
                    onClick={controls.moveDown}
                    aria-label={`Move ${displayName} down`}
                  >
                    ↓
                  </button>
                </div>

                <div className="resource-item__identity">
                  <a href={resource.url} target="_blank" rel="noreferrer">
                    {displayName}
                  </a>

                  <span>
                    {gameResourceTypeLabels[resource.resourceType]} ·{" "}
                    {gameResourceProviderLabels[resource.provider]}
                  </span>
                </div>

                <div className="resource-item__actions">
                  <button
                    className="text-button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => beginEditing(resource)}
                  >
                    Edit
                  </button>

                  <button
                    className="text-button text-button--danger"
                    type="button"
                    disabled={isBusy}
                    onClick={() => setResourcePendingDeletion(resource)}
                  >
                    {resourceIsBusy ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            );
          }}
        />
      )}

      <div className="resource-editor__fields">
        <label className="field">
          <span>Link type</span>
          <select
            value={draft.resourceType}
            disabled={isBusy}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                resourceType: event.target.value as GameResourceType,
              }))
            }
          >
            {gameResourceTypes.map((resourceType) => (
              <option key={resourceType} value={resourceType}>
                {gameResourceTypeLabels[resourceType]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Label</span>
          <input
            maxLength={100}
            value={draft.label}
            disabled={isBusy}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                label: event.target.value,
              }))
            }
            placeholder="Optional custom name"
          />
        </label>

        <label className="field field--wide resource-editor__url">
          <span>HTTPS address</span>
          <input
            type="url"
            maxLength={2048}
            value={draft.url}
            disabled={isBusy}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                url: event.target.value,
              }))
            }
            placeholder="https://…"
          />
        </label>
      </div>

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      <ConfirmDialog
        open={resourcePendingDeletion !== null}
        title="Delete useful link?"
        description={
          <p>
            Delete{" "}
            <strong>
              {resourcePendingDeletion?.label ??
                (resourcePendingDeletion === null
                  ? "this link"
                  : `${
                      gameResourceProviderLabels[
                        resourcePendingDeletion.provider
                      ]
                    } ${
                      gameResourceTypeLabels[
                        resourcePendingDeletion.resourceType
                      ]
                    }`)}
            </strong>
            ? The game itself will not be changed.
          </p>
        }
        confirmLabel="Delete link"
        busy={busyResourceId === resourcePendingDeletion?.id}
        onCancel={() => setResourcePendingDeletion(null)}
        onConfirm={() => {
          if (resourcePendingDeletion !== null) {
            void deleteResource(resourcePendingDeletion);
          }
        }}
      />

      <div className="resource-editor__form-actions">
        {editingResourceId === null ? null : (
          <button
            className="button button--quiet"
            type="button"
            disabled={isSaving}
            onClick={resetDraft}
          >
            Cancel edit
          </button>
        )}

        <button
          className="button button--primary"
          type="button"
          disabled={isBusy || draft.url.trim().length === 0}
          onClick={() => void saveResource()}
        >
          {isSaving
            ? "Saving…"
            : editingResourceId === null
              ? "Add link"
              : "Save link"}
        </button>
      </div>
    </section>
  );
}
