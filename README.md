# Codespaces Critical

## Scraping Cannes Lions winners from Love The Work

This repository includes a Playwright scraper that opens the Cannes Lions winners/shortlists view on Love The Work, detects the available categories, visits each category, handles incremental loading, and exports structured winner data.

### Prerequisites

This tool requires Node.js and npm. If your shell prints `zsh: command not found: npm` or `zsh: command not found: npx`, install Node.js first:

- macOS with Homebrew: `brew install node`
- macOS without Homebrew: install the current LTS package from <https://nodejs.org/>
- Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y nodejs npm`
- Windows: install the current LTS package from <https://nodejs.org/>

After installing Node.js, open a new terminal and verify both commands are available:

```bash
node --version
npm --version
npx --version
```

### Install

```bash
npm install
npx playwright install
```

### Run

```bash
node scrape-love-the-work.js
```

You can also use the npm script:

```bash
npm run scrape:love-the-work
```

By default the scraper writes `winners.json` and `winners.csv` in the repository root. Use environment variables to customize the run:

```bash
OUTPUT_JSON=tmp/winners.json OUTPUT_CSV=tmp/winners.csv HEADLESS=false node scrape-love-the-work.js
```

### Output fields

Each record contains:

- `category`
- `award`
- `title`
- `brand`
- `entrant`
- `country`
- `url`

### Notes

The page is dynamic, so the scraper uses visible text, ARIA roles, stable URL checks, load-more button detection, and scroll-based incremental loading rather than relying on brittle generated class names.
