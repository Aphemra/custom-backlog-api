import assert from "node:assert/strict";
import { test } from "node:test";
import { openDatabase } from "../../database/database.js";
import { LibraryGameRepository } from "../library/libraryGameRepository.js";
import { createPortableDataExport } from "./portableDataService.js";
import { parsePortableDataV4 } from "./portableDataV4Validation.js";

test("validates Play Status, unobtainable state, and hidden state in v4", () => {
  const database = openDatabase(":memory:");

  try {
    const games = new LibraryGameRepository(database);

    const game = games.create({
      title: "Unobtainable Example",
      platform: "PS3",
      playStatus: "on_hold",
      isUnobtainable: true,
    });

    games.hide(game.id);

    const currentExport = createPortableDataExport(database);

    const portableData = {
      format: currentExport.format,
      formatVersion: 4 as const,
      exportedAt: currentExport.exportedAt,

      data: {
        libraryGames: currentExport.data.libraryGames,
        collections: currentExport.data.collections,
        savedViews: currentExport.data.savedViews,
        playstationGameLinks: currentExport.data.playstationGameLinks,
        externalGameMetadata: currentExport.data.externalGameMetadata,
        gameMetadataLinks: currentExport.data.gameMetadataLinks,
        trophySnapshots: currentExport.data.trophySnapshots,
        trophyAlerts: currentExport.data.trophyAlerts,
        cachedImages: currentExport.data.cachedImages,
        libraryGameImages: currentExport.data.libraryGameImages,
      },
    };

    const parsed = parsePortableDataV4(portableData);

    assert.equal(parsed.formatVersion, 4);

    assert.deepEqual(parsed.data.libraryGames, [
      {
        id: game.id,
        title: "Unobtainable Example",
        sortTitle: "unobtainable example",
        platform: "PS3",
        playStatus: "on_hold",
        isUnobtainable: true,
        priorityRank: game.priorityRank,
        notes: null,
        createdAt: game.createdAt,
        updatedAt: parsed.data.libraryGames[0]?.updatedAt,
        hiddenAt: parsed.data.libraryGames[0]?.hiddenAt,
      },
    ]);

    const invalid = {
      ...portableData,

      data: {
        ...portableData.data,

        libraryGames: portableData.data.libraryGames.map((game, index) =>
          index === 0
            ? {
                ...game,
                playStatus: "abandoned",
              }
            : game,
        ),
      },
    };

    assert.throws(
      () => parsePortableDataV4(invalid),
      /unsupported play status/,
    );
  } finally {
    database.close();
  }
});
