import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("scan-to-claim story keeps the headline fixed beside the exact five-stage sequence", () => {
  const expected = [
    "Scan se claim tak—",
    "workflow-stage-panel",
    "Open Order,",
    "Packaging",
    "Secure",
    "Return &amp;",
    "Claim &amp;",
  ];

  let previous = -1;
  for (const marker of expected) {
    const current = page.indexOf(marker, previous + 1);
    assert.notEqual(current, -1, `missing workflow marker: ${marker}`);
    assert.ok(current > previous, `workflow marker is out of order: ${marker}`);
    previous = current;
  }

  const story = page.slice(
    page.indexOf('<section className="cinematic-proof"'),
    page.indexOf('<section className="vms-highlights"'),
  );
  assert.equal((story.match(/className="cinematic-step /g) ?? []).length, 5);
  assert.match(story, /workflow-fixed-panel/);
  assert.match(story, /cinematic-step scan-step/);
  assert.match(story, /workflowStageLabels\.map/);
  assert.match(story, /activeWorkflowStep === index/);
  assert.equal((story.match(/data-workflow-index="/g) ?? []).length, 5);
  assert.match(css, /\.workflow-proof-path span\.is-active\{/);
});

test("workflow uses structural scrolling so every stage remains visible without JavaScript", () => {
  assert.doesNotMatch(page, /data-scroll-scene/);
  assert.match(css, /\.cinematic-proof\{min-height:390vh/);
  assert.match(css, /\.cinematic-proof\{[^}]*overflow:visible/);
  assert.match(css, /\.marketing-page\{[^}]*overflow-x:clip;overflow-y:visible/);
  assert.doesNotMatch(css, /\.marketing-page\{[^}]*overflow:hidden/);
  assert.match(css, /grid-template-areas:"stages fixed"/);
  assert.match(css, /\.workflow-fixed-panel\{height:100vh;position:sticky/);
  assert.match(css, /\.workflow-fixed-panel\{[^}]*align-self:start;grid-area:fixed/);
  assert.match(css, /\.cinematic-step\{width:100%;min-height:78vh;position:relative/);
  assert.doesNotMatch(css, /\.cinematic-step\{[^}]*opacity:0/);
  assert.match(css, /content-visibility:auto/);
});

test("mobile workflow keeps the sticky headline above stages without visual overlap", () => {
  assert.match(
    css,
    /\.workflow-fixed-panel\{width:100%;height:224px;position:sticky;z-index:20;top:0;[^}]*background:#000/,
  );
  assert.match(css, /\.workflow-stage-panel\{width:100%;z-index:1;padding:0 20px\}/);
  assert.match(
    css,
    /\.cinematic-step\{min-height:calc\(100svh - 224px\);padding:30px 0 52px;/,
  );
  assert.doesNotMatch(css, /padding:37svh 0 4svh/);
  assert.doesNotMatch(css, /\.cinematic-proof\{min-height:410svh\}/);
});
