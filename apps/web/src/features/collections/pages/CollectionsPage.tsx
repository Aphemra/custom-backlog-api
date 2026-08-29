import { useEffect, useMemo, useState } from "react";
import { SortableList } from "../../../components/sortable/SortableList";
import { useToast } from "../../../components/toast/useToast";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Dialog } from "../../../components/ui/Dialog";
import { IconButton } from "../../../components/ui/IconButton";
import { PlusIcon } from "../../../components/ui/icons";
import type {
  CollectionDetail,
  CollectionInput,
  CollectionSummary,
} from "../../../domain/collection";
import type { LibraryGame } from "../../../domain/libraryGame";
import { ApiError } from "../../../services/api/apiClient";
import { collectionApi } from "../../../services/api/collectionApi";
import { libraryApi } from "../../../services/api/libraryApi";
import { CollectionCard } from "../components/CollectionCard";
import { CollectionForm } from "../components/CollectionForm";
import { CollectionGameEditor } from "../components/CollectionGameEditor";

type LoadState = "loading" | "ready" | "error";

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something unexpected went wrong while updating Collections.";
}

export function CollectionsPage() {
  const { showToast } = useToast();

  const [collections, setCollections] = useState<readonly CollectionSummary[]>(
    [],
  );

  const [libraryGames, setLibraryGames] = useState<readonly LibraryGame[]>([]);

  const [managedCollection, setManagedCollection] =
    useState<CollectionDetail | null>(null);

  const [editingCollection, setEditingCollection] =
    useState<CollectionSummary | null>(null);

  const [collectionPendingDeletion, setCollectionPendingDeletion] =
    useState<CollectionSummary | null>(null);

  const [isAdding, setIsAdding] = useState(false);

  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadCollections() {
      try {
        const loadedCollections = await collectionApi.list(
          abortController.signal,
        );

        if (!abortController.signal.aborted) {
          setCollections(loadedCollections);
          setLoadState("ready");
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          setErrorMessage(getErrorMessage(error));
          setLoadState("error");
        }
      }
    }

    void loadCollections();

    return () => abortController.abort();
  }, []);

  const summary = useMemo(
    () => ({
      memberships: collections.reduce(
        (total, collection) => total + collection.gameCount,
        0,
      ),

      hiddenMemberships: collections.reduce(
        (total, collection) => total + collection.hiddenGameCount,
        0,
      ),
    }),
    [collections],
  );

  async function refreshCollections(): Promise<void> {
    setCollections(await collectionApi.list());
  }

  async function performMutation(
    key: string,
    successMessage: string,
    action: () => Promise<unknown>,
  ): Promise<boolean> {
    setBusyKey(key);

    try {
      await action();
      await refreshCollections();

      showToast({
        tone: "success",
        message: successMessage,
      });

      return true;
    } catch (error) {
      showToast({
        tone: "error",
        message: getErrorMessage(error),
      });

      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function handleCreate(input: CollectionInput): Promise<void> {
    const succeeded = await performMutation(
      "create",
      `${input.name} was created.`,
      () => collectionApi.create(input),
    );

    if (succeeded) {
      setIsAdding(false);
    }
  }

  async function handleUpdate(input: CollectionInput): Promise<void> {
    if (editingCollection === null) {
      return;
    }

    const succeeded = await performMutation(
      editingCollection.id,
      `${input.name} was updated.`,
      () => collectionApi.update(editingCollection.id, input),
    );

    if (succeeded) {
      setEditingCollection(null);
    }
  }

  async function openGameManager(collection: CollectionSummary): Promise<void> {
    if (managedCollection?.id === collection.id) {
      setManagedCollection(null);

      return;
    }

    setBusyKey(`manage-${collection.id}`);

    try {
      const [detail, games] = await Promise.all([
        collectionApi.get(collection.id),
        libraryApi.list(),
      ]);

      setManagedCollection(detail);
      setLibraryGames(games);
      setIsAdding(false);
      setEditingCollection(null);
    } catch (error) {
      showToast({
        tone: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function saveGameList(
    orderedGameIds: readonly string[],
  ): Promise<void> {
    if (managedCollection === null) {
      return;
    }

    const collection = managedCollection;
    const membershipBusyKey = `memberships-${collection.id}`;

    setBusyKey(membershipBusyKey);

    try {
      const updatedCollection = await collectionApi.replaceGames(
        collection.id,
        orderedGameIds,
      );

      setManagedCollection(updatedCollection);
      await refreshCollections();

      showToast({
        tone: "success",
        message: `The game list for ${updatedCollection.name} was saved.`,
      });
    } catch (error) {
      showToast({
        tone: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function reorderCollections(
    reorderedCollections: readonly CollectionSummary[],
  ): Promise<void> {
    const previousCollections = collections;

    setCollections(reorderedCollections);
    setBusyKey("order");

    try {
      const savedCollections = await collectionApi.reorder(
        reorderedCollections.map((collection) => collection.id),
      );

      setCollections(savedCollections);

      showToast({
        tone: "success",
        message: "Collection order was updated.",
      });
    } catch (error) {
      setCollections(previousCollections);

      showToast({
        tone: "error",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDelete(collection: CollectionSummary): Promise<void> {
    const succeeded = await performMutation(
      collection.id,
      `${collection.name} was deleted. Its games were not changed.`,
      () => collectionApi.deletePermanently(collection.id),
    );

    if (succeeded) {
      setCollectionPendingDeletion(null);

      if (managedCollection?.id === collection.id) {
        setManagedCollection(null);
      }

      if (editingCollection?.id === collection.id) {
        setEditingCollection(null);
      }
    }
  }

  function openAddForm() {
    setIsAdding(true);
    setEditingCollection(null);
    setManagedCollection(null);
  }

  function openEditForm(collection: CollectionSummary) {
    setEditingCollection(collection);
    setIsAdding(false);
    setManagedCollection(null);
  }

  function closeForm() {
    setIsAdding(false);
    setEditingCollection(null);
  }

  return (
    <section className="library-page" aria-labelledby="collections-title">
      <div className="collections-toolbar">
        <h2 id="collections-title" className="visually-hidden">
          Collections
        </h2>

        <div
          className="collections-toolbar__summary"
          aria-label="Collection summary"
        >
          <span>
            <strong>{collections.length}</strong>{" "}
            {collections.length === 1 ? "Collection" : "Collections"}
          </span>

          <span aria-hidden="true">·</span>

          <span>
            <strong>{summary.memberships}</strong>{" "}
            {summary.memberships === 1 ? "membership" : "memberships"}
          </span>

          {summary.hiddenMemberships === 0 ? null : (
            <>
              <span aria-hidden="true">·</span>

              <span>
                <strong>{summary.hiddenMemberships}</strong> hidden
              </span>
            </>
          )}
        </div>

        <IconButton
          label="Create a Collection"
          tooltip="New Collection"
          tooltipPlacement="bottom"
          tooltipAlignment="end"
          icon={<PlusIcon />}
          disabled={busyKey !== null}
          onClick={openAddForm}
        />
      </div>

      <Dialog
        open={isAdding || editingCollection !== null}
        title={
          editingCollection === null
            ? "Create Collection"
            : `Edit ${editingCollection.name}`
        }
        description={
          editingCollection === null
            ? "Create a curated group without duplicating games in your Library."
            : "Update this Collection's name and optional description."
        }
        size="small"
        dismissible={busyKey !== "create" && busyKey !== editingCollection?.id}
        onClose={closeForm}
      >
        <CollectionForm
          key={editingCollection?.id ?? "new-collection"}
          initialCollection={editingCollection ?? undefined}
          onSubmit={editingCollection === null ? handleCreate : handleUpdate}
          onCancel={closeForm}
        />
      </Dialog>

      <ConfirmDialog
        open={collectionPendingDeletion !== null}
        title="Delete Collection?"
        description={
          <p>
            Delete{" "}
            <strong>
              {collectionPendingDeletion?.name ?? "this Collection"}
            </strong>
            ? Games inside it will remain in your Library.
          </p>
        }
        confirmLabel="Delete Collection"
        busy={busyKey === collectionPendingDeletion?.id}
        onCancel={() => setCollectionPendingDeletion(null)}
        onConfirm={() => {
          if (collectionPendingDeletion !== null) {
            void handleDelete(collectionPendingDeletion);
          }
        }}
      />

      <Dialog
        open={managedCollection !== null}
        title={`Games in ${managedCollection?.name ?? "Collection"}`}
        description="Select Library games, then drag the selected list into the order you want for this Collection."
        size="xlarge"
        dismissible={
          managedCollection === null ||
          busyKey !== `memberships-${managedCollection.id}`
        }
        onClose={() => setManagedCollection(null)}
      >
        {managedCollection === null ? null : (
          <CollectionGameEditor
            key={`${managedCollection.id}-${managedCollection.updatedAt}`}
            collection={managedCollection}
            libraryGames={libraryGames}
            onSave={saveGameList}
            onClose={() => setManagedCollection(null)}
          />
        )}
      </Dialog>

      {loadState === "loading" ? (
        <div className="empty-state" role="status">
          <h3>Loading Collections…</h3>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="empty-state">
          <h3>Collections could not be loaded.</h3>

          <p>
            {errorMessage ??
              "Check that the local API is running, then reload this page."}
          </p>
        </div>
      ) : null}

      {loadState === "ready" && collections.length === 0 ? (
        <div className="empty-state">
          <h3>No Collections yet.</h3>

          <p>
            Create a series, a short-term plan, or any other hand-picked group.
            Games remain in the main library.
          </p>

          <button
            className="button button--primary"
            type="button"
            onClick={openAddForm}
          >
            Create your first Collection
          </button>
        </div>
      ) : null}

      {loadState === "ready" && collections.length > 0 ? (
        <div className="collection-list">
          <SortableList
            items={collections}
            disabled={busyKey !== null}
            ariaLabel="Collection order"
            getItemLabel={(collection) => collection.name}
            onReorder={(reorderedCollections) => {
              void reorderCollections(reorderedCollections);
            }}
            renderItem={(collection, controls) => (
              <CollectionCard
                collection={collection}
                position={controls.position}
                dragHandle={controls.dragHandle}
                busy={busyKey !== null}
                managing={managedCollection?.id === collection.id}
                onManage={() => void openGameManager(collection)}
                onEdit={() => openEditForm(collection)}
                onDelete={() => setCollectionPendingDeletion(collection)}
              />
            )}
          />
        </div>
      ) : null}
    </section>
  );
}
