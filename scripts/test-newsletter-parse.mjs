import assert from "node:assert/strict";
import fs from "node:fs";
import { getAmazonNewsletterNames, getNewsletterRows, markNewsletterRows } from "../lib/newsletterParse.js";

const table = `<h2>AMAZON BEST SELLERS</h2><table>
  <tr><th>Rank</th><th>Product</th><th>Sales</th></tr>
  <tr><td>1</td><td>Cards Against Humanity — Game</td><td>#1 Toys</td></tr>
  <tr><td><strong>2.</strong> AirPods &amp; Case</td><td>2M+ searches</td></tr>
  <tr><td>+35%</td><td>3. Kindle Paperwhite</td></tr></table>`;
const cards = `<div><h2><span>🛒 AMAZON BEST SELLERS — TOP 15</span></h2>
  <div style="display:flex"><span><strong>1.</strong> Cards Against Humanity</span><span>#1 Toys</span></div>
  <div style="display:flex"><span><strong>2.</strong> AirPods &amp; Case</span><span>2M+ searches</span></div>
  <div><span>3. Kindle Paperwhite</span><span>+35%</span></div></div>`;
const expected = ["Cards Against Humanity", "AirPods & Case", "Kindle Paperwhite"];
assert.deepEqual(getAmazonNewsletterNames(table), expected, "existing table formats");
assert.deepEqual(getAmazonNewsletterNames(cards), expected, "November card format");
assert.deepEqual(getAmazonNewsletterNames(table + cards), expected, "deduplicate across sections");
assert.deepEqual(getAmazonNewsletterNames(table, 2), expected.slice(0, 2), "product limit");
assert.equal(getNewsletterRows(table).length, 3, "skip table header");
assert.deepEqual(getAmazonNewsletterNames(null), [], "missing edition");

const sections = `<h2>AMAZON BEST SELLERS</h2><p>No items available.</p>
  <h2>GOOGLE TRENDS</h2><table><tr><td>1. Unrelated news</td><td>100K searches</td></tr></table>
  <h2>AMAZON MOVERS &amp; SHAKERS</h2><div><span>1. Real Product</span><span>+40%</span></div>
  <h2>INSIGHTS</h2><div><span>1. Explanatory note</span><span>+30%</span></div>`;
assert.deepEqual(getAmazonNewsletterNames(sections), ["Real Product"], "empty sections do not borrow later tables");
const markedSections = markNewsletterRows(sections);
assert.match(markedSections, /data-google-trend="Unrelated news"/);
assert.match(markedSections, /data-amazon-product="Real Product"/);
assert.doesNotMatch(markedSections, /data-amazon-product="(?:Unrelated news|Explanatory note)"/);
assert.equal(markNewsletterRows(markedSections), markedSections, "marking is idempotent");

const quoted = `<H3>AMAZON</H3><DIV><SPAN>1. A &quot;Quoted&quot; &amp; &#x1F3BF; Product</SPAN><SPAN>#1 Sports</SPAN></DIV>`;
assert.deepEqual(getAmazonNewsletterNames(quoted), ['A "Quoted" & 🎿 Product']);
assert.match(markNewsletterRows(quoted), /data-amazon-product="A &quot;Quoted&quot; &amp; 🎿 Product"/);
const injection = `<h2>AMAZON</h2><div><span>1. Product &quot; onmouseover=&quot;alert(1)&quot; &lt;img&gt;</span><span>#1 Toys</span></div>`;
assert.match(markNewsletterRows(injection), /data-amazon-product="Product &quot; onmouseover=&quot;alert\(1\)&quot; &lt;img&gt;"/);
assert.doesNotMatch(markNewsletterRows(injection), /data-amazon-product="[^"]*" onmouseover=/);
for (const [title, attribute] of [["GOOGLE TRENDS", "google"], ["X / TWITTER USA", "x"], ["TIKTOK", "tiktok"], ["YOUTUBE USA", "youtube"]]) {
  const edition = `<h2>${title}</h2><div><span>1. Example topic</span><span>2M+ views</span></div>`;
  assert.match(markNewsletterRows(edition), new RegExp(`data-${attribute}-trend="Example topic"`));
}

if (process.argv[2]) {
  const published = fs.readFileSync(process.argv[2], "utf8");
  const names = getAmazonNewsletterNames(published);
  assert.equal(names.length, 30, "published November 2 edition yields all 30 products");
  assert.equal(names[0], "Cards Against Humanity");
  assert.equal(names.at(-1), "Car Ice Scraper");
  const marked = markNewsletterRows(published);
  for (const [attribute, count] of [["amazon-product", 30], ["google-trend", 25], ["x-trend", 15], ["tiktok-trend", 15], ["youtube-trend", 15]]) {
    assert.equal((marked.match(new RegExp(`data-${attribute}=`, "g")) || []).length, count, attribute);
  }
  console.log("PASS: published November 2 edition: 30 Amazon items and 100 interactive rows.");
}
console.log("PASS: table/card parsing, section isolation, limits, deduplication, entities, escaping and row interaction attributes.");
