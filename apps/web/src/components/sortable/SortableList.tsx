import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS as DndCss } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";
import { IconButton } from "../ui/IconButton";
import { DragHandleIcon } from "../ui/icons";

interface SortableListItem {
  readonly id: string;
}

export interface SortableItemControls {
  readonly dragHandle: ReactNode;
  readonly position: number;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly moveUp: () => void;
  readonly moveDown: () => void;
}

interface SortableListProps<Item extends SortableListItem> {
  readonly items: readonly Item[];
  readonly disabled?: boolean;
  readonly ariaLabel: string;
  readonly getItemLabel: (item: Item) => string;
  readonly onReorder: (orderedItems: readonly Item[]) => void;
  readonly renderItem: (
    item: Item,
    controls: SortableItemControls,
  ) => ReactNode;
}

interface SortableEntryProps<Item extends SortableListItem> {
  readonly item: Item;
  readonly index: number;
  readonly itemCount: number;
  readonly disabled: boolean;
  readonly label: string;
  readonly onMove: (fromIndex: number, toIndex: number) => void;
  readonly renderItem: (
    item: Item,
    controls: SortableItemControls,
  ) => ReactNode;
}

function SortableEntry<Item extends SortableListItem>({
  item,
  index,
  itemCount,
  disabled,
  label,
  onMove,
  renderItem,
}: SortableEntryProps<Item>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled,
  });

  const style: CSSProperties = {
    transform: DndCss.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
  };

  const controls: SortableItemControls = {
    dragHandle: (
      <IconButton
        {...attributes}
        {...listeners}
        label={`Reorder ${label}`}
        tooltip="Drag to reorder, or use Space and arrow keys"
        tooltipAlignment="start"
        icon={<DragHandleIcon />}
        className="drag-handle"
        disabled={disabled}
      />
    ),
    position: index + 1,
    canMoveUp: !disabled && index > 0,
    canMoveDown: !disabled && index < itemCount - 1,
    moveUp: () => {
      if (!disabled && index > 0) {
        onMove(index, index - 1);
      }
    },
    moveDown: () => {
      if (!disabled && index < itemCount - 1) {
        onMove(index, index + 1);
      }
    },
  };

  return (
    <div
      ref={setNodeRef}
      className={`sortable-item${isDragging ? " sortable-item--dragging" : ""}`}
      style={style}
    >
      {renderItem(item, controls)}
    </div>
  );
}

export function SortableList<Item extends SortableListItem>({
  items,
  disabled = false,
  ariaLabel,
  getItemLabel,
  onReorder,
  renderItem,
}: SortableListProps<Item>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const labelsById = new Map(
    items.map((item) => [item.id, getItemLabel(item)]),
  );

  function reorder(fromIndex: number, toIndex: number) {
    if (
      disabled ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= items.length ||
      toIndex >= items.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    onReorder(arrayMove([...items], fromIndex, toIndex));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over === null || active.id === over.id) {
      return;
    }

    const fromIndex = items.findIndex((item) => item.id === active.id);
    const toIndex = items.findIndex((item) => item.id === over.id);

    reorder(fromIndex, toIndex);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            "To pick up an item, press Space or Enter. While dragging, use the arrow keys to move it. Press Space or Enter again to drop it, or press Escape to cancel.",
        },
        announcements: {
          onDragStart({ active }) {
            const label = labelsById.get(String(active.id)) ?? "Item";

            return `${label} picked up.`;
          },
          onDragOver({ active, over }) {
            if (over === null) {
              return undefined;
            }

            const label = labelsById.get(String(active.id)) ?? "Item";
            const overIndex = items.findIndex((item) => item.id === over.id);

            return `${label} moved to position ${overIndex + 1} of ${
              items.length
            }.`;
          },
          onDragEnd({ active, over }) {
            const label = labelsById.get(String(active.id)) ?? "Item";

            if (over === null) {
              return `${label} was not moved.`;
            }

            const overIndex = items.findIndex((item) => item.id === over.id);

            return `${label} dropped at position ${overIndex + 1} of ${
              items.length
            }.`;
          },
          onDragCancel({ active }) {
            const label = labelsById.get(String(active.id)) ?? "Item";

            return `Reordering ${label} was cancelled.`;
          },
        },
      }}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="sortable-list" aria-label={ariaLabel}>
          {items.map((item, index) => (
            <SortableEntry
              key={item.id}
              item={item}
              index={index}
              itemCount={items.length}
              disabled={disabled}
              label={getItemLabel(item)}
              onMove={reorder}
              renderItem={renderItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
