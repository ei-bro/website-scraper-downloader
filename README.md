# Website Scraper Downloader

[![CI](https://github.com/ei-bro/website-scraper-downloader/actions/workflows/ci.yml/badge.svg)](https://github.com/ei-bro/website-scraper-downloader/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node.js 18+](https://img.shields.io/badge/node.js-%3E%3D18-339933)

A **Node.js command-line tool** that crawls a website starting from a single URL, downloads linked assets, and writes them to disk while **preserving path structure** relative to the site. It is designed for **static or server-rendered pages**: it parses HTML and CSS for links and resources, does not execute JavaScript, and stays within **configurable domain and depth** rules.

**Use cases:** mirroring a small site for offline reading, archiving public documentation, or pulling static assets for local testing—**only where you have permission** and the site’s terms allow it.

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Command-line reference](#command-line-reference)
- [Examples](#examples)
- [Output and reports](#output-and-reports)
- [Behavior and defaults](#behavior-and-defaults)
- [Project layout](#project-layout)
- [Limitations and ethics](#limitations-and-ethics)
- [Development](#development)
- [Troubleshooting](#troubleshooting)
- [License](#license)
- [Contributing](#contributing)
- [Security](#security)
- [Support](#support)

---

## Features

- Recursively discovers and downloads **HTML, CSS, JavaScript, images, fonts, and common media** by parsing link and reference attributes in HTML and CSS.
- Writes files under a **target root** that mirrors URL paths; **deduplicates** URLs and tracks **per-session** progress.
- **Domain scoping:** by default, only the **same hostname** as the start URL; optional **`--include-subdomains`** also allows any host of the form `*.<start-hostname>` (see [Behavior and defaults](#behavior-and-defaults)).
- **Depth control:** optional **`--max-depth`** to cap how many link “hops” are followed from the start URL.
- **Resilient HTTP layer:** per-request **timeout**, **retries** with exponential backoff for transient network failures; failed assets are recorded without stopping the whole run.
- **Console summary** plus a **text report** file in the output directory.
- **Connectivity check** before the crawl using a lightweight request to the target URL.

## How it works

1. **Validate** the URL and verify the host is reachable.
2. **Seed** a queue with the start URL and mark it visited.
3. **Dequeue** URLs one at a time, **GET** each resource (as binary), map the URL to a local path, and **write** the file.
4. For **HTML** and **CSS** responses, **parse** embedded links (`href`, `src`, `url()`, etc.) and **enqueue** new URLs that pass domain, depth, and visit checks.
5. On completion, print statistics and write **`download-report.txt`**.

The crawler is **sequential** (one HTTP request active at a time), which keeps load predictable and reduces the chance of overwhelming a small server.

## Requirements

- **Node.js 18** or later (see `engines` in `package.json`)
- **npm** (or another client compatible with this repo’s `package-lock.json`)

## Installation

Clone the repository, install dependencies, and compile TypeScript:

```bash
git clone https://github.com/ei-bro/website-scraper-downloader.git
cd website-scraper-downloader
npm ci
npm run build
```

For day-to-day use from a clone, you can run `node dist/cli.js` or use `npm start` (see [Usage](#usage)). To invoke the `scraper` command globally, use `npm link` from the project root after building.

## Usage

The package exposes a CLI as **`scraper`** (see `package.json` `bin`). After `npm run build`:

```bash
node dist/cli.js <url> [options]
# or, from package scripts (rebuilds then runs):
npm start -- <url> [options]
```

Omitting arguments prints help and exits with a non-zero code.

## Command-line reference

| Option | Description |
|--------|-------------|
| `<url>` | **Target URL** (can be the first positional argument). |
| `-u`, `--url <url>` | Same as positional URL. |
| `-o`, `--output <dir>` | **Output root directory.** Default: `./downloads/<domain>` (domain derived from the start URL). |
| `-d`, `--max-depth <n>` | **Maximum depth** from the start URL (`0` = start page only). Default: **unlimited**. |
| `-s`, `--include-subdomains` | Also fetch hosts **one level below** the start URL’s hostname (see [Subdomain matching](#subdomain-matching) below). |
| `-h`, `--help` | Show help and exit. |

**Exit codes:** `0` if at least one file downloaded successfully; `1` on CLI/validation errors, unreachable URL, or when **every** download failed.

## Examples

| Goal | Command |
|------|---------|
| Default output `./downloads/<domain>/` | `npm start -- https://example.com` |
| Custom output folder | `npm start -- https://example.com -o ./site-mirror` |
| Limit crawl to two levels of links | `npm start -- https://example.com --max-depth 2` |
| Include cross-subdomain assets | `npm start -- https://www.example.com -s` |
| Direct binary (after build) | `node dist/cli.js https://example.com -o ./out -d 3` |

**npm note:** use `--` before the URL and flags so options are passed to the app, not to npm:

```bash
npm start -- https://example.com --output ./my-downloads
```

## Output and reports

### Directory layout

Files are stored under the chosen output root (default `./downloads/<domain>/`) with paths derived from the URL. A run also produces:

- **`download-report.txt`** — session summary and failure details (see below).

An illustrative layout:

```text
downloads/
└── example.com/
    ├── index.html
    ├── css/
    │   └── style.css
    ├── download-report.txt
    └── …
```

### `download-report.txt`

The report is plain text. It includes aggregate counts (discovered, successful, failed), **total size**, **duration**, and a **per-URL list of failures** with error messages and HTTP status when available. If all downloads succeed, a short success line is included instead of a failure list. The file ends with an ISO **generation timestamp**.

The CLI also prints a **concise summary** to the console (including up to 10 failed URLs, with a count if there are more).

## Behavior and defaults

These are fixed in the current release (not exposed as CLI flags):

| Area | Value |
|------|--------|
| Per-request **timeout** | 30 seconds |
| **Retries** for network-style failures (e.g. timeout, connection) | 3, with exponential backoff between attempts |
| **User-Agent** | Custom identifier `WebScraperDownloader/1.0` (see downloader source) |
| **Concurrency** | One request at a time |

`robots.txt` is **not** read; the tool does not run browser JavaScript. Treat these limits when deciding whether a site is suitable to mirror and whether you are allowed to do so.

### Subdomain matching

`--include-subdomains` allows a URL if its hostname is **equal** to the start URL’s hostname, or if it is **one DNS label** under that hostname: the candidate must satisfy `host === startHost` or `host.endsWith('.' + startHost)`.

Examples:

- Start at `https://example.com` → with `-s`, `https://www.example.com/…` and `https://cdn.example.com/…` are allowed.
- Start at `https://www.example.com` → with `-s`, `https://api.www.example.com/…` is allowed; `https://cdn.example.com/…` is **not** (different branch of the name).

If you need assets on a sibling host like `cdn.example.com` while the HTML is on `www.example.com`, prefer a **start URL** whose hostname is the **parent** (e.g. `example.com`) and enable `-s`, or mirror in two steps.

## Project layout

| Path | Role |
|------|------|
| `src/cli.ts` | Argument parsing, orchestration, exit codes |
| `src/crawl/scraper.ts` | Crawl loop, queue, integration with download and parse |
| `src/crawl/queue.ts` | FIFO queue and visited-URL set |
| `src/crawl/filter.ts` | Domain and depth rules |
| `src/fetch/downloader.ts` | HTTP GET (axios) with retries |
| `src/parse/parser.ts` | HTML / CSS link extraction |
| `src/fs/writer.ts` | Write buffers to mirrored paths |
| `src/progress/progress.ts` | Console progress lines |
| `src/report/report.ts` | Report text and file output |
| `src/url/validator.ts` | URL validation, reachability, domain extraction |

**Stack:** TypeScript, **axios**, **Jest** (and fast-check) for tests, **Biome** for lint/format.

## Limitations and ethics

- **No JavaScript execution** — content loaded or routed only in the browser after JS runs will not be discovered.
- **No login flows or authenticated sessions** — not a headless browser.
- **`robots.txt` is ignored**; respect site policy and **rate limits** yourself. Use **`--max-depth`** and run against servers you are permitted to use.
- **SPAs and heavy client routing** may mirror poorly; start from URLs that return real HTML for pages you need.

## Development

```bash
npm run build      # Compile TypeScript to dist/
npm test           # Unit and integration tests
npm run test:watch # Jest watch mode
npm run lint       # Biome check
npm run format     # Biome format (write)
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for pull requests and conventions.

## Troubleshooting

| Symptom | What to try |
|--------|-------------|
| `Unknown argument` or options ignored with `npm start` | Add `--` before the URL: `npm start -- https://…` |
| Build or `start` errors referring to `dist/` | Run `npm run build` first |
| Write errors | Ensure the output directory is writable |
| Timeouts on slow hosts | Expected behavior triggers retries; extremely slow sites may still fail per URL |
| Empty or partial mirror | Check depth, subdomain flag, and whether the site needs JS to reveal links |

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup, testing, and the pull request process.

## Security

To report a vulnerability, follow [SECURITY.md](SECURITY.md).

## Support

Bug reports and feature requests: [GitHub Issues](https://github.com/ei-bro/website-scraper-downloader/issues).
