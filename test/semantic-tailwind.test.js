import { describe, it } from "node:test";
import assert from "node:assert";
import { resolveTailwindConstStringConflicts } from "../dist/core/merge/semantic-tailwind.js";

describe("resolveTailwindConstStringConflicts", () => {
  it("resolves simple tailwind class conflicts by unioning tokens", () => {
    const input = `some code
<<<<<<< LOCAL
  const base = "inline-flex items-center rounded-md";
=======
  const base = "inline-flex items-center transition-colors";
>>>>>>> INCOMING
more code`;

    const result = resolveTailwindConstStringConflicts(input);

    assert.strictEqual(result.changed, true);
    assert.strictEqual(result.stillHasConflicts, false);
    assert.ok(result.text.includes("inline-flex"));
    assert.ok(result.text.includes("items-center"));
    assert.ok(result.text.includes("rounded-md"));
    assert.ok(result.text.includes("transition-colors"));
    assert.ok(!result.text.includes("<<<<<<<"));
  });

  it("preserves non-tailwind conflicts", () => {
    const input = `<<<<<<< LOCAL
const foo = 123;
=======
const foo = 456;
>>>>>>> INCOMING`;

    const result = resolveTailwindConstStringConflicts(input);

    assert.strictEqual(result.changed, false);
    assert.strictEqual(result.stillHasConflicts, true);
  });

  it("handles text without conflicts", () => {
    const input = `const base = "inline-flex items-center";`;

    const result = resolveTailwindConstStringConflicts(input);

    assert.strictEqual(result.changed, false);
    assert.strictEqual(result.stillHasConflicts, false);
    assert.strictEqual(result.text, input);
  });

  it("deduplicates common tokens", () => {
    const input = `<<<<<<< LOCAL
const classes = "px-4 py-2 bg-blue-500";
=======
const classes = "px-4 py-2 bg-red-500";
>>>>>>> INCOMING
`;

    const result = resolveTailwindConstStringConflicts(input);

    assert.strictEqual(result.changed, true);
    // px-4 and py-2 should appear only once
    const matches = result.text.match(/px-4/g);
    assert.strictEqual(matches?.length, 1);
  });
});
