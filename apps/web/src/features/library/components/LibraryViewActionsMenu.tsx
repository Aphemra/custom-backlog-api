import { useRef } from "react";

interface LibraryViewActionsMenuProps {
  readonly viewAvailable: boolean;
  readonly viewsAvailable: boolean;
  readonly filtersExpanded: boolean;
  readonly viewManagerExpanded: boolean;
  readonly viewAdjusted: boolean;
  readonly mutationsBusy: boolean;
  readonly showCompletedAction: boolean;
  readonly completedOrderNeedsNormalization: boolean;
  readonly onToggleFilters: () => void;
  readonly onResetFilters: () => void;
  readonly onCreateView: () => void;
  readonly onToggleViewManager: () => void;
  readonly onSendCompletedToBottom: () => void;
}

export function LibraryViewActionsMenu({
  viewAvailable,
  viewsAvailable,
  filtersExpanded,
  viewManagerExpanded,
  viewAdjusted,
  mutationsBusy,
  showCompletedAction,
  completedOrderNeedsNormalization,
  onToggleFilters,
  onResetFilters,
  onCreateView,
  onToggleViewManager,
  onSendCompletedToBottom,
}: LibraryViewActionsMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  function runAction(action: () => void): void {
    menuRef.current?.removeAttribute("open");
    action();
  }

  return (
    <details className="library-view-menu" ref={menuRef}>
      <summary
        className="button button--quiet library-view-menu__trigger"
        aria-haspopup="menu"
      >
        View options
        {viewAdjusted ? (
          <span aria-label="View has temporary changes">•</span>
        ) : null}
      </summary>

      <div className="library-view-menu__popover" role="menu">
        <button
          type="button"
          role="menuitem"
          disabled={!viewAvailable}
          onClick={() => runAction(onToggleFilters)}
        >
          {filtersExpanded ? "Hide refinements" : "Refine current view"}
        </button>

        {viewAdjusted ? (
          <button
            type="button"
            role="menuitem"
            onClick={() => runAction(onResetFilters)}
          >
            Reset refinements
          </button>
        ) : null}

        <button
          type="button"
          role="menuitem"
          disabled={!viewAvailable || mutationsBusy}
          onClick={() => runAction(onCreateView)}
        >
          New Saved View
        </button>

        <button
          type="button"
          role="menuitem"
          disabled={!viewsAvailable}
          onClick={() => runAction(onToggleViewManager)}
        >
          {viewManagerExpanded ? "Hide Saved Views" : "Manage Saved Views"}
        </button>

        {showCompletedAction ? (
          <button
            type="button"
            role="menuitem"
            disabled={!completedOrderNeedsNormalization || mutationsBusy}
            onClick={() => runAction(onSendCompletedToBottom)}
          >
            {completedOrderNeedsNormalization
              ? "Send completed to bottom"
              : "Completed games are at bottom"}
          </button>
        ) : null}
      </div>
    </details>
  );
}
