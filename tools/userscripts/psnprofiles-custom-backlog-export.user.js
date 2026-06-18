// ==UserScript==
// @name         Custom Backlog - PSNProfiles Export
// @namespace    https://github.com/Aphemra/custom-backlog-api
// @version      0.6.0
// @description  Export PSNProfiles profile trophy progress into compact Custom Backlog JSON.
// @match        https://psnprofiles.com/*
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
  "use strict";

  const EXPORT_SOURCE = "psnprofiles-userscript";
  const EXPORT_VERSION = 1;

  const SCROLL_DELAY_MS = 900;
  const STABLE_ROUND_LIMIT = 4;
  const MAX_SCROLL_ROUNDS = 80;

  function init() {
    const gamesTable = document.querySelector("#gamesTable");

    if (!gamesTable) {
      return;
    }

    injectCustomBacklogStyles();

    const button = createExportButton();

    const userNav = document.querySelector("#header .user-nav");
    const userMenu = document.querySelector("#header .user-menu");
    const header = document.querySelector("#header .header");

    if (userNav?.parentElement) {
      userNav.parentElement.insertBefore(button, userNav);
    } else if (userMenu) {
      userMenu.prepend(button);
    } else if (header) {
      header.appendChild(button);
    } else {
      document.body.prepend(button);
    }
  }

  function createExportButton() {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "custom-backlog-export-button";
    button.textContent = "Export Backlog";

    button.addEventListener("click", () => {
      void handleExportClick(button);
    });

    return button;
  }

  async function handleExportClick(button) {
    const originalText = button.textContent || "Export Backlog JSON";

    try {
      setButtonState(button, "Loading...", true);

      await loadAllRowsByScrolling((message) => {
        setButtonState(button, message, true);
      });

      setButtonState(button, "Parsing...", true);

      const payload = buildExportPayloadFromCurrentDom();
      const jsonText = JSON.stringify(payload, null, 2);

      await copyTextToClipboard(jsonText);
      downloadJsonFile(`psnprofiles-${payload.psnId}-custom-backlog-export.json`, jsonText);

      setButtonState(button, `${payload.games.length} Exported`, false);

      window.setTimeout(() => {
        setButtonState(button, originalText, false);
      }, 3500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown export error.";

      setButtonState(button, "Export failed", false);
      window.alert(`Custom Backlog export failed:\n\n${message}`);

      window.setTimeout(() => {
        setButtonState(button, originalText, false);
      }, 3500);
    }
  }

  async function loadAllRowsByScrolling(onStatus) {
    const expectedGameCount = getExpectedGameCount();
    let previousRowCount = getCurrentGameRowCount();
    let stableRounds = 0;

    for (let round = 1; round <= MAX_SCROLL_ROUNDS; round += 1) {
      const currentRowCount = getCurrentGameRowCount();

      if (expectedGameCount !== undefined) {
        onStatus(`${currentRowCount}/${expectedGameCount}...`);

        if (currentRowCount >= expectedGameCount) {
          return;
        }
      } else {
        onStatus(`Loading ${currentRowCount} rows...`);
      }

      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "instant",
      });

      await sleep(SCROLL_DELAY_MS);

      const nextRowCount = getCurrentGameRowCount();

      if (nextRowCount > previousRowCount) {
        previousRowCount = nextRowCount;
        stableRounds = 0;
        continue;
      }

      stableRounds += 1;

      if (stableRounds >= STABLE_ROUND_LIMIT) {
        return;
      }
    }

    throw new Error(
      `Stopped after ${MAX_SCROLL_ROUNDS} scroll rounds with ${getCurrentGameRowCount()} row(s) loaded. PSNProfiles may have changed its lazy-load behavior.`,
    );
  }

  function buildExportPayloadFromCurrentDom() {
    const profilePath = getProfilePath();
    const psnId = getPsnIdFromProfilePath(profilePath);
    const rows = Array.from(document.querySelectorAll("#gamesTable > tbody > tr"));

    const games = dedupeGames(rows.map(parseGameRow).filter((game) => game !== null));

    return {
      source: EXPORT_SOURCE,
      version: EXPORT_VERSION,
      psnId,
      profileUrl: new URL(profilePath, window.location.origin).toString(),
      exportedAt: new Date().toISOString(),
      games,
      warnings: games.length === 0 ? ["No PSNProfiles game rows were detected."] : [],
    };
  }

  function parseGameRow(row) {
    const titleLink = row.querySelector('a.title[href*="/trophies/"]');

    if (!titleLink) {
      return null;
    }

    const sourceTitle = cleanTitle(titleLink.textContent || "");

    if (!sourceTitle) {
      return null;
    }

    const sourceUrl = normalizeUrl(titleLink.getAttribute("href") || titleLink.href);
    const sourceTrophyListId = parseTrophyListIdFromUrl(sourceUrl);

    const smallInfoText = Array.from(row.querySelectorAll(".small-info"))
      .map((element) => normalizeWhitespace(element.textContent || ""))
      .join(" ");

    const trophyCount = parseTrophyCount(smallInfoText || row.textContent || "");

    if (!trophyCount) {
      return null;
    }

    const completionPercent = parseCompletionPercent(row, trophyCount);
    const platformData = parsePlatformData(row);

    return removeUndefinedFields({
      sourceTitle,
      sourceTrophyListId,
      sourceUrl,
      platformIds: platformData.platformIds,
      platformText: platformData.platformText,
      rawPlatformText: platformData.rawPlatformText,
      earnedTrophies: trophyCount.earnedTrophies,
      totalTrophies: trophyCount.totalTrophies,
      completionPercent,
    });
  }

  function parseTrophyCount(text) {
    const normalizedText = normalizeWhitespace(text);

    const completeMatch = normalizedText.match(/\bAll\s+(\d{1,4})\s+Trophies\b/i);

    if (completeMatch) {
      const totalTrophies = Number(completeMatch[1]);

      if (Number.isInteger(totalTrophies) && totalTrophies > 0) {
        return {
          earnedTrophies: totalTrophies,
          totalTrophies,
        };
      }
    }

    const trophyCountPatterns = [/(\d{1,4})\s*\/\s*(\d{1,4})/, /(\d{1,4})\s+of\s+(\d{1,4})\s+Trophies/i, /(\d{1,4})\s+of\s+(\d{1,4})/i];

    for (const pattern of trophyCountPatterns) {
      const match = normalizedText.match(pattern);

      if (!match) {
        continue;
      }

      const earnedTrophies = Number(match[1]);
      const totalTrophies = Number(match[2]);

      if (!Number.isInteger(earnedTrophies) || !Number.isInteger(totalTrophies)) {
        continue;
      }

      if (earnedTrophies < 0 || totalTrophies <= 0 || earnedTrophies > totalTrophies) {
        continue;
      }

      return {
        earnedTrophies,
        totalTrophies,
      };
    }

    return null;
  }

  function parseCompletionPercent(row, trophyCount) {
    const progressText = normalizeWhitespace(row.querySelector(".trophy-count .progress-bar span")?.textContent || "");

    const percentMatch = progressText.match(/(\d{1,3})\s*%/);

    if (percentMatch) {
      const parsedPercent = Number(percentMatch[1]);

      if (Number.isInteger(parsedPercent)) {
        return clampNumber(parsedPercent, 0, 100);
      }
    }

    return Math.round((trophyCount.earnedTrophies / trophyCount.totalTrophies) * 100);
  }

  function parsePlatformData(row) {
    const platformTags = Array.from(row.querySelectorAll(".platforms .tag.platform, .tag.platform"));

    const rawPlatformNames = platformTags
      .map((platformTag) => normalizeWhitespace(platformTag.textContent || ""))
      .filter((platformName) => platformName.length > 0);

    const platformIds = platformTags.map(mapPlatformTagToPlatformId).filter((platformId) => platformId !== undefined);

    const uniquePlatformIds = Array.from(new Set(platformIds));
    const uniqueRawPlatformNames = Array.from(new Set(rawPlatformNames));

    return {
      platformIds: uniquePlatformIds,
      platformText: uniquePlatformIds.map(formatPlatformId).join(" / ") || undefined,
      rawPlatformText: uniqueRawPlatformNames.join(" / ") || undefined,
    };
  }

  function mapPlatformTagToPlatformId(platformTag) {
    const classNames = Array.from(platformTag.classList).map((className) => className.toLowerCase());
    const text = normalizeWhitespace(platformTag.textContent || "").toLowerCase();

    if (classNames.includes("ps5") || text === "ps5") {
      return "ps5";
    }

    if (classNames.includes("ps4") || text === "ps4") {
      return "ps4";
    }

    if (classNames.includes("ps3") || text === "ps3") {
      return "ps3";
    }

    return undefined;
  }

  function formatPlatformId(platformId) {
    switch (platformId) {
      case "ps3":
        return "PS3";

      case "ps4":
        return "PS4";

      case "ps5":
        return "PS5";

      default:
        return platformId.toUpperCase();
    }
  }

  function dedupeGames(games) {
    const gamesByKey = new Map();

    for (const game of games) {
      const key =
        game.sourceTrophyListId || game.sourceUrl || `${normalizeTitle(game.sourceTitle)}|${game.platformText || "unknown"}|${game.totalTrophies}`;

      gamesByKey.set(key, game);
    }

    return Array.from(gamesByKey.values());
  }

  function getCurrentGameRowCount() {
    return document.querySelectorAll("#gamesTable > tbody > tr").length;
  }

  function getExpectedGameCount() {
    const metaDescription = document.querySelector('meta[name="Description"]')?.getAttribute("content") ?? "";
    const metaMatch = metaDescription.match(/(\d{1,5})\s+Games/i);

    if (metaMatch) {
      return Number(metaMatch[1].replace(/,/g, ""));
    }

    const statsText = normalizeWhitespace(document.querySelector(".stats")?.textContent ?? "");
    const statsMatch = statsText.match(/(\d{1,5})\s*Games Played/i);

    if (statsMatch) {
      return Number(statsMatch[1].replace(/,/g, ""));
    }

    return undefined;
  }

  function getProfilePath() {
    const firstPathSegment = window.location.pathname.split("/").filter(Boolean)[0];

    if (!firstPathSegment) {
      throw new Error("Could not determine the PSNProfiles username from the current URL.");
    }

    return `/${firstPathSegment}`;
  }

  function getPsnIdFromProfilePath(profilePath) {
    return decodeURIComponent(profilePath.replace(/^\/+/, ""));
  }

  function normalizeUrl(value) {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return undefined;
    }

    try {
      return new URL(trimmedValue, window.location.origin).toString();
    } catch {
      return undefined;
    }
  }

  function parseTrophyListIdFromUrl(value) {
    if (!value) {
      return undefined;
    }

    const match = value.match(/\/trophies\/([^/?#]+)/i);

    return match?.[1];
  }

  function cleanTitle(value) {
    return normalizeWhitespace(value)
      .replace(/\s+trophies$/i, "")
      .replace(/\s+trophy list$/i, "")
      .trim();
  }

  function normalizeWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
  }

  function normalizeTitle(title) {
    return title
      .trim()
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(Math.max(value, min), max);
  }

  function removeUndefinedFields(value) {
    return Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));
  }

  function setButtonState(button, text, disabled) {
    button.textContent = text;
    button.disabled = disabled;
    button.style.opacity = disabled ? "0.75" : "1";
    button.style.cursor = disabled ? "wait" : "pointer";
  }

  async function copyTextToClipboard(text) {
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text);
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    document.execCommand("copy");
    textArea.remove();
  }

  function downloadJsonFile(filename, jsonText) {
    const blob = new Blob([jsonText], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  function injectCustomBacklogStyles() {
    if (document.querySelector("#custom-backlog-export-styles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "custom-backlog-export-styles";
    style.textContent = `
    body {
      padding-top: 0 !important;
    }

    #banner {
        margin-top: -44px !important;
        padding-top: 44px !important;
    }

    #header {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      z-index: 99999 !important;
      background: #336291 !important;
      background-image: none !important;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45) !important;
    }

    #header::before {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      z-index: -1 !important;
      background: #336291 !important;
      pointer-events: none !important;
    }

    #header .header {
      background: #336291 !important;
      background-image: none !important;
    }

    #header .header-border {
      display: block !important;
      background: #336291 !important;
    }

    #banner,
    #slider,
    .banner,
    .banner-overlay {
      margin-top: 0 !important;
    }

    .custom-backlog-export-button {
      display: inline-block !important;
      vertical-align: middle !important;
      position: relative !important;
      top: 14px !important;
      height: 34px !important;
      min-width: 92px !important;
      max-width: 160px !important;
      margin: 0 14px 0 18px !important;
      padding: 0 14px !important;
      border: 1px solid rgba(255, 255, 255, 0.22) !important;
      border-radius: 4px !important;
      background: #1d3955 !important;
      color: #dbe3e6 !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      line-height: 24px !important;
      letter-spacing: 0.02em !important;
      text-transform: uppercase !important;
      text-align: center !important;
      white-space: nowrap !important;
      cursor: pointer !important;
      box-shadow: none !important;
    }

    .custom-backlog-export-button:hover:not(:disabled) {
      filter: brightness(1.08) !important;
    }

    .custom-backlog-export-button:disabled {
      opacity: 0.82 !important;
      cursor: wait !important;
    }
  `;

    document.head.appendChild(style);
  }

  init();
})();
