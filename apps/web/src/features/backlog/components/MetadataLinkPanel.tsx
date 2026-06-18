import type { GameEntry } from "../../../domain/backlog";
import type { IgdbGameSearchResult } from "../../../services/api/igdbApi";
import { createIgdbMetadataSnapshot } from "../services/createIgdbMetadataSnapshot";
import { useBacklogStore } from "../store/useBacklogStore";
import { IgdbSearchPanel } from "./IgdbSearchPanel";

interface MetadataLinkPanelProps {
  game: GameEntry;
  onLinked?: () => void;
}

export function MetadataLinkPanel({ game, onLinked }: MetadataLinkPanelProps) {
  const gameEntries = useBacklogStore((state) => state.gameEntries);
  const updateGameEntry = useBacklogStore((state) => state.updateGameEntry);

  function handleSelectGame(igdbGame: IgdbGameSearchResult) {
    updateGameEntry(game.id, {
      externalMetadata: createIgdbMetadataSnapshot(igdbGame),
    });

    onLinked?.();
  }

  return (
    <div className="metadata-link-panel">
      <IgdbSearchPanel
        existingGameEntries={gameEntries}
        ignoredGameEntryId={game.id}
        initialQuery={game.title}
        selectButtonLabel={game.externalMetadata?.igdb ? "Replace Link" : "Link"}
        onSelectGame={handleSelectGame}
      />
    </div>
  );
}
