# Website Scraper Downloader

[![CI](https://github.com/ei-bro/website-scraper-downloader/actions/workflows/ci.yml/badge.svg)](https://github.com/ei-bro/website-scraper-downloader/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node.js 18+](https://img.shields.io/badge/node.js-%3E%3D18-339933)

A command-line web scraper that recursively downloads all accessible files from a target website while preserving the original server directory structure.

## Features

- 📥 Downloads all file types (HTML, CSS, JS, images, fonts, media)
- 📁 Preserves server folder structure locally
- 🔍 Automatic resource discovery through HTML/CSS parsing
- 🌐 Domain boundary respect (won't download the entire internet)
- 🔄 Retry logic with exponential backoff for failed downloads
- 📊 Progress reporting and download statistics
- 🛡️ Robust error handling
- ⚙️ Configurable depth limits and subdomain inclusion

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies (use `npm ci` for a clean install from the lockfile):

```bash
npm ci
```

3. Build the project:

```bash
npm run build
```

## Usage

### Basic Usage

Download a website to the default directory (`./downloads/<domain>`):

```bash
npm start -- https://example.com
```

This creates `./downloads/example.com/` with all downloaded files.

```bash
node dist/cli.js https://example.com
```

Or use the binary directly after building:

```bash
node dist/cli.js https://example.com
```

### Command-Line Options

```
Usage:
  scraper <url> [options]
  scraper --url <url> [options]

Options:
  -u, --url <url>              Target URL to scrape (required)
  -o, --output <dir>           Output directory (default: ./downloads/<domain>)
  -d, --max-depth <number>     Maximum link depth (default: unlimited)
  -s, --include-subdomains     Include subdomain resources
  -h, --help                   Show help message

Examples:
  scraper https://example.com
  scraper https://example.com --output ./downloads
  scraper https://example.com --max-depth 2 --include-subdomains
```

### Examples

#### 1. Download a website to default directory

```bash
npm start -- https://example.com
```

This creates `./downloads/example.com/` with all downloaded files.

#### 2. Specify custom output directory

```bash
npm start -- https://example.com --output ./my-downloads
```

#### 3. Limit crawl depth

```bash
npm start -- https://example.com --max-depth 2
```

This will only follow links up to 2 levels deep from the starting URL.

#### 4. Include subdomain resources

```bash
npm start -- https://example.com --include-subdomains
```

or shorthand:

```bash
npm start -- https://example.com -s
```

This will download resources from subdomains like `blog.example.com`, `cdn.example.com`, etc.

#### 5. Combine multiple options

```bash
npm start -- https://example.com --output ./downloads --max-depth 3 --include-subdomains
```

### Using the Binary Directly

After building, you can also run the scraper directly:

```bash
node dist/cli.js https://example.com
node dist/cli.js https://example.com -o ./downloads -d 2 -s
```

### Global Installation (Optional)

To use the scraper from anywhere on your system:

1. Link the package globally:

```bash
npm link
```

2. Now you can use it anywhere:

```bash
scraper https://example.com
scraper https://example.com --output ./downloads --max-depth 2
```

## Output Structure

The scraper preserves the original server directory structure inside `./downloads/<domain>/`:

```
downloads/
└── example.com/
    ├── index.html
    ├── css/
    │   ├── style.css
    │   └── theme.css
    ├── js/
    │   ├── main.js
    │   └── utils.js
    ├── images/
    │   ├── logo.png
    │   └── banner.jpg
    └── download-report.txt
```

## Download Report

After completion, a `download-report.txt` file is generated in the output directory containing:

- Total files downloaded
- Total size of downloaded files
- Number of successful downloads
- Number of failed downloads
- List of failed downloads with error reasons
- Total duration

Example report:

```
Website Scraper Download Report
================================

Target URL: https://example.com
Output Directory: /path/to/example.com
Start Time: 2026-03-30T10:30:00.000Z
End Time: 2026-03-30T10:32:15.000Z
Duration: 2m 15s

Summary:
--------
Total Files: 127
Successful Downloads: 125
Failed Downloads: 2
Total Size: 15.3 MB

Failed Downloads:
-----------------
1. https://example.com/old-image.png
   Error: 404 Not Found

2. https://example.com/restricted/admin.js
   Error: 403 Forbidden
```

## Development

### Run Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Lint and format (Biome)

```bash
npm run lint
npm run format
```

### Build Project

```bash
npm run build
```

## Supported File Types

The scraper automatically detects and downloads:

- **HTML**: `.html`, `.htm`
- **CSS**: `.css`
- **JavaScript**: `.js`, `.mjs`
- **Images**: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`
- **Fonts**: `.woff`, `.woff2`, `.ttf`, `.eot`, `.otf`
- **Media**: `.mp4`, `.webm`, `.ogg`, `.mp3`, `.wav`

## Error Handling

The scraper handles various error scenarios gracefully:

- **Network Errors**: Retries up to 3 times with exponential backoff
- **404 Not Found**: Logs error and continues
- **403 Forbidden**: Logs error and continues
- **500 Server Error**: Logs error and continues
- **Timeout**: Retries with backoff, then continues
- **Invalid URLs**: Skips and logs warning

Individual file failures won't stop the entire download process.

## Configuration

Default configuration values:

- **Max Retries**: 3
- **Timeout**: 30 seconds per request
- **Max Concurrent Downloads**: 5
- **User Agent**: Custom scraper user agent

## Limitations

- Does not execute JavaScript (downloads static files only)
- Does not handle authentication/login-protected content
- Does not respect robots.txt (use responsibly)
- May not work with heavily JavaScript-rendered sites (SPA frameworks)

## Best Practices

1. **Use responsibly**: Only scrape websites you have permission to scrape
2. **Respect rate limits**: The scraper includes built-in concurrency limits
3. **Check terms of service**: Ensure scraping is allowed by the website
4. **Use depth limits**: Prevent downloading too much content with `--max-depth`
5. **Test first**: Try with a small depth limit before full scrape

## Troubleshooting

### "Unknown argument" error

Make sure to use `--` to separate npm arguments from script arguments:

```bash
npm start -- https://example.com --output ./downloads
```

### "Missing script: start" error

Run `npm run build` first to compile TypeScript:

```bash
npm run build
npm start -- https://example.com
```

### Permission errors

Ensure you have write permissions for the output directory.

### Network timeouts

Some websites may have slow responses. The scraper will retry automatically.

## License

This project is licensed under the [MIT License](LICENSE).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, and the pull request process.

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## Support

For bugs and feature ideas, use [GitHub Issues](https://github.com/ei-bro/website-scraper-downloader/issues) after the repository is published. Replace the username in the URL as in the note at the top of this file.
