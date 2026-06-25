#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const START_URL = 'https://www.lovethework.com/en/awards/winners-shortlists?tab=cannes-lions';
const OUTPUT_JSON = process.env.OUTPUT_JSON || 'winners.json';
const OUTPUT_CSV = process.env.OUTPUT_CSV || 'winners.csv';
const HEADLESS = process.env.HEADLESS !== 'false';
const AWARDS = ['Grand Prix', 'Gold', 'Silver', 'Bronze'];
const CATEGORY_BLACKLIST = new Set(['all', 'cannes lions', 'winners', 'shortlists']);

function csvEscape(value) {
  const text = String(value || '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function acceptCookies(page) {
  const buttons = [
    /accept all/i,
    /accept/i,
    /agree/i,
    /allow all/i,
    /aceptar/i,
  ];

  for (const name of buttons) {
    const button = page.getByRole('button', { name }).first();
    if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
      await button.click({ timeout: 5000 }).catch(() => undefined);
      return;
    }
  }
}

async function waitForDynamicContent(page) {
  await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await acceptCookies(page);
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
  await page.waitForFunction(
    () => document.body && document.body.innerText.length > 1000,
    undefined,
    { timeout: 45000 }
  );
}

async function discoverCategories(page) {
  const categories = await page.evaluate((blacklistValues) => {
    const blacklist = new Set(blacklistValues);
    const selectors = [
      'button',
      'a[href*="category"]',
      'a[href*="categories"]',
      '[role="tab"]',
      '[role="button"]',
      '[aria-controls]',
      '[data-category]',
      '[data-filter]',
    ];

    const found = new Map();
    for (const element of document.querySelectorAll(selectors.join(','))) {
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 3 || text.length > 90) continue;
      const key = text.toLowerCase();
      if (blacklist.has(key)) continue;
      if (/^(grand prix|gold|silver|bronze|search|menu|login|sign in|load more)$/i.test(text)) continue;
      if (/\d{4}/.test(text)) continue;

      const rect = element.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (!visible) continue;

      if (!found.has(key)) {
        found.set(key, {
          name: text,
          href: element.href || element.getAttribute('href') || null,
          role: element.getAttribute('role') || element.tagName.toLowerCase(),
        });
      }
    }
    return [...found.values()];
  }, [...CATEGORY_BLACKLIST]);

  if (categories.length === 0) {
    throw new Error('No categories were found. The page layout may have changed.');
  }

  return categories;
}

async function clickCategory(page, category) {
  const escaped = category.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const candidates = [
    page.getByRole('tab', { name: new RegExp(`^${escaped}$`, 'i') }).first(),
    page.getByRole('button', { name: new RegExp(`^${escaped}$`, 'i') }).first(),
    page.getByRole('link', { name: new RegExp(`^${escaped}$`, 'i') }).first(),
    page.getByText(new RegExp(`^${escaped}$`, 'i')).first(),
  ];

  for (const locator of candidates) {
    if (await locator.isVisible({ timeout: 3000 }).catch(() => false)) {
      await locator.scrollIntoViewIfNeeded();
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined),
        locator.click({ timeout: 10000 }),
      ]);
      await page.waitForTimeout(1000);
      return;
    }
  }

  if (category.href) {
    await page.goto(new URL(category.href, START_URL).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    return;
  }

  throw new Error(`Unable to click category: ${category.name}`);
}

async function loadAllResults(page) {
  let previousHeight = 0;
  let stablePasses = 0;

  for (let pass = 0; pass < 25 && stablePasses < 3; pass += 1) {
    const loadMore = page.getByRole('button', { name: /load more|show more|view more|more results|cargar más/i }).first();
    if (await loadMore.isVisible({ timeout: 1500 }).catch(() => false)) {
      await loadMore.scrollIntoViewIfNeeded();
      await loadMore.click({ timeout: 10000 }).catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    }

    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(1200);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);

    const nextHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    stablePasses = nextHeight === previousHeight || nextHeight === height ? stablePasses + 1 : 0;
    previousHeight = nextHeight;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
}

async function extractWinners(page, categoryName) {
  return page.evaluate(({ awards, categoryName }) => {
    const normalize = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const awardPattern = new RegExp(`\\b(${awards.map((award) => award.replace(/ /g, '\\s+')).join('|')})\\b`, 'i');
    const resultSelectors = [
      'article',
      'li',
      '[class*="card" i]',
      '[class*="work" i]',
      '[class*="winner" i]',
      '[data-testid*="card" i]',
      '[data-testid*="work" i]',
    ];
    const records = [];
    const seen = new Set();

    function fieldFromText(text, label) {
      const match = text.match(new RegExp(`${label}\\s*:?\\s*([^\\n|]+)`, 'i'));
      return normalize(match && match[1]);
    }

    function pickTitle(element, fullText, award) {
      const heading = element.querySelector('h1,h2,h3,h4,[role="heading"]');
      const headingText = normalize(heading && heading.textContent);
      if (headingText && !new RegExp(`^${award}$`, 'i').test(headingText)) return headingText;

      return normalize(
        fullText
          .split('\n')
          .map((line) => normalize(line))
          .filter(Boolean)
          .find((line) => !awardPattern.test(line) && !/^(brand|entrant|country)\b/i.test(line))
      );
    }

    for (const element of document.querySelectorAll(resultSelectors.join(','))) {
      const text = normalize(element.innerText || element.textContent);
      const awardMatch = text.match(awardPattern);
      if (!awardMatch) continue;

      const award = awards.find((candidate) => new RegExp(`^${candidate}$`, 'i').test(awardMatch[1].replace(/\s+/g, ' '))) || awardMatch[1];
      const link = element.querySelector('a[href]');
      const href = link ? new URL(link.getAttribute('href'), window.location.href).href : window.location.href;
      const title = pickTitle(element, element.innerText || element.textContent || '', award);
      const brand = fieldFromText(text, 'brand') || normalize(element.querySelector('[class*="brand" i]')?.textContent);
      const entrant = fieldFromText(text, 'entrant') || normalize(element.querySelector('[class*="entrant" i], [class*="agency" i]')?.textContent);
      const country = fieldFromText(text, 'country') || normalize(element.querySelector('[class*="country" i]')?.textContent);
      const key = `${categoryName}|${award}|${title}|${href}`;

      if (!title || seen.has(key)) continue;
      seen.add(key);
      records.push({ category: categoryName, award, title, brand, entrant, country, url: href });
    }

    return records;
  }, { awards: AWARDS, categoryName });
}

async function writeOutputs(records) {
  const jsonPath = path.resolve(OUTPUT_JSON);
  const csvPath = path.resolve(OUTPUT_CSV);
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.mkdir(path.dirname(csvPath), { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(records, null, 2)}\n`);

  const headers = ['category', 'award', 'title', 'brand', 'entrant', 'country', 'url'];
  const csv = [headers.join(','), ...records.map((record) => headers.map((header) => csvEscape(record[header])).join(','))].join('\n');
  await fs.writeFile(csvPath, `${csv}\n`);
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  page.setDefaultTimeout(15000);

  try {
    await waitForDynamicContent(page);
    const categories = await discoverCategories(page);
    const allRecords = [];

    console.log(`Found ${categories.length} candidate categories.`);
    for (const category of categories) {
      console.log(`Scraping category: ${category.name}`);
      await clickCategory(page, category);
      await loadAllResults(page);
      const records = await extractWinners(page, category.name);
      console.log(`  ${records.length} winners found.`);
      allRecords.push(...records);
    }

    await writeOutputs(allRecords);
    console.log(`Saved ${allRecords.length} records to ${OUTPUT_JSON} and ${OUTPUT_CSV}.`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
