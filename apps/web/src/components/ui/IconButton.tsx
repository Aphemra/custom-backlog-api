import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "./Tooltip";

type IconButtonTone = "neutral" | "danger";
type TooltipPlacement = "top" | "bottom";
type TooltipAlignment = "start" | "center" | "end";

interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "aria-label"
> {
  readonly label: string;
  readonly icon: ReactNode;
  readonly tone?: IconButtonTone;
  readonly tooltip?: string;
  readonly tooltipPlacement?: TooltipPlacement;
  readonly tooltipAlignment?: TooltipAlignment;
}

export function IconButton({
  label,
  icon,
  tone = "neutral",
  tooltip = label,
  tooltipPlacement = "bottom",
  tooltipAlignment = "end",
  className,
  type,
  ...buttonProps
}: IconButtonProps) {
  const classes = ["icon-button", `icon-button--${tone}`, className]
    .filter((value): value is string => value !== undefined)
    .join(" ");

  return (
    <Tooltip
      content={tooltip}
      placement={tooltipPlacement}
      alignment={tooltipAlignment}
    >
      <button
        {...buttonProps}
        className={classes}
        type={type ?? "button"}
        aria-label={label}
      >
        {icon}
      </button>
    </Tooltip>
  );
}
