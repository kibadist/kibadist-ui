import { describe, it } from "node:test";
import assert from "node:assert";
import { listButtonVersions, loadButtonContract } from "../dist/core/contracts.js";

describe("contracts", () => {
  describe("listButtonVersions", () => {
    it("returns available versions", () => {
      const versions = listButtonVersions();

      assert.ok(Array.isArray(versions));
      assert.ok(versions.length > 0);
      assert.ok(versions.includes("1.0.0"));
      assert.ok(versions.includes("1.1.0"));
    });

    it("returns sorted versions", () => {
      const versions = listButtonVersions();
      const sorted = [...versions].sort();

      assert.deepStrictEqual(versions, sorted);
    });
  });

  describe("loadButtonContract", () => {
    it("loads version 1.0.0", () => {
      const contract = loadButtonContract("1.0.0");

      assert.strictEqual(contract.name, "Button");
      assert.strictEqual(contract.version, "1.0.0");
      assert.strictEqual(contract.element, "button");
      assert.ok(contract.props);
      assert.ok(contract.a11y);
    });

    it("loads version 1.1.0", () => {
      const contract = loadButtonContract("1.1.0");

      assert.strictEqual(contract.name, "Button");
      assert.strictEqual(contract.version, "1.1.0");
      assert.ok(contract.props.loading);
    });

    it("throws on invalid version", () => {
      assert.throws(() => loadButtonContract("9.9.9"), {
        code: "ENOENT",
      });
    });
  });
});
