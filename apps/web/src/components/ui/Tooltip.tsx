import { cloneElement, useId, type ReactElement, type ReactNode } from "react";

type TooltipPlacement = "top" | "bottom";
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

export function Tooltip({
  content,
  children,
  placement = "bottom",
  alignment = "center",
}: TooltipProps) {
  const tooltipId = useId();
  const existingDescriptionId = children.props["aria-describedby"];

  const descriptionIds =
    existingDescriptionId === undefined
      ? tooltipId
      : `${existingDescriptionId} ${tooltipId}`;

  return (
    <span
      className={`tooltip tooltip--${placement} tooltip--align-${alignment}`}
    >
      {cloneElement(children, {
        "aria-describedby": descriptionIds,
      })}

      <span className="tooltip__content" id={tooltipId} role="tooltip">
        {content}
      </span>
    </span>
  );
}
