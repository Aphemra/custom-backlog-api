import type { Bucket, GameEntry } from "../../../domain/backlog";
import { BacklogRow } from "./BacklogRow";

interface BacklogListProps {
  games: GameEntry[];
  buckets: Bucket[];
  selectedGameEntryId: string | null;
  onSelectGame: (gameEntryId: string) => void;
}

export function BacklogList({ games, buckets, selectedGameEntryId, onSelectGame }: BacklogListProps) {
  const sortedGames = [...games].sort((firstGame, secondGame) => firstGame.priorityOrder - secondGame.priorityOrder);

  return (
    <section className="backlog-list" aria-label="Backlog list">
      {sortedGames.map((game) => (
        <BacklogRow game={game} buckets={buckets} isOpen={game.id === selectedGameEntryId} onToggle={() => onSelectGame(game.id)} key={game.id} />
      ))}
    </section>
  );
}
