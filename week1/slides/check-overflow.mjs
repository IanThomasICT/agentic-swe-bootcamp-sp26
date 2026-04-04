#!/usr/bin/env node
/**
 * Slide overflow detector — uses Playwright against the running Slidev dev server.
 *
 * Sets the viewport to 980×552 (the Slidev design canvas) so measurements are 1:1.
 * Reports slides where any <pre> block either:
 *   1. Extends below the 552px slide boundary (visual clip)
 *   2. Has scrollHeight > clientHeight (scrollbar present — bad in presentations)
 *
 * Auto-detects total slide count from Slidev's internal state.
 *
 * Usage:
 *   bun run check-overflow.mjs [--url http://localhost:3030]
 *   bun run check-overflow.mjs --slide 7        # single slide
 *   bun run check-overflow.mjs --verbose         # print every slide title
 */

import { chromium } from "playwright";

const args = process.argv.slice(2);
function getArg(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : def;
}
const baseUrl     = getArg("--url", "http://localhost:3030");
const singleSlide = args.includes("--slide") ? parseInt(getArg("--slide", "1")) : null;
const verbose     = args.includes("--verbose");

// Slidev design canvas: 980×552. Match it exactly — no scale transform applied.
const SLIDE_H = 552;

const browser = await chromium.launch({ headless: true });
const page    = await browser.newPage();
await page.setViewportSize({ width: 980, height: SLIDE_H });

// Auto-detect total slides from Slidev's internal nav state.
await page.goto(`${baseUrl}/1`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const totalSlides = await page.evaluate(() => window.__slidev__?.nav?.total ?? 0);
if (totalSlides === 0) {
  console.error("Could not detect slide count from Slidev. Is the dev server running?");
  await browser.close();
  process.exit(1);
}
if (verbose) console.log(`Detected ${totalSlides} slides.\n`);

const overflowSlides = [];
const start = singleSlide ?? 1;
const end   = singleSlide ?? totalSlides;

for (let i = start; i <= end; i++) {
  await page.goto(`${baseUrl}/${i}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400); // let Shiki finish

  const { title, issues } = await page.evaluate(({ SLIDE_H, slideNo }) => {
    // Scope queries to the current slide's page element to avoid picking up
    // adjacent slides that Slidev keeps in the DOM for transitions.
    const scope = document.querySelector(`.slidev-page-${slideNo}`) ?? document;
    const title = scope.querySelector("h1")?.innerText?.trim() ?? "(untitled)";
    const issues = [];

    scope.querySelectorAll("pre").forEach((el) => {
      if (!el.clientHeight) return; // hidden / zero-size

      const rect              = el.getBoundingClientRect();
      const overflowsVisually = rect.bottom > SLIDE_H + 2;
      const hasScrollbar      = el.scrollHeight > el.clientHeight + 2;

      if (overflowsVisually || hasScrollbar) {
        const lines = (el.innerText ?? "").split("\n").length;
        issues.push({
          lines,
          overflowsVisually,
          hasScrollbar,
          excess:  overflowsVisually ? Math.round(rect.bottom - SLIDE_H) : 0,
          clientH: el.clientHeight,
          scrollH: el.scrollHeight,
          fontSize: window.getComputedStyle(el).fontSize,
        });
      }
    });

    return { title, issues };
  }, { SLIDE_H, slideNo: i });

  if (verbose) {
    const status = issues.length > 0 ? "⚠" : "✓";
    console.log(`  ${status} /${i}: "${title}"`);
  }

  if (issues.length > 0) {
    overflowSlides.push({ url: i, title, issues });
  }
}

await browser.close();

if (overflowSlides.length === 0) {
  console.log("✓ No overflow detected on any slide.");
  process.exit(0);
} else {
  console.log(`\n⚠  Overflow on ${overflowSlides.length} slide(s):\n`);
  for (const { url, title, issues } of overflowSlides) {
    console.log(`  /${url}: "${title}"`);
    for (const issue of issues) {
      const parts = [];
      if (issue.overflowsVisually) parts.push(`visually +${issue.excess}px below slide`);
      if (issue.hasScrollbar)      parts.push(`scrollbar (${issue.clientH}→${issue.scrollH}px)`);
      console.log(`    ${issue.lines} lines @ ${issue.fontSize} — ${parts.join(", ")}`);
    }
    console.log();
  }
  process.exit(1);
}
