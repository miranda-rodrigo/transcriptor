const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { OVERLAY_LAYOUTS, WindowPositionUtil } = require("./windowConfig");

describe("overlay window size", () => {
  it("keeps the idle HUD smaller than a typical floating panel", () => {
    assert.ok(OVERLAY_LAYOUTS.bar.width <= 200);
    assert.ok(OVERLAY_LAYOUTS.bar.height <= 48);
  });

  it("anchors the bar to the bottom-right of the work area", () => {
    const display = {
      bounds: { x: 0, y: 0, width: 1440, height: 900 },
      workArea: { x: 0, y: 25, width: 1440, height: 850 },
    };
    const position = WindowPositionUtil.getMainWindowPosition(display);
    assert.equal(position.width, OVERLAY_LAYOUTS.bar.width);
    assert.equal(position.height, OVERLAY_LAYOUTS.bar.height);
    assert.equal(position.x, 1440 - OVERLAY_LAYOUTS.bar.width - 12);
    assert.equal(position.y, 25 + 850 - OVERLAY_LAYOUTS.bar.height - 12);
  });
});
