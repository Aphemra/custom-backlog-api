import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

type TooltipPlacement = "top" | "bottom" | "inside-top";
type TooltipAlignment = "start" | "center" | "end";

interface TooltipTriggerProps {
  readonly "aria-describedby"?: string;
}

interface TooltipProps {
  readonly content: ReactNode;
  readonly children: ReactElement<TooltipTriggerProps>;
  readonly placement?: TooltipPlacement;
  readonly alignment?: TooltipAlignment;
}

const TOOLTIP_GAP = 8;
const VIEWPORT_MARGIN = 8;
const TOOLTIP_CLOSE_DURATION = 140;

export function Tooltip({
  content,
  children,
  placement = "bottom",
  alignment = "center",
}: TooltipProps) {
  const tooltipId = useId();

  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const openFrameRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const existingDescriptionId = children.props["aria-describedby"];

  const descriptionIds =
    existingDescriptionId === undefined
      ? tooltipId
      : `${existingDescriptionId} ${tooltipId}`;

  const positionTooltip = useCallback((): void => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;

    if (trigger === null || tooltip === null) {
      return;
    }

    const triggerBounds = trigger.getBoundingClientRect();
    const tooltipBounds = tooltip.getBoundingClientRect();

    let resolvedPlacement = placement;

    if (
      placement === "top" &&
      triggerBounds.top - tooltipBounds.height - TOOLTIP_GAP < VIEWPORT_MARGIN
    ) {
      resolvedPlacement = "bottom";
    } else if (
      placement === "bottom" &&
      triggerBounds.bottom + TOOLTIP_GAP + tooltipBounds.height >
        window.innerHeight - VIEWPORT_MARGIN
    ) {
      resolvedPlacement = "top";
    }

    let top: number;

    if (resolvedPlacement === "inside-top") {
      top = triggerBounds.top + TOOLTIP_GAP;
    } else if (resolvedPlacement === "top") {
      top = triggerBounds.top - tooltipBounds.height - TOOLTIP_GAP;
    } else {
      top = triggerBounds.bottom + TOOLTIP_GAP;
    }

    let left: number;

    if (alignment === "start") {
      left = triggerBounds.left;
    } else if (alignment === "end") {
      left = triggerBounds.right - tooltipBounds.width;
    } else {
      left =
        triggerBounds.left + (triggerBounds.width - tooltipBounds.width) / 2;
    }

    const maximumLeft = Math.max(
      VIEWPORT_MARGIN,
      window.innerWidth - tooltipBounds.width - VIEWPORT_MARGIN,
    );

    const maximumTop = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - tooltipBounds.height - VIEWPORT_MARGIN,
    );

    left = Math.min(Math.max(VIEWPORT_MARGIN, left), maximumLeft);
    top = Math.min(Math.max(VIEWPORT_MARGIN, top), maximumTop);

    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.dataset.placement = resolvedPlacement;
  }, [alignment, placement]);

  function clearScheduledClose(): void {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function clearScheduledOpen(): void {
    if (openFrameRef.current !== null) {
      window.cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }
  }

  function showTooltip(): void {
    const tooltip = tooltipRef.current;

    if (tooltip === null) {
      return;
    }

    clearScheduledClose();
    clearScheduledOpen();

    if (!tooltip.matches(":popover-open")) {
      tooltip.showPopover();
    }

    tooltip.dataset.visible = "false";
    positionTooltip();

    openFrameRef.current = window.requestAnimationFrame(() => {
      positionTooltip();
      tooltip.dataset.visible = "true";
      openFrameRef.current = null;
    });
  }

  function hideTooltip(immediately = false): void {
    const tooltip = tooltipRef.current;

    if (tooltip === null) {
      return;
    }

    clearScheduledOpen();
    clearScheduledClose();

    tooltip.dataset.visible = "false";

    if (immediately) {
      if (tooltip.matches(":popover-open")) {
        tooltip.hidePopover();
      }

      return;
    }

    closeTimerRef.current = window.setTimeout(() => {
      if (tooltip.matches(":popover-open")) {
        tooltip.hidePopover();
      }

      closeTimerRef.current = null;
    }, TOOLTIP_CLOSE_DURATION);
  }

  useEffect(() => {
    const tooltip = tooltipRef.current;

    function updateOpenTooltip(): void {
      if (tooltip?.matches(":popover-open")) {
        positionTooltip();
      }
    }

    window.addEventListener("resize", updateOpenTooltip);
    window.addEventListener("scroll", updateOpenTooltip, true);

    return () => {
      window.removeEventListener("resize", updateOpenTooltip);
      window.removeEventListener("scroll", updateOpenTooltip, true);

      clearScheduledOpen();
      clearScheduledClose();

      if (tooltip?.matches(":popover-open")) {
        tooltip.hidePopover();
      }
    };
  }, [positionTooltip]);

  return (
    <span
      className="tooltip"
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={() => hideTooltip()}
      onFocusCapture={showTooltip}
      onBlurCapture={() => hideTooltip()}
      onPointerDown={() => hideTooltip(true)}
    >
      {cloneElement(children, {
        "aria-describedby": descriptionIds,
      })}

      <span
        className="tooltip__content"
        id={tooltipId}
        ref={tooltipRef}
        role="tooltip"
        popover="manual"
        data-visible="false"
        data-placement={placement}
      >
        {content}
      </span>
    </span>
  );
}
