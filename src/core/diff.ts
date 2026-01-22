import { fmt } from "./output.js";

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNumber?: number;
}

export interface DiffHunk {
  startLine: number;
  lines: DiffLine[];
}

/**
 * Simple line-based diff algorithm.
 * Returns hunks of changes with context lines.
 */
export function diffLines(oldText: string, newText: string, contextLines = 2): DiffHunk[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Use LCS (Longest Common Subsequence) to find matching lines
  const lcs = computeLCS(oldLines, newLines);

  // Build diff from LCS
  const diff: DiffLine[] = [];
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldIdx < oldLines.length && newIdx < newLines.length) {
      const [lcsOldIdx, lcsNewIdx] = lcs[lcsIdx];

      // Add removed lines (in old but not at LCS position)
      while (oldIdx < lcsOldIdx) {
        diff.push({ type: "remove", content: oldLines[oldIdx], lineNumber: oldIdx + 1 });
        oldIdx++;
      }

      // Add inserted lines (in new but not at LCS position)
      while (newIdx < lcsNewIdx) {
        diff.push({ type: "add", content: newLines[newIdx], lineNumber: newIdx + 1 });
        newIdx++;
      }

      // Add context line (matching)
      diff.push({ type: "context", content: newLines[newIdx], lineNumber: newIdx + 1 });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else {
      // Handle remaining lines after LCS is exhausted
      while (oldIdx < oldLines.length) {
        diff.push({ type: "remove", content: oldLines[oldIdx], lineNumber: oldIdx + 1 });
        oldIdx++;
      }
      while (newIdx < newLines.length) {
        diff.push({ type: "add", content: newLines[newIdx], lineNumber: newIdx + 1 });
        newIdx++;
      }
    }
  }

  // Group into hunks with context
  return groupIntoHunks(diff, contextLines);
}

/**
 * Compute LCS indices for two arrays of lines.
 * Returns array of [oldIndex, newIndex] pairs.
 */
function computeLCS(oldLines: string[], newLines: string[]): [number, number][] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: [number, number][] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      lcs.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

/**
 * Group diff lines into hunks, keeping only changed areas with context.
 */
function groupIntoHunks(diff: DiffLine[], contextLines: number): DiffHunk[] {
  const hunks: DiffHunk[] = [];

  // Find indices of changed lines
  const changeIndices: number[] = [];
  diff.forEach((line, idx) => {
    if (line.type !== "context") {
      changeIndices.push(idx);
    }
  });

  if (changeIndices.length === 0) {
    return [];
  }

  // Group changes that are close together
  let hunkStart = Math.max(0, changeIndices[0] - contextLines);
  let hunkEnd = Math.min(diff.length - 1, changeIndices[0] + contextLines);

  for (let i = 1; i < changeIndices.length; i++) {
    const changeIdx = changeIndices[i];
    const expandedStart = Math.max(0, changeIdx - contextLines);

    if (expandedStart <= hunkEnd + 1) {
      // Merge with current hunk
      hunkEnd = Math.min(diff.length - 1, changeIdx + contextLines);
    } else {
      // Save current hunk and start new one
      hunks.push({
        startLine: diff[hunkStart].lineNumber ?? hunkStart + 1,
        lines: diff.slice(hunkStart, hunkEnd + 1),
      });

      hunkStart = expandedStart;
      hunkEnd = Math.min(diff.length - 1, changeIdx + contextLines);
    }
  }

  // Save last hunk
  hunks.push({
    startLine: diff[hunkStart].lineNumber ?? hunkStart + 1,
    lines: diff.slice(hunkStart, hunkEnd + 1),
  });

  return hunks;
}

/**
 * Format diff hunks for terminal output with colors.
 */
export function formatDiff(hunks: DiffHunk[], filename: string): string {
  if (hunks.length === 0) {
    return fmt.dim("  (no changes)");
  }

  const lines: string[] = [];

  for (const hunk of hunks) {
    // Hunk separator
    if (lines.length > 0) {
      lines.push(fmt.dim("  ..."));
    }

    for (const line of hunk.lines) {
      const prefix = line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  ";
      const content = `${prefix}${line.content}`;

      if (line.type === "add") {
        lines.push(fmt.success(content));
      } else if (line.type === "remove") {
        lines.push(fmt.error(content));
      } else {
        lines.push(fmt.dim(content));
      }
    }
  }

  return lines.join("\n");
}

/**
 * Count additions and removals in diff.
 */
export function diffStats(hunks: DiffHunk[]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === "add") additions++;
      if (line.type === "remove") deletions++;
    }
  }

  return { additions, deletions };
}
