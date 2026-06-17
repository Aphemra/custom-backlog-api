import type { PotentialDuplicateGameEntry } from "../services/findPotentialDuplicateGameEntries";

interface DuplicateWarningProps {
  duplicates: PotentialDuplicateGameEntry[];
}

export function DuplicateWarning({ duplicates }: DuplicateWarningProps) {
  if (duplicates.length === 0) {
    return null;
  }

  return (
    <section className="duplicate-warning" aria-label="Potential duplicate games">
      <div>
        <h3>Potential Duplicate</h3>
        <p>
          This game looks similar to something already in your backlog. You can still save it if this is a separate version, stack, or re-release.
        </p>
      </div>

      <ul>
        {duplicates.map((duplicate) => (
          <li key={duplicate.gameEntry.id}>
            <strong>{duplicate.gameEntry.title}</strong>
            <span>{duplicate.reasons.join(" • ")}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
