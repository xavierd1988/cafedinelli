import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import * as clockTime from "../lib/weatherClockTime.js";

const require = createRequire(import.meta.url);
const { transformSync } = require("next/dist/build/swc");
const { renderToStaticMarkup } = require("react-dom/server");
const React = require("react");

// Exercise the real component's initial markup at different render instants.
// The positioning hooks are irrelevant to clock text and have stable stubs.
function initialMarkup(instant, source) {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args) { super(...(args.length ? args : [instant])); }
    static now() { return new RealDate(instant).getTime(); }
  }
  const { code } = transformSync(source, {
    filename: "WeatherClock.jsx",
    jsc: {
      parser: { syntax: "ecmascript", jsx: true },
      transform: { react: { runtime: "automatic" } },
      target: "es2020"
    },
    module: { type: "commonjs" }
  });
  const loaded = { exports: {} };
  const componentRequire = (id) => {
    if (id === "./useDraggable.js") return {
      useDraggable: () => ({ offset: { x: 0, y: 0 }, dragging: false })
    };
    if (id === "../lib/modulePositions.js") return {
      getModulePosition: () => ({ offset: { x: 0, y: 0 } })
    };
    if (id === "./useSceneScale.js") return { useSceneScale: () => 1 };
    if (id === "../lib/weatherClockTime.js") return clockTime;
    return require(id);
  };
  vm.runInNewContext(code, {
    require: componentRequire,
    module: loaded,
    exports: loaded.exports,
    Date: FixedDate
  });
  return renderToStaticMarkup(React.createElement(loaded.exports.default));
}

const component = fs.readFileSync(new URL("../components/WeatherClock.jsx", import.meta.url), "utf8");
const buildMarkup = initialMarkup("2026-11-04T21:59:00Z", component);
const visitMarkup = initialMarkup("2026-11-05T17:09:00Z", component);
assert.equal(buildMarkup, visitMarkup, "prerender and first client markup must not depend on the current instant");
assert.match(buildMarkup, /wclock-time">--:-- --</);

// The displayed city and the clock use the same zone, even if the browser
// has a different zone. Midnight and winter/summer offsets are significant.
const now = new Date("2026-11-05T17:09:00Z");
assert.deepEqual(clockTime.formatWeatherClock(now, "Europe/Paris"), {
  date: "05-11", time: "6:09 PM", day: "THU"
});
assert.deepEqual(clockTime.formatWeatherClock(now, "America/New_York"), {
  date: "05-11", time: "12:09 PM", day: "THU"
});
assert.deepEqual(clockTime.formatWeatherClock(new Date("2026-11-06T02:09:00Z"), "America/New_York"), {
  date: "05-11", time: "9:09 PM", day: "THU"
});
assert.deepEqual(clockTime.formatWeatherClock(new Date("2026-07-05T17:09:00Z"), "America/New_York"), {
  date: "05-07", time: "1:09 PM", day: "SUN"
});
assert.deepEqual(clockTime.formatWeatherClock(null, "Europe/Paris"), {
  date: "-- --", time: "--:-- --", day: "---"
});
assert.equal(clockTime.forecastDay("2026-11-06"), "FRI");
assert.equal(clockTime.forecastDay("2026-11-08"), "SUN");

console.log("Weather clock: initial markup is stable; location timezone, midnight, DST and forecast days pass.");
