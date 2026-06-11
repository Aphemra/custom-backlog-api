const stats = [
  { label: "Games", value: "0" },
  { label: "Playing", value: "0" },
  { label: "Completed", value: "0" },
  { label: "Platinums", value: "0" },
];

export function BacklogStatsStrip() {
  return (
    <section className="stats-strip" aria-label="Backlog stats">
      {stats.map((stat) => (
        <article className="stat-card" key={stat.label}>
          <span className="stat-card__value">{stat.value}</span>
          <span className="stat-card__label">{stat.label}</span>
        </article>
      ))}
    </section>
  );
}
