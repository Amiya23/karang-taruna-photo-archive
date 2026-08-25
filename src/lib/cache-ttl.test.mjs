import { test } from "node:test";
import assert from "node:assert/strict";
import { memoizeTtl } from "./.tmptest/cache-ttl.js";

function makeState() {
  return { cache: null, inflight: null };
}

test("cold cache calls source once", async () => {
  const state = makeState();
  let calls = 0;
  const source = async () => {
    calls += 1;
    return 123;
  };
  const v = await memoizeTtl(source, state, 1000, 5000);
  assert.equal(v, 123);
  assert.equal(calls, 1);
  assert.ok(state.cache && state.cache.expiresAt > 1000);
});

test("within TTL returns cached value without calling source", async () => {
  const state = makeState();
  let calls = 0;
  const source = async () => {
    calls += 1;
    return 42;
  };
  const first = await memoizeTtl(source, state, 1000, 5000);
  // second call at 2000ms is still within the 5000ms TTL window
  const second = await memoizeTtl(source, state, 2000, 5000);
  assert.equal(first, 42);
  assert.equal(second, 42);
  assert.equal(calls, 1); // source ran exactly once
});

test("after TTL expires, source is called again", async () => {
  const state = makeState();
  let calls = 0;
  const source = async () => {
    calls += 1;
    return calls * 10;
  };
  await memoizeTtl(source, state, 1000, 5000);
  // 7000ms is past the 1000 + 5000 expiry
  const after = await memoizeTtl(source, state, 7000, 5000);
  assert.equal(after, 20);
  assert.equal(calls, 2);
});

test("concurrent callers share one source invocation (dedupe)", async () => {
  const state = makeState();
  let calls = 0;
  let resolveSource;
  const source = () =>
    new Promise((res) => {
      calls += 1;
      resolveSource = res;
    });

  const p1 = memoizeTtl(source, state, 1000, 5000);
  const p2 = memoizeTtl(source, state, 1000, 5000);
  const p3 = memoizeTtl(source, state, 1000, 5000);
  // none should have resolved yet, and source should have been called once
  assert.equal(calls, 1);
  assert.ok(state.inflight);

  resolveSource(99);
  const [a, b, c] = await Promise.all([p1, p2, p3]);
  assert.equal(a, 99);
  assert.equal(b, 99);
  assert.equal(c, 99);
  assert.equal(calls, 1); // deduplicated
  assert.equal(state.inflight, null);
});

test("refreshes cache after a fresh recalculation", async () => {
  const state = makeState();
  let calls = 0;
  const source = async () => {
    calls += 1;
    return calls;
  };
  await memoizeTtl(source, state, 1000, 5000);
  await memoizeTtl(source, state, 2000, 5000); // cached
  await memoizeTtl(source, state, 7000, 5000); // expired -> recalc
  const late = await memoizeTtl(source, state, 7200, 5000); // cached again
  assert.equal(late, 2);
  assert.equal(calls, 2);
});
