import { useState } from "react";
import type { Bucket, GameEntry } from "../../../domain/backlog";
import type { GameEntryUpdate } from "../store/useBacklogStore";
import { useBacklogStore } from "../store/useBacklogStore";
import { BacklogEntryEditForm } from "./BacklogEntryEditForm";
import { BacklogEntryReadOnly } from "./BacklogEntryReadOnly";

interface BacklogEntryDetailsProps {
  game: GameEntry;
  buckets: Bucket[];
}

export function BacklogEntryDetails({ game, buckets }: BacklogEntryDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);

  const updateGameEntry = useBacklogStore((state) => state.updateGameEntry);
  const deleteGameEntry = useBacklogStore((state) => state.deleteGameEntry);

  function handleSave(updates: GameEntryUpdate) {
    updateGameEntry(game.id, updates);
    setIsEditing(false);
  }

  function handleDelete() {
    const shouldDelete = window.confirm(`Delete "${game.title}" from your backlog? This cannot be undone yet.`);

    if (shouldDelete) {
      deleteGameEntry(game.id);
    }
  }

  if (isEditing) {
    return <BacklogEntryEditForm game={game} onCancel={() => setIsEditing(false)} onSave={handleSave} />;
  }

  return <BacklogEntryReadOnly game={game} buckets={buckets} onEdit={() => setIsEditing(true)} onDelete={handleDelete} />;
}
