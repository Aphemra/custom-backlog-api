import type { BacklogStats } from "../services/calculateBacklogStats";

interface BacklogStatsStripProps {
  stats: BacklogStats;
}

export function BacklogStatsStrip({ stats }: BacklogStatsStripProps) {
  const statItems = [
    { label: "Games", value: stats.totalGames.toString() },
    { label: "Playing", value: stats.playingGames.toString() },
    { label: "Completed", value: stats.completedGames.toString() },
    { label: "Platinums", value: stats.platinumedGames.toString() },
  ];

  return (
    <section className="stats-strip" aria-label="Backlog stats">
      {statItems.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <span className="stat-card__value">{stat.value}</span>
          <span className="stat-card__label">{stat.label}</span>
        </article>
      ))}
    </section>
  );
}
