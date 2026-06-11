import type { Bucket, GameEntry } from "../../../domain/backlog";
import { BacklogRow } from "./BacklogRow";

interface BacklogListProps {
  games: GameEntry[];
  buckets: Bucket[];
}

export function BacklogList({ games, buckets }: BacklogListProps) {
  const sortedGames = [...games].sort((firstGame, secondGame) => firstGame.priorityOrder - secondGame.priorityOrder);

  return (
    <section className="backlog-list" aria-label="Backlog list">
      {sortedGames.map((game) => (
        <BacklogRow game={game} buckets={buckets} key={game.id} />
      ))}
    </section>
  );
}
