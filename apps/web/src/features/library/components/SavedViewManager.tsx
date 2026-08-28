import { SortableList } from "../../../components/sortable/SortableList";
import { IconButton } from "../../../components/ui/IconButton";
import { DeleteIcon, EditIcon } from "../../../components/ui/icons";
import type { SavedView } from "../../../domain/savedView";

interface SavedViewManagerProps {
  readonly views: readonly SavedView[];

  readonly selectedViewId: string | null;

  readonly busy: boolean;

  readonly embedded?: boolean;

  readonly onSelect: (viewId: string) => void;

  readonly onEdit: (view: SavedView) => void;

  readonly onDelete: (view: SavedView) => void;

  readonly onReorder: (orderedViews: readonly SavedView[]) => void;
}

export function SavedViewManager({
  views,
  selectedViewId,
  busy,
  embedded = false,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
}: SavedViewManagerProps) {
  return (
    <section
      id="saved-view-manager"
      className={`saved-view-manager${
        embedded ? " saved-view-manager--embedded" : ""
      }`}
      aria-label={embedded ? "Saved views" : undefined}
      aria-labelledby={embedded ? undefined : "saved-view-manager-title"}
    >
      {embedded ? null : (
        <div className="saved-view-manager__heading">
          <div>
            <p className="eyebrow">View order</p>

            <h3 id="saved-view-manager-title">Manage Saved Views</h3>

            <p>
              Drag views into the order you want them to appear in the Library
              selector.
            </p>
          </div>

          <span>
            {views.length} {views.length === 1 ? "view" : "views"}
          </span>
        </div>
      )}

      <SortableList
        items={views}
        disabled={busy}
        ariaLabel="Saved View order"
        getItemLabel={(view) => view.name}
        onReorder={onReorder}
        renderItem={(view, controls) => (
          <article
            className={`saved-view-manager__row${
              selectedViewId === view.id
                ? " saved-view-manager__row--selected"
                : ""
            }`}
          >
            <div
              className="saved-view-manager__order"
              aria-label={`${view.name}, position ${controls.position}`}
            >
              {controls.dragHandle}

              <span>{controls.position}</span>
            </div>

            <button
              className="saved-view-manager__selector"
              type="button"
              disabled={!view.isAvailable}
              aria-pressed={selectedViewId === view.id}
              onClick={() => onSelect(view.id)}
            >
              <strong>{view.name}</strong>

              <small>
                {view.isBuiltin ? "Built-in view" : "Custom view"}
                {view.isAvailable ? "" : " · Unavailable"}
              </small>
            </button>

            {view.isBuiltin ? (
              <span className="saved-view-manager__locked">Built-in</span>
            ) : (
              <div className="saved-view-manager__actions">
                <IconButton
                  label={`Edit ${view.name}`}
                  icon={<EditIcon />}
                  disabled={busy}
                  onClick={() => onEdit(view)}
                />

                <IconButton
                  label={`Delete ${view.name}`}
                  icon={<DeleteIcon />}
                  tone="danger"
                  disabled={busy}
                  onClick={() => onDelete(view)}
                />
              </div>
            )}
          </article>
        )}
      />
    </section>
  );
}
