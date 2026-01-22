export function contractToButtonIR(contract) {
  const p = contract.props ?? {};
  return {
    name: contract.name,
    version: contract.version,
    element: contract.element,

    // boolean switches
    hasLoading: Boolean(p.loading),

    // defaults from contract
    defaults: {
      variant: p.variant?.default ?? "solid",
      size: p.size?.default ?? "md",
      disabled: p.disabled?.default ?? false,
      loading: p.loading?.default ?? false,
    },

    // a11y expectations
    a11y: {
      defaultType: contract.a11y?.defaultType ?? "button",
      busyAttribute: contract.a11y?.busyAttribute ?? "aria-busy",
      loadingDisables: Boolean(contract.a11y?.loadingDisables),
    },
  };
}
