import { useEffect, useMemo, useState } from "react";
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
  const [collections, setCollections] = useState<readonly CollectionSummary[]>(
    [],
  );

  const [libraryGames, setLibraryGames] = useState<readonly LibraryGame[]>([]);

  const [managedCollection, setManagedCollection] =
    useState<CollectionDetail | null>(null);

  const [editingCollection, setEditingCollection] =
    useState<CollectionSummary | null>(null);

  const [isAdding, setIsAdding] = useState(false);

  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

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

      visibleMemberships: collections.reduce(
        (total, collection) => total + collection.visibleGameCount,
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
    setNotice(null);
    setErrorMessage(null);

    try {
      await action();
      await refreshCollections();
      setNotice(successMessage);

      return true;
    } catch (error) {
      setErrorMessage(getErrorMessage(error));

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
    setErrorMessage(null);

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
      setErrorMessage(getErrorMessage(error));
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

    const updatedCollection = await collectionApi.replaceGames(
      managedCollection.id,
      orderedGameIds,
    );

    setManagedCollection(updatedCollection);
    await refreshCollections();

    setNotice(`The game list for ${updatedCollection.name} was saved.`);

    setErrorMessage(null);
  }

  async function moveCollection(
    collectionId: string,
    direction: -1 | 1,
  ): Promise<void> {
    const currentIndex = collections.findIndex(
      (collection) => collection.id === collectionId,
    );

    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= collections.length
    ) {
      return;
    }

    const reorderedCollections = [...collections];

    const [movedCollection] = reorderedCollections.splice(currentIndex, 1);

    if (movedCollection === undefined) {
      return;
    }

    reorderedCollections.splice(targetIndex, 0, movedCollection);

    await performMutation("order", "Collection order was updated.", () =>
      collectionApi.reorder(
        reorderedCollections.map((collection) => collection.id),
      ),
    );
  }

  async function handleDelete(collection: CollectionSummary): Promise<void> {
    const confirmed = window.confirm(
      `Delete the ${collection.name} Collection? Its games will remain in your library.`,
    );

    if (!confirmed) {
      return;
    }

    const succeeded = await performMutation(
      collection.id,
      `${collection.name} was deleted. Its games were not changed.`,
      () => collectionApi.deletePermanently(collection.id),
    );

    if (succeeded) {
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
    setErrorMessage(null);
  }

  function openEditForm(collection: CollectionSummary) {
    setEditingCollection(collection);
    setIsAdding(false);
    setManagedCollection(null);
    setErrorMessage(null);
  }

  function closeForm() {
    setIsAdding(false);
    setEditingCollection(null);
  }

  return (
    <section className="library-page" aria-labelledby="collections-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">Curated groups</p>

          <h2 id="collections-title">Collections</h2>

          <p className="library-heading__description">
            Organize one library into series, moods, goals, or any groups that
            are useful to you.
          </p>
        </div>

        <button
          className="button button--primary"
          type="button"
          onClick={openAddForm}
        >
          New collection
        </button>
      </div>

      <div className="stats-strip" aria-label="Collection summary">
        <div>
          <strong>{collections.length}</strong>
          <span>Collections</span>
        </div>

        <div>
          <strong>{summary.memberships}</strong>
          <span>Total memberships</span>
        </div>

        <div>
          <strong>{summary.visibleMemberships}</strong>
          <span>Visible memberships</span>
        </div>

        <div>
          <strong>{summary.hiddenMemberships}</strong>
          <span>Hidden memberships</span>
        </div>
      </div>

      {notice === null ? null : (
        <div className="notice notice--success" role="status">
          {notice}
        </div>
      )}

      {errorMessage === null ? null : (
        <div className="notice notice--error" role="alert">
          {errorMessage}
        </div>
      )}

      {isAdding || editingCollection !== null ? (
        <div className="editor-panel">
          <CollectionForm
            key={editingCollection?.id ?? "new-collection"}
            initialCollection={editingCollection ?? undefined}
            onSubmit={editingCollection === null ? handleCreate : handleUpdate}
            onCancel={closeForm}
          />
        </div>
      ) : null}

      {managedCollection === null ? null : (
        <CollectionGameEditor
          key={`${managedCollection.id}-${managedCollection.updatedAt}`}
          collection={managedCollection}
          libraryGames={libraryGames}
          onSave={saveGameList}
          onClose={() => setManagedCollection(null)}
        />
      )}

      {loadState === "loading" ? (
        <div className="empty-state" role="status">
          <h3>Loading Collections…</h3>
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="empty-state">
          <h3>Collections could not be loaded.</h3>

          <p>Check that the local API is running, then reload this page.</p>
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
        <div className="collection-list" aria-label="Collections">
          {collections.map((collection, index) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              position={index + 1}
              canMoveUp={index > 0}
              canMoveDown={index < collections.length - 1}
              busy={busyKey !== null}
              managing={managedCollection?.id === collection.id}
              onMoveUp={() => void moveCollection(collection.id, -1)}
              onMoveDown={() => void moveCollection(collection.id, 1)}
              onManage={() => void openGameManager(collection)}
              onEdit={() => openEditForm(collection)}
              onDelete={() => void handleDelete(collection)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
