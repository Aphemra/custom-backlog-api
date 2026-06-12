interface RatingDisplayProps {
  rating?: number;
}

export function RatingDisplay({ rating }: RatingDisplayProps) {
  if (rating === undefined) {
    return <span className="rating-display rating-display--empty">Unrated</span>;
  }

  return (
    <span className="rating-display">
      <strong>{rating}</strong>
      <span>/10</span>
    </span>
  );
}
