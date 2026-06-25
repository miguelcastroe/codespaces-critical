# Codespaces Critical

## Scraping Cannes Lions winners from Love The Work

This repository includes a Playwright scraper that opens the Cannes Lions winners/shortlists view on Love The Work, detects the available categories, visits each category, handles incremental loading, and exports structured winner data.

### Prerequisites

This tool requires Node.js 22 or newer and npm. Node 22 is the documented baseline because Node 20 is deprecated on GitHub Actions runners. If your shell prints `zsh: command not found: npm` or `zsh: command not found: npx`, install Node.js first:

- macOS with Homebrew: `brew install node`
- macOS without Homebrew: install the current LTS package from <https://nodejs.org/>
- Ubuntu/Debian: `sudo apt-get update && sudo apt-get install -y nodejs npm`
- Windows: install the current LTS package from <https://nodejs.org/>

After installing Node.js, open a new terminal and verify the active runtime is Node 22+ and that both npm commands are available:

```bash
node --version
npm --version
npx --version
```

If you use `nvm`, you can select the repository default directly:

```bash
nvm install
nvm use
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

## Run on GitHub Actions

The workflow in `.github/workflows/main.yml` validates the scraper on pushes and pull requests. To run the live scraper on GitHub and download the outputs:

1. Push this branch to GitHub.
2. Open the repository on GitHub.
3. Go to **Actions**.
4. Select the **CI** workflow.
5. Click **Run workflow**.
6. Set `run_scraper` to `true`.
7. Click **Run workflow** again to start the run.
8. When the run finishes, open the completed workflow run and download the `love-the-work-winners` artifact. It contains `winners.json` and `winners.csv`.

The scraper job installs Playwright Chromium in the runner, runs headlessly, and uploads the generated output files as a workflow artifact.

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
