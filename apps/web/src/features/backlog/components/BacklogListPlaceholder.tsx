const placeholderRows = [
  {
    title: "Persona 3 Reload",
    platform: "PS5",
    progress: "100%",
    trophies: "49/49",
    bucket: "Persona",
  },
  {
    title: "Final Fantasy VII Remake",
    platform: "PS4 / PS5",
    progress: "72%",
    trophies: "44/54",
    bucket: "Final Fantasy",
  },
  {
    title: "Yakuza 0",
    platform: "PS4",
    progress: "0%",
    trophies: "0/55",
    bucket: "RGG",
  },
];

export function BacklogListPlaceholder() {
  return (
    <section className="backlog-list" aria-label="Backlog list">
      {placeholderRows.map((row, index) => (
        <article className="backlog-row" key={row.title}>
          <div className="backlog-row__priority">#{index + 1}</div>

          <div className="backlog-row__main">
            <div className="backlog-row__title-line">
              <h2>{row.title}</h2>
              <span className="platform-pill">{row.platform}</span>
            </div>

            <div className="backlog-row__meta">
              <span>{row.progress}</span>
              <span>{row.trophies} trophies</span>
              <span>{row.bucket}</span>
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
