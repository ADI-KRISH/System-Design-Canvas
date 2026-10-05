// Deterministic grader. Pure function: same board in -> same result out.
//
// board: { nodes: [{ id, type, fixed? }], edges: [{ a, b }] }
// Connections are treated as undirected: "A is connected to B" is what matters.

const PENALTY_PER_PROBLEM = 15;

function resolve(nodes, ref) {
  return nodes.filter((n) => n.id === ref || n.type === ref);
}

function connected(board, refA, refB) {
  const as = resolve(board.nodes, refA);
  const bs = resolve(board.nodes, refB);
  return board.edges.some((e) =>
    as.some((x) => bs.some((y) => x.id !== y.id && ((e.a === x.id && e.b === y.id) || (e.a === y.id && e.b === x.id)))),
  );
}

export function evaluate(caseDef, board) {
  const checks = caseDef.required.map((r) => ({
    id: r.id,
    label: r.label,
    why: r.why,
    ok: connected(board, r.a, r.b),
  }));

  const problems = [];

  const wrongSeen = new Set();
  for (const n of board.nodes) {
    if (n.fixed) continue;
    const reason = caseDef.wrong[n.type];
    if (reason && !wrongSeen.has(n.type)) {
      wrongSeen.add(n.type);
      problems.push({ id: `wrong-${n.type}`, kind: 'component', nodeType: n.type, message: reason });
    }
  }

  for (const f of caseDef.forbidden) {
    if (connected(board, f.a, f.b)) {
      problems.push({ id: f.id, kind: 'connection', a: f.a, b: f.b, message: f.why });
    }
  }

  const satisfied = checks.filter((c) => c.ok).length;
  const base = Math.round((satisfied / checks.length) * 100);
  const score = Math.max(0, base - problems.length * PENALTY_PER_PROBLEM);
  const passed = satisfied === checks.length && problems.length === 0;

  return { passed, score, satisfied, total: checks.length, checks, problems };
}

// Used by tests and the server: the fixed part of a case as a starting board.
export function initialBoard(caseDef) {
  return {
    nodes: caseDef.fixed.map((n) => ({ id: n.id, type: n.type, fixed: true })),
    edges: caseDef.fixedEdges.map(([a, b]) => ({ a, b, fixed: true })),
  };
}

export function solutionBoard(caseDef) {
  const board = initialBoard(caseDef);
  for (const n of caseDef.solution.nodes) board.nodes.push({ id: n.id, type: n.type });
  for (const [a, b] of caseDef.solution.edges) board.edges.push({ a, b });
  return board;
}

// Built-in explanation from the case data. Used when no LLM is configured / reachable.
export function offlineExplanation(caseDef, result) {
  const lines = [caseDef.explanation];
  const missing = result.checks.filter((c) => !c.ok);
  if (missing.length) {
    lines.push('', 'Still missing on your board:');
    for (const m of missing) lines.push(`• ${m.label}`);
  }
  if (result.problems.length) {
    lines.push('', 'Things to reconsider:');
    for (const p of result.problems) lines.push(`• ${p.message}`);
  }
  if (!missing.length && !result.problems.length) lines.push('', 'Your design satisfies every requirement for this case.');
  return lines.join('\n');
}
