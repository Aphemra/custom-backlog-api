import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type SyntheticEvent,
} from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";
import { CloseIcon } from "./icons";

export interface LightboxImage {
  readonly src: string;
  readonly alt: string;
}

interface ImageLightboxProps {
  readonly images: readonly LightboxImage[];
  readonly initialIndex: number | null;
  readonly onClose: () => void;
}

function PreviousIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m15 5-7 7 7 7" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function OpenImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  readonly images: readonly LightboxImage[];
  readonly initialIndex: number;
  readonly onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(0, initialIndex), images.length - 1),
  );

  const currentImage = images[currentIndex]!;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocusedElement = document.activeElement;

    if (dialog === null) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    dialog.querySelector<HTMLElement>(".image-lightbox__panel")?.focus();

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "ArrowLeft") {
        event.preventDefault();

        setCurrentIndex((index) =>
          index === 0 ? images.length - 1 : index - 1,
        );
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();

        setCurrentIndex((index) =>
          index === images.length - 1 ? 0 : index + 1,
        );
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }

      if (dialog.open) {
        dialog.close();
      }

      if (
        previouslyFocusedElement instanceof HTMLElement &&
        previouslyFocusedElement.isConnected
      ) {
        previouslyFocusedElement.focus();
      }
    };
  }, [images.length]);

  function requestClose(): void {
    if (closing) {
      return;
    }

    setClosing(true);

    const closeDelay = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 140;

    closeTimerRef.current = window.setTimeout(onClose, closeDelay);
  }

  function showPrevious(): void {
    setCurrentIndex((index) => (index === 0 ? images.length - 1 : index - 1));
  }

  function showNext(): void {
    setCurrentIndex((index) => (index === images.length - 1 ? 0 : index + 1));
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    requestClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className={`image-lightbox${closing ? " image-lightbox--closing" : ""}`}
      aria-label={`Screenshot ${currentIndex + 1} of ${images.length}`}
      aria-modal="true"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="image-lightbox__panel" tabIndex={-1}>
        <div className="image-lightbox__actions">
          <IconButton
            label="Close enlarged screenshot"
            icon={<CloseIcon />}
            tooltipPlacement="bottom"
            tooltipAlignment="end"
            onClick={requestClose}
          />
        </div>

        {images.length > 1 ? (
          <IconButton
            className="image-lightbox__navigation image-lightbox__navigation--previous"
            label="Previous screenshot"
            icon={<PreviousIcon />}
            tooltipPlacement="top"
            tooltipAlignment="center"
            onClick={showPrevious}
          />
        ) : (
          <span />
        )}

        <div className="image-lightbox__image-frame" aria-live="polite">
          <img
            key={currentImage.src}
            src={currentImage.src}
            alt={currentImage.alt}
          />
        </div>

        {images.length > 1 ? (
          <IconButton
            className="image-lightbox__navigation image-lightbox__navigation--next"
            label="Next screenshot"
            icon={<NextIcon />}
            tooltipPlacement="top"
            tooltipAlignment="center"
            onClick={showNext}
          />
        ) : (
          <span />
        )}

        <nav
          className="image-lightbox__pagination"
          aria-label="Choose screenshot"
        >
          {images.map((image, index) => (
            <button
              key={image.src}
              className={`image-lightbox__dot${
                index === currentIndex ? " image-lightbox__dot--active" : ""
              }`}
              type="button"
              aria-label={`Show screenshot ${index + 1} of ${images.length}`}
              aria-current={index === currentIndex ? "true" : undefined}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </nav>
      </div>
    </dialog>,
    document.body,
  );
}

export function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: ImageLightboxProps) {
  if (initialIndex === null || images.length === 0) {
    return null;
  }

  return (
    <OpenImageLightbox
      key={`${initialIndex}:${images.length}`}
      images={images}
      initialIndex={initialIndex}
      onClose={onClose}
    />
  );
}
