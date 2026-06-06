import { createServer } from "node:http";
import { URL, pathToFileURL } from "node:url";

const PORT = Number(process.env.PORT || 3000);
const CF_API_BASE = "https://codeforces.com/api";
const TARGET_HANDLE = "jiangly";
const DEFAULT_LIMIT = 10;
const DEFAULT_SCAN_LIMIT = 20000;
const MAX_SCAN_LIMIT = 50000;
const USER_STATUS_BATCH_SIZE = 1000;

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, html) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(html);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function parseProblemReference(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    throw new Error("Provide a Codeforces problem URL or a value like 1527/A.");
  }

  const urlMatch = raw.match(
    /^https?:\/\/codeforces\.com\/(?:(contest|gym)\/(\d+)\/problem\/([A-Z]\d*)|problemset\/problem\/(\d+)\/([A-Z]\d*))\/?$/i,
  );
  if (urlMatch) {
    const source = urlMatch[1] || "problemset";
    const contestId = Number(urlMatch[2] || urlMatch[4]);
    const index = (urlMatch[3] || urlMatch[5]).toUpperCase();
    return { raw, source, contestId, index };
  }

  const compactMatch = raw.match(/^(\d+)\s*[/ ]\s*([A-Z]\d*)$/i) || raw.match(/^(\d+)([A-Z]\d*)$/i);
  if (compactMatch) {
    return {
      raw,
      source: "contest",
      contestId: Number(compactMatch[1]),
      index: compactMatch[2].toUpperCase(),
    };
  }

  throw new Error("Unsupported problem format. Use a Codeforces URL or a value like 1527/A.");
}

async function cfApi(method, params) {
  const url = new URL(`${CF_API_BASE}/${method}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Codeforces API request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.status !== "OK") {
    throw new Error(payload.comment || "Codeforces API returned an error.");
  }

  return payload.result;
}

async function fetchAcceptedSubmissions(problemRef, scanLimit) {
  const accepted = [];

  for (let from = 1; from <= scanLimit; from += USER_STATUS_BATCH_SIZE) {
    const count = Math.min(USER_STATUS_BATCH_SIZE, scanLimit - from + 1);
    const batch = await cfApi("user.status", {
      handle: TARGET_HANDLE,
      from,
      count,
    });

    for (const submission of batch) {
      if (
        submission.verdict === "OK" &&
        submission.problem?.contestId === problemRef.contestId &&
        String(submission.problem?.index || "").toUpperCase() === problemRef.index
      ) {
        accepted.push(submission);
      }
    }

    if (batch.length < count) {
      break;
    }
  }

  return accepted;
}

async function fetchTargetUser() {
  const users = await cfApi("user.info", {
    handles: TARGET_HANDLE,
  });
  return users[0] || null;
}

function submissionUrl(problemRef, submissionId) {
  if (problemRef.source === "gym") {
    return `https://codeforces.com/gym/${problemRef.contestId}/submission/${submissionId}`;
  }

  return `https://codeforces.com/contest/${problemRef.contestId}/submission/${submissionId}`;
}

export async function buildRankedSolutions(problemInput, limit, scanLimit) {
  const problemRef = parseProblemReference(problemInput);
  const accepted = await fetchAcceptedSubmissions(problemRef, scanLimit);
  const user = await fetchTargetUser();

  const ranked = accepted
    .map((submission) => {
      return {
        submissionId: submission.id,
        url: submissionUrl(problemRef, submission.id),
        handle: TARGET_HANDLE,
        rating: user?.rating ?? null,
        maxRating: user?.maxRating ?? null,
        rank: user?.rank ?? null,
        maxRank: user?.maxRank ?? null,
        language: submission.programmingLanguage,
        participantType: submission.author.participantType,
        creationTimeSeconds: submission.creationTimeSeconds,
        timeConsumedMillis: submission.timeConsumedMillis,
        memoryConsumedBytes: submission.memoryConsumedBytes,
      };
    })
    .sort((left, right) => right.submissionId - left.submissionId)
    .slice(0, limit);

  const sample = accepted[0];

  return {
    problem: {
      contestId: problemRef.contestId,
      index: problemRef.index,
      name: sample?.problem?.name || null,
      source: problemRef.source,
    },
    handle: TARGET_HANDLE,
    stats: {
      scannedSubmissions: scanLimit,
      acceptedMatches: accepted.length,
      uniqueAuthors: accepted.length > 0 ? 1 : 0,
      returned: ranked.length,
    },
    limitation:
      "The official Codeforces API does not expose public source code. It only includes source with contest.status + includeSources when you are the contest manager using asManager=true.",
    solutions: ranked,
  };
}

function pageHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Codeforces Top Solutions</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6efe5;
        --panel: #fffaf4;
        --ink: #1f1a17;
        --muted: #6e6257;
        --line: #e2d5c7;
        --accent: #b14d28;
        --accent-2: #2e6f95;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(177, 77, 40, 0.16), transparent 28rem),
          linear-gradient(180deg, #fbf5ee 0%, var(--bg) 100%);
      }

      main {
        width: min(1100px, calc(100% - 2rem));
        margin: 2rem auto 4rem;
      }

      .hero,
      .panel {
        background: color-mix(in srgb, var(--panel) 92%, white);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(50, 32, 18, 0.08);
      }

      .hero {
        padding: 1.5rem;
        margin-bottom: 1rem;
      }

      h1 {
        font-size: clamp(2rem, 4vw, 3.5rem);
        line-height: 0.95;
        margin: 0 0 0.75rem;
        letter-spacing: -0.04em;
      }

      p,
      li,
      td,
      th,
      input,
      button {
        font-size: 1rem;
      }

      .muted {
        color: var(--muted);
      }

      .panel {
        padding: 1rem;
      }

      form {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 120px 140px 150px;
        gap: 0.75rem;
        align-items: end;
      }

      label {
        display: grid;
        gap: 0.35rem;
      }

      input {
        width: 100%;
        padding: 0.8rem 0.9rem;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: white;
        color: var(--ink);
      }

      button {
        padding: 0.85rem 1rem;
        border: 0;
        border-radius: 12px;
        background: var(--accent);
        color: white;
        cursor: pointer;
      }

      button:hover {
        filter: brightness(1.04);
      }

      .note {
        margin-top: 1rem;
        padding: 0.9rem 1rem;
        border-left: 4px solid var(--accent-2);
        background: rgba(46, 111, 149, 0.08);
        border-radius: 10px;
      }

      .status {
        margin-top: 1rem;
        min-height: 1.5rem;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
      }

      th,
      td {
        text-align: left;
        padding: 0.85rem 0.75rem;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }

      th {
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      a {
        color: var(--accent);
      }

      .stats {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 1rem;
      }

      .pill {
        padding: 0.45rem 0.7rem;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: white;
      }

      @media (max-width: 880px) {
        form {
          grid-template-columns: 1fr 1fr;
        }
      }

      @media (max-width: 640px) {
        main {
          width: min(100% - 1rem, 1100px);
          margin-top: 1rem;
        }

        .hero,
        .panel {
          border-radius: 16px;
        }

        form {
          grid-template-columns: 1fr;
        }

        .table-wrap {
          overflow-x: auto;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <h1>Find jiangly submissions without scraping the site.</h1>
        <p class="muted">Paste a problem URL or use a shorthand like <code>1527/A</code>. The app uses the official Codeforces API to show accepted submissions from <code>${escapeHtml(TARGET_HANDLE)}</code> only.</p>
      </section>

      <section class="panel">
        <form id="search-form">
          <label>
            Problem
            <input id="problem" name="problem" placeholder="https://codeforces.com/problemset/problem/1527/A or 1527/A" required>
          </label>
          <label>
            Show
            <input id="limit" name="limit" type="number" min="1" max="50" value="10">
          </label>
          <label>
            Check recent
            <input id="scan" name="scan" type="number" min="1000" max="50000" step="1000" value="20000">
          </label>
          <button type="submit">Find jiangly</button>
        </form>

        <div class="note">
          Public source code is not available from the official Codeforces API. This tool finds <code>${escapeHtml(TARGET_HANDLE)}</code>'s accepted submissions and gives you direct links to open in a browser where Cloudflare and your session are handled normally.
        </div>

        <div id="status" class="status muted"></div>
        <div id="summary"></div>
        <div id="results" class="table-wrap"></div>
      </section>
    </main>

    <script>
      const form = document.getElementById("search-form");
      const statusEl = document.getElementById("status");
      const summaryEl = document.getElementById("summary");
      const resultsEl = document.getElementById("results");

      function formatDate(seconds) {
        return new Date(seconds * 1000).toLocaleString();
      }

      function renderSummary(payload) {
        const problemName = payload.problem.name ? " - " + payload.problem.name : "";
        summaryEl.innerHTML = \`
          <h2>\${payload.problem.contestId}\${payload.problem.index}\${problemName}</h2>
          <div class="stats">
            <span class="pill">Handle: \${payload.handle}</span>
            <span class="pill">Accepted matches: \${payload.stats.acceptedMatches}</span>
            <span class="pill">Returned: \${payload.stats.returned}</span>
          </div>
        \`;
      }

      function renderTable(solutions) {
        if (solutions.length === 0) {
          resultsEl.innerHTML = "<p>No accepted submissions were found in the scanned range.</p>";
          return;
        }

        const rows = solutions.map((solution) => \`
          <tr>
            <td><strong>\${solution.handle}</strong><br><span class="muted">\${solution.rank || "unrated"} / max \${solution.maxRank || "n/a"}</span></td>
            <td>\${solution.rating ?? "n/a"}</td>
            <td>\${solution.maxRating ?? "n/a"}</td>
            <td>\${solution.language}</td>
            <td>\${solution.participantType}</td>
            <td>\${solution.timeConsumedMillis} ms<br><span class="muted">\${Math.round(solution.memoryConsumedBytes / 1024)} KB</span></td>
            <td>\${formatDate(solution.creationTimeSeconds)}</td>
            <td><a href="\${solution.url}" target="_blank" rel="noreferrer">Open submission</a></td>
          </tr>
        \`).join("");

        resultsEl.innerHTML = \`
          <table>
            <thead>
              <tr>
                <th>Author</th>
                <th>Rating</th>
                <th>Max</th>
                <th>Language</th>
                <th>Type</th>
                <th>Runtime</th>
                <th>Submitted</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>\${rows}</tbody>
          </table>
        \`;
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        statusEl.textContent = "Loading submissions from the Codeforces API...";
        summaryEl.innerHTML = "";
        resultsEl.innerHTML = "";

        const params = new URLSearchParams({
          problem: document.getElementById("problem").value,
          limit: document.getElementById("limit").value,
          scan: document.getElementById("scan").value,
        });

        try {
          const response = await fetch("/api/solutions?" + params.toString());
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload.error || "Request failed.");
          }

          renderSummary(payload);
          renderTable(payload.solutions);
          statusEl.textContent = payload.limitation;
        } catch (error) {
          statusEl.textContent = error.message;
        }
      });
    </script>
  </body>
</html>`;
}

export const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && requestUrl.pathname === "/") {
    sendHtml(res, pageHtml());
    return;
  }

  if (req.method === "GET" && requestUrl.pathname === "/api/solutions") {
    const problem = requestUrl.searchParams.get("problem");
    const limit = clampNumber(requestUrl.searchParams.get("limit"), DEFAULT_LIMIT, 1, 50);
    const scan = clampNumber(
      requestUrl.searchParams.get("scan"),
      DEFAULT_SCAN_LIMIT,
      1000,
      MAX_SCAN_LIMIT,
    );

    try {
      const payload = await buildRankedSolutions(problem, limit, scan);
      sendJson(res, 200, payload);
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found." });
});

const isEntryPoint =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isEntryPoint) {
  server.listen(PORT, () => {
    console.log(`Codeforces Top Solutions running at http://localhost:${PORT}`);
  });
}
