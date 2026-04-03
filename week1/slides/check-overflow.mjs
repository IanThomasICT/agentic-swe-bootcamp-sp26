#!/usr/bin/env node
/**
 * Slide overflow detector — uses Playwright against the running Slidev dev server.
 *
 * Sets the viewport to 980×552 (the Slidev design canvas) so measurements are 1:1.
 * Reports slides where any <pre> block either:
 *   1. Extends below the 552px slide boundary (visual clip)
 *   2. Has scrollHeight > clientHeight (scrollbar present — bad in presentations)
 *
 * Usage:
 *   bun run check-overflow.mjs [--url http://localhost:3030] [--slides 22]
 *   bun run check-overflow.mjs --slide 7   # single slide
 */

import { chromium } from "playwright";

const args = process.argv.slice(2);
function getArg(flag, def) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : def;
}
const baseUrl    = getArg("--url",    "http://localhost:3030");
const totalSlides = parseInt(getArg("--slides", "22"));
const singleSlide = args.includes("--slide") ? parseInt(getArg("--slide", "1")) : null;

// Slidev design canvas: 980×552. Match it exactly — no scale transform applied.
const SLIDE_H = 552;

const browser = await chromium.launch({ headless: true });
const page    = await browser.newPage();
await page.setViewportSize({ width: 980, height: SLIDE_H });

const overflowSlides = [];
const start = singleSlide ?? 1;
const end   = singleSlide ?? totalSlides;

for (let i = start; i <= end; i++) {
  await page.goto(`${baseUrl}/${i}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400); // let Shiki finish

  const { title, issues } = await page.evaluate((SLIDE_H) => {
    const title = document.querySelector("h1")?.innerText?.trim() ?? "(untitled)";
    const issues = [];

    document.querySelectorAll("pre").forEach((el) => {
      if (!el.clientHeight) return; // hidden / zero-size

      const rect           = el.getBoundingClientRect();
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
  }, SLIDE_H);

  if (issues.length > 0) {
    // Slidev adds an extra page at URL /1 for the global frontmatter,
    // so the displayed slide number is URL − 1.
    overflowSlides.push({ slide: i - 1, url: i, title, issues });
  }
}

await browser.close();

if (overflowSlides.length === 0) {
  console.log("✓ No overflow detected on any slide.");
  process.exit(0);
} else {
  console.log(`⚠  Overflow on ${overflowSlides.length} slide(s):\n`);
  for (const { slide, url, title, issues } of overflowSlides) {
    console.log(`  Slide ${slide} (url /${url}): "${title}"`);
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
