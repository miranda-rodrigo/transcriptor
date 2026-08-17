const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isSilentUpdateMiss, getUpdateErrorMessage, serializeUpdateError } = require("./updateErrors");

describe("updateErrors", () => {
  it("treats missing GitHub production releases as a silent miss", () => {
    const error = new Error(
      "Unable to find latest version on GitHub (https://github.com/miranda-rodrigo/transcriptor/releases.atom), please ensure a production release exists"
    );
    assert.equal(isSilentUpdateMiss(error), true);
  });

  it("treats missing latest-mac.yml as a silent miss", () => {
    assert.equal(
      isSilentUpdateMiss(new Error('Cannot find channel "latest.yml" update info: HttpError: 404 Not Found')),
      true
    );
    assert.equal(isSilentUpdateMiss("404 latest-mac.yml"), true);
  });

  it("does not silence real updater failures", () => {
    assert.equal(isSilentUpdateMiss(new Error("net::ERR_INTERNET_DISCONNECTED")), false);
    assert.equal(isSilentUpdateMiss(new Error("The code signature is invalid")), false);
  });

  it("serializes Error objects for IPC", () => {
    assert.equal(getUpdateErrorMessage(new Error("boom")), "boom");
    assert.deepEqual(serializeUpdateError(new Error("boom")), { message: "boom" });
  });
});
