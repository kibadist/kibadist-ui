/**
 * PoC semantic resolver for Tailwind conflicts.
 *
 * It resolves conflicts of this form:
 *   <<<<<<<
 *   const base = "a b c";
 *   =======
 *   const base = "a b d";
 *   >>>>>>>
 *
 * by UNIONing the class tokens:
 *   const base = "a b c d";
 */
function parseConstAssignment(line) {
  // indentation + const name + quote + value
  const m = line.match(/^(\s*)const\s+([A-Za-z0-9_$]+)\s*=\s*(["'`])([\s\S]*?)\3\s*;\s*$/);
  if (!m) return null;
  return { indent: m[1], name: m[2], quote: m[3], value: m[4] };
}

function looksLikeTailwind(s) {
  // heuristic: tailwind classes typically include '-' or ':' or '['
  return /[-:\[\]]/.test(s);
}

function unionTokens(a, b) {
  const aTokens = a.split(/\s+/).filter(Boolean);
  const seen = new Set(aTokens);
  const out = [...aTokens];
  for (const t of b.split(/\s+/).filter(Boolean)) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out.join(" ");
}

export function resolveTailwindConstStringConflicts(text) {
  const conflictRe = /<<<<<<<[^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>[^\n]*\n/g;

  let changed = false;

  const out = text.replace(conflictRe, (full, a, b) => {
    const aTrim = a.trimEnd();
    const bTrim = b.trimEnd();

    // only resolve single-line vs single-line conflicts
    if (aTrim.split("\n").length !== 1 || bTrim.split("\n").length !== 1) return full;

    const pa = parseConstAssignment(aTrim);
    const pb = parseConstAssignment(bTrim);
    if (!pa || !pb) return full;
    if (pa.name !== pb.name) return full;
    if (!looksLikeTailwind(pa.value) && !looksLikeTailwind(pb.value)) return full;

    const merged = unionTokens(pa.value, pb.value);
    changed = true;
    return `${pa.indent}const ${pa.name} = ${pa.quote}${merged}${pa.quote};\n`;
  });

  return { text: out, changed, stillHasConflicts: out.includes("<<<<<<<") };
}
