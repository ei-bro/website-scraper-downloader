# Contributing

Thanks for your interest in improving this project. Here is how to work on it effectively.

## Development setup

- **Node.js** 18 or newer
- **npm** 9+ (or compatible)

```bash
git clone https://github.com/ei-bro/website-scraper-downloader.git
cd website-scraper-downloader
npm ci
npm run build
npm test
```

Replace `ei-bro` with your GitHub user or organization.

## Making changes

1. Create a branch from `main` for your work.
2. Add or update **tests** when you change behavior.
3. Run the quality checks before opening a pull request:

   ```bash
   npm run build
   npm test
   npm run lint
   ```

4. Keep changes focused: one feature or fix per pull request is easier to review.

## Code style

- TypeScript, strict mode as configured in `tsconfig.json`.
- ESLint rules in `.eslintrc.cjs` apply to `src/`.
- Match existing patterns for naming, file layout, and tests.

## Reporting issues

Use [GitHub Issues](https://github.com/ei-bro/website-scraper-downloader/issues) for bugs, feature ideas, and questions. For security issues, see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
