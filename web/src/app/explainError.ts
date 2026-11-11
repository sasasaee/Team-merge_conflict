// Turns any JavaScript error into plain words: what happened, the likely cause, and how to fix it.
export type Explained = { title: string; cause: string; fix: string };

const RULES: { test: RegExp; explain: Explained }[] = [
  {
    test: /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|error loading dynamically/i,
    explain: {
      title: "This page could not be downloaded",
      cause: "The app was updated, or the connection dropped while the page's code was loading.",
      fix: "Reload the page. If you are running it locally, check that pnpm dev is still running in the terminal.",
    },
  },
  {
    test: /Failed to fetch|NetworkError|Load failed|ERR_INTERNET|network/i,
    explain: {
      title: "The connection failed",
      cause: "A file could not be downloaded because the server could not be reached.",
      fix: "Check your internet connection (or that pnpm dev is running), then reload.",
    },
  },
  {
    test: /localStorage|sessionStorage|SecurityError|QuotaExceeded/i,
    explain: {
      title: "The browser blocked saved settings",
      cause: "Site storage is turned off (private window or strict privacy settings), or it is full.",
      fix: "Leave private browsing or allow site data for this page, then reload.",
    },
  },
  {
    test: /Cannot read propert|undefined is not an object|is undefined|is not iterable|null is not an object/i,
    explain: {
      title: "Part of this page is missing data",
      cause: "The page expected a value that was not there, most often because a site file in web/public/data is incomplete.",
      fix: "Reload. If it happens again, re-run pipeline/run_all.bat to rebuild the site files, and send the details below to the team.",
    },
  },
  {
    test: /is not a function|is not a constructor/i,
    explain: {
      title: "A piece of code did not load correctly",
      cause: "Two parts of the app are out of step, usually right after an update or a half-finished install.",
      fix: "Reload. Locally: stop the server, run pnpm install, then pnpm dev.",
    },
  },
  {
    test: /Maximum call stack|too much recursion|Maximum update depth/i,
    explain: {
      title: "The page got stuck in a loop",
      cause: "A component kept updating itself without stopping.",
      fix: "Reload the page. If it happens again, send the details below to the team: this is a bug.",
    },
  },
];

export function explainError(error: unknown): Explained & { detail: string } {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const hit = RULES.find((r) => r.test.test(message));
  return {
    ...(hit?.explain ?? {
      title: "Something went wrong on this page",
      cause: "An unexpected error happened while drawing the page.",
      fix: "Reload the page. If it keeps happening, copy the details below and send them to the team.",
    }),
    detail: message,
  };
}