import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, COMPONENTS, LEVELS } from '../public/cases.js';
import { evaluate, initialBoard, solutionBoard } from '../public/evaluator.js';

test('there are beginner and intermediate cases and ids are unique', () => {
  const ids = CASES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const lvl of ['beginner', 'intermediate']) assert.ok(CASES.filter((c) => c.level === lvl).length >= 4);
  for (const c of CASES) assert.ok(LEVELS.some((l) => l.id === c.level), c.id);
});

for (const c of CASES) {
  test(`${c.id}: definition is internally consistent`, () => {
    const fixedIds = c.fixed.map((n) => n.id);
    assert.equal(new Set(fixedIds).size, fixedIds.length, 'fixed ids unique');
    for (const n of c.fixed) assert.ok(COMPONENTS[n.type], `fixed type ${n.type}`);
    for (const t of c.palette) assert.ok(COMPONENTS[t], `palette type ${t}`);
    for (const t of Object.keys(c.wrong)) assert.ok(c.palette.includes(t), `wrong type ${t} must be in palette`);
    // fixed ids must not collide with component type names (refs resolve by id OR type)
    for (const id of fixedIds) assert.ok(!COMPONENTS[id] || c.fixed.find((n) => n.id === id).type === id || id === 'client' , `id ${id} collides with a type`);
    const refOk = (r) => fixedIds.includes(r) || c.palette.includes(r);
    for (const r of c.required) { assert.ok(refOk(r.a), `${r.id}.a=${r.a}`); assert.ok(refOk(r.b), `${r.id}.b=${r.b}`); }
    for (const f of c.forbidden) { assert.ok(refOk(f.a), `${f.id}.a`); assert.ok(refOk(f.b), `${f.id}.b`); }
    for (const [a, b] of c.fixedEdges) assert.ok(fixedIds.includes(a) && fixedIds.includes(b));
    assert.ok(c.hints.length >= 3);
    // the solution uses only palette types
    for (const n of c.solution.nodes) assert.ok(c.palette.includes(n.type), `solution type ${n.type}`);
  });

  test(`${c.id}: reference solution passes with 100`, () => {
    const r = evaluate(c, solutionBoard(c));
    assert.equal(r.passed, true, JSON.stringify(r.checks.filter((x) => !x.ok).concat(r.problems)));
    assert.equal(r.score, 100);
  });

  test(`${c.id}: starting board does not pass`, () => {
    const r = evaluate(c, initialBoard(c));
    assert.equal(r.passed, false);
    assert.ok(r.score < 100);
  });

  test(`${c.id}: dropping any single required connection fails that check`, () => {
    for (const req of c.required) {
      const board = solutionBoard(c);
      // remove every edge that could satisfy this requirement
      const sat = (e) => {
        const nodes = Object.fromEntries(board.nodes.map((n) => [n.id, n]));
        const m = (ref, n) => n.id === ref || n.type === ref;
        const x = nodes[e.a], y = nodes[e.b];
        return (m(req.a, x) && m(req.b, y)) || (m(req.a, y) && m(req.b, x));
      };
      board.edges = board.edges.filter((e) => e.fixed || !sat(e));
      const r = evaluate(c, board);
      assert.equal(r.passed, false, `${c.id}/${req.id} should fail when missing`);
      assert.equal(r.checks.find((x) => x.id === req.id).ok, false);
    }
  });

  test(`${c.id}: wrong components and forbidden connections are penalised`, () => {
    for (const [type] of Object.entries(c.wrong)) {
      const board = solutionBoard(c);
      board.nodes.push({ id: 'junk', type });
      const r = evaluate(c, board);
      assert.equal(r.passed, false);
      assert.ok(r.problems.some((p) => p.nodeType === type));
      assert.ok(r.score < 100);
    }
    for (const f of c.forbidden) {
      const board = solutionBoard(c);
      const refId = (ref) => (c.fixed.find((n) => n.id === ref) ? ref : board.nodes.find((n) => n.type === ref)?.id);
      const a = refId(f.a), b = refId(f.b);
      assert.ok(a && b, `${c.id}/${f.id}: both ends exist on the solution board`);
      board.edges.push({ a, b });
      const r = evaluate(c, board);
      assert.equal(r.passed, false, `${f.id}`);
      assert.ok(r.problems.some((p) => p.id === f.id));
    }
  });
}

test('connections are undirected', () => {
  const c = CASES.find((x) => x.id === 'b1-blog-reads');
  const board = initialBoard(c);
  board.nodes.push({ id: 'n1', type: 'cache' });
  board.edges.push({ a: 'n1', b: 'web' });
  assert.equal(evaluate(c, board).passed, true);
});

test('an unconnected component does not satisfy a requirement', () => {
  const c = CASES.find((x) => x.id === 'b1-blog-reads');
  const board = initialBoard(c);
  board.nodes.push({ id: 'n1', type: 'cache' });
  assert.equal(evaluate(c, board).passed, false);
});

test('a cache wired only to the DB does not satisfy the cache-aside requirement', () => {
  const c = CASES.find((x) => x.id === 'b1-blog-reads');
  const board = initialBoard(c);
  board.nodes.push({ id: 'n1', type: 'cache' });
  board.edges.push({ a: 'n1', b: 'db' });
  assert.equal(evaluate(c, board).passed, false);
});
