import { describe, it } from "node:test";
import assert from "node:assert";
import { contractToButtonIR } from "../dist/core/ir.js";

describe("contractToButtonIR", () => {
  it("transforms a basic contract to IR", () => {
    const contract = {
      name: "Button",
      version: "1.0.0",
      element: "button",
      props: {
        variant: { default: "solid" },
        size: { default: "md" },
        disabled: { default: false },
      },
      slots: {},
      a11y: {
        defaultType: "button",
      },
    };

    const ir = contractToButtonIR(contract);

    assert.strictEqual(ir.name, "Button");
    assert.strictEqual(ir.version, "1.0.0");
    assert.strictEqual(ir.element, "button");
    assert.strictEqual(ir.hasLoading, false);
    assert.strictEqual(ir.defaults.variant, "solid");
    assert.strictEqual(ir.defaults.size, "md");
    assert.strictEqual(ir.defaults.disabled, false);
    assert.strictEqual(ir.a11y.defaultType, "button");
  });

  it("detects loading prop", () => {
    const contract = {
      name: "Button",
      version: "1.1.0",
      element: "button",
      props: {
        variant: { default: "solid" },
        size: { default: "md" },
        loading: { default: false },
      },
      slots: {},
      a11y: {
        defaultType: "button",
        busyAttribute: "aria-busy",
        loadingDisables: true,
      },
    };

    const ir = contractToButtonIR(contract);

    assert.strictEqual(ir.hasLoading, true);
    assert.strictEqual(ir.defaults.loading, false);
    assert.strictEqual(ir.a11y.busyAttribute, "aria-busy");
    assert.strictEqual(ir.a11y.loadingDisables, true);
  });

  it("uses defaults when props are missing", () => {
    const contract = {
      name: "Button",
      version: "1.0.0",
      element: "button",
      props: {},
      slots: {},
      a11y: {},
    };

    const ir = contractToButtonIR(contract);

    assert.strictEqual(ir.defaults.variant, "solid");
    assert.strictEqual(ir.defaults.size, "md");
    assert.strictEqual(ir.a11y.defaultType, "button");
    assert.strictEqual(ir.a11y.busyAttribute, "aria-busy");
  });
});
