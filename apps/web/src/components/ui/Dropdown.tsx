import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

export interface DropdownItem {
  readonly id: string;
  readonly label: ReactNode;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

interface DropdownProps {
  readonly label: ReactNode;
  readonly accessibleLabel: string;
  readonly items: readonly DropdownItem[];
  readonly mode?: "menu" | "listbox";
  readonly disabled?: boolean;
  readonly className?: string;
}

export function Dropdown({
  label,
  accessibleLabel,
  items,
  mode = "menu",
  disabled = false,
  className,
}: DropdownProps) {
  const popoverId = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);

  const classes = ["dropdown", open ? "dropdown--open" : null, className]
    .filter((value): value is string => value !== null && value !== undefined)
    .join(" ");

  function enabledItems(): HTMLButtonElement[] {
    const popover = popoverRef.current;

    if (popover === null) {
      return [];
    }

    return Array.from(
      popover.querySelectorAll<HTMLButtonElement>(
        "[data-dropdown-item]:not(:disabled)",
      ),
    );
  }

  function focusItem(position: "first" | "last"): void {
    window.requestAnimationFrame(() => {
      const availableItems = enabledItems();

      if (availableItems.length === 0) {
        return;
      }

      const item =
        position === "first"
          ? availableItems[0]
          : availableItems[availableItems.length - 1];

      item?.focus();
    });
  }

  function openAndFocus(position: "first" | "last"): void {
    if (disabled) {
      return;
    }

    setOpen(true);
    focusItem(position);
  }

  function closeAndFocusTrigger(): void {
    setOpen(false);

    window.requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }

  function handleTriggerKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openAndFocus("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openAndFocus("last");
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      closeAndFocusTrigger();
    }
  }

  function handleItemKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void {
    const availableItems = enabledItems();
    const currentIndex = availableItems.indexOf(event.currentTarget);

    if (event.key === "Escape") {
      event.preventDefault();
      closeAndFocusTrigger();
      return;
    }

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      availableItems[0]?.focus();
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      availableItems[availableItems.length - 1]?.focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }

    event.preventDefault();

    const direction = event.key === "ArrowDown" ? 1 : -1;

    const nextIndex =
      (currentIndex + direction + availableItems.length) %
      availableItems.length;

    availableItems[nextIndex]?.focus();
  }

  function selectItem(item: DropdownItem): void {
    if (item.disabled) {
      return;
    }

    setOpen(false);
    item.onSelect();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleOutsidePointer(event: PointerEvent): void {
      const root = rootRef.current;

      if (
        root !== null &&
        event.target instanceof Node &&
        !root.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeAndFocusTrigger();
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className={classes} ref={rootRef}>
      <button
        className="dropdown__trigger"
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-label={accessibleLabel}
        aria-haspopup={mode}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="dropdown__trigger-label">{label}</span>

        <span className="dropdown__arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      <div
        className="dropdown__popover"
        id={popoverId}
        ref={popoverRef}
        role={mode}
        aria-label={accessibleLabel}
        aria-hidden={!open}
      >
        {items.map((item) => (
          <button
            className={`dropdown__item${
              item.selected ? " dropdown__item--selected" : ""
            }`}
            key={item.id}
            type="button"
            role={mode === "listbox" ? "option" : "menuitem"}
            tabIndex={open ? 0 : -1}
            disabled={item.disabled}
            aria-selected={
              mode === "listbox" ? item.selected === true : undefined
            }
            data-dropdown-item
            onClick={() => selectItem(item)}
            onKeyDown={handleItemKeyDown}
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
