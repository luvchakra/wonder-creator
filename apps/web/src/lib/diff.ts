export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

/** Line-level diff (LCS). Small, dependency-free; inputs are capped to keep it fast. */
export function diffLines(a: string, b: string, maxLines = 800): DiffLine[] {
  const A = a.split("\n").slice(0, maxLines);
  const B = b.split("\n").slice(0, maxLines);
  const n = A.length;
  const m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ kind: "same", text: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "removed", text: A[i++] });
    else out.push({ kind: "added", text: B[j++] });
  }
  while (i < n) out.push({ kind: "removed", text: A[i++] });
  while (j < m) out.push({ kind: "added", text: B[j++] });
  return out;
}
