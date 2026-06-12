import type { Bucket, GameEntry } from "../../../domain/backlog";
import { BacklogRow } from "./BacklogRow";

interface BacklogListProps {
  games: GameEntry[];
  buckets: Bucket[];
  selectedGameEntryId: string | null;
  onSelectGame: (gameEntryId: string) => void;
}

export function BacklogList({ games, buckets, selectedGameEntryId, onSelectGame }: BacklogListProps) {
  if (games.length === 0) {
    return (
      <section className="empty-state" aria-label="No backlog results">
        <h2>No games found</h2>
        <p>Try changing your search text, filters, or sort settings.</p>
      </section>
    );
  }

  return (
    <section className="backlog-list" aria-label="Backlog list">
      {games.map((game) => (
        <BacklogRow game={game} buckets={buckets} isOpen={game.id === selectedGameEntryId} onToggle={() => onSelectGame(game.id)} key={game.id} />
      ))}
    </section>
  );
}
