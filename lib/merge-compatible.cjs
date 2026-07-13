/**
 * merge-compatible.js (v4)
 *
 * Merges JSON documents into a more complete one, but ONLY when they don't conflict.
 * Pure merge kernel — operational guards (backups, count checks, insert
 * verification) belong in the calling script.
 *
 * Rules:
 *  - Top-level keys in `ignoreKeys` (default: ['_id', 'hash']) are excluded from
 *    conflict checking. The merged result keeps the surviving doc's value for
 *    them (falls back to the other's if missing).
 *  - Objects: union of keys, recursive merge on shared keys. Key order irrelevant.
 *  - Arrays: equal if same elements deep, order-insensitive, multiset semantics.
 *    Arrays differing in CONTENT are a conflict.
 *  - Scalars: strictly equal or conflict. Deliberately NO whitespace/locale/
 *    numeric-string normalization — normalize upstream, explicitly, if wanted.
 *
 * Content-hash integration (unique SPARSE indexes):
 *  - `opts.finalize(doc)` runs ONLY on docs whose semantic content actually
 *    changed (grew) in a merge. Pure subset absorption keeps the survivor —
 *    and its still-valid hash — untouched (counted in stats.absorbed).
 *  - NEVER set a unique-sparse-indexed field to null: sparse indexes skip
 *    MISSING fields but DO index explicit nulls, so two `hash: null` docs
 *    collide. Either strip the field (`({hash, ...d}) => d`) or recompute it
 *    with your own recipe.
 *  - A recomputed hash may equal an EXISTING doc's hash elsewhere in the
 *    collection. This is NOT proof the existing doc is the union: the hasher's
 *    coerce/trim options make hash equality WEAKER than content equality
 *    (e.g. {v:"12"} and {v:12} share a hash yet conflict in this kernel).
 *    On a duplicate-key error the guarded script must fetch the existing doc
 *    and confirm `isUnionWitness(existing, sources)` before deleting the
 *    sources; if it returns false, the collision is coercion-only — abort.
 *
 * Fixed-point audit semantics: a second pass over already-merged output is a
 * fixed point iff stats.exactDuplicates === 0 && stats.merged === 0 &&
 * stats.absorbed === 0. stats.ambiguous may be a STABLE NONZERO residue by
 * design under the conservative 'keep' policy — audit that it is stable and
 * reviewed, not that it is zero.
 *
 * Input contract (fail-loud, not fail-silent):
 *  - JSON / Extended JSON values only (mongoexport output, JSON.parse). Live
 *    BSON/class instances (Date, ObjectId, ...) throw a TypeError. NaN and
 *    ±Infinity get distinct tokens (NaN === NaN, NaN !== null).
 *  - Do NOT mutate documents after passing them in: canonical forms are cached
 *    per object reference (WeakMap); mutation makes the cache stale.
 *
 * Options (all functions):
 *  - ignoreKeys: string[]        override ignored top-level keys ([] = strict)
 *  - requireSharedKeys: string[] refuse to merge docs unless they agree on at
 *                                least one of these keys (identity guard)
 * reduceCompatible only:
 *  - deterministic: boolean      default true: result AND surviving provenance
 *                                (_id/hash of exact duplicates) are independent
 *                                of input order — the canonically smallest full
 *                                doc survives. false: input-order-first
 *                                survives (e.g. chronologically oldest).
 *  - ambiguous: 'keep'|'first'   doc compatible with 2+ clusters: keep separate
 *                                (default, conservative) or merge into first
 *  - finalize: (doc) => doc      applied only to docs whose content changed
 *  - stats: {}                   mutated with {input, exactDuplicates, merged,
 *                                absorbed, ambiguous, output}
 */

const crypto = require('crypto');

const DEFAULT_IGNORE_KEYS = ['_id', 'hash'];

class MergeConflictError extends Error {
  constructor(path, a, b) {
    super(`Merge conflict at ${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
    this.name = 'MergeConflictError';
    this.path = path;
    this.a = a;
    this.b = b;
  }
}

const isPlainObject = (v) => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/**
 * Canonical serialization: object keys sorted; array elements serialized then
 * sorted lexicographically (valid multiset comparison — the serialization is
 * injective for supported values). Memoized per object reference.
 */
const canonCache = new WeakMap();
function canonicalKey(v) {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'number') {
    if (Number.isNaN(v)) return 'NaN';
    if (!Number.isFinite(v)) return v > 0 ? 'Infinity' : '-Infinity';
    return JSON.stringify(v);
  }
  if (t === 'string' || t === 'boolean') return JSON.stringify(v);
  if (t === 'undefined') return 'undefined';
  if (t === 'bigint') return `${v}n`;
  if (t === 'function' || t === 'symbol') {
    throw new TypeError(`canonicalKey: ${t} values are not comparable data`);
  }
  const hit = canonCache.get(v);
  if (hit !== undefined) return hit;
  let s;
  if (Array.isArray(v)) {
    const parts = v.map(canonicalKey);
    parts.sort();
    s = `[${parts.join(',')}]`;
  } else if (isPlainObject(v)) {
    s = `{${Object.keys(v).sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalKey(v[k])}`)
      .join(',')}}`;
  } else {
    throw new TypeError(
      `canonicalKey: unsupported non-plain object (${v.constructor?.name ?? 'unknown prototype'}). ` +
      'Convert BSON/class instances (Date, ObjectId, ...) to Extended JSON first.'
    );
  }
  canonCache.set(v, s);
  return s;
}

const equalUnordered = (a, b) => canonicalKey(a) === canonicalKey(b);

function stripIgnored(doc, ignore) {
  if (!isPlainObject(doc) || ignore.size === 0) return doc;
  const out = {};
  for (const k of Object.keys(doc)) if (!ignore.has(k)) out[k] = doc[k];
  return out;
}

const contentKey = (doc, opts = {}) =>
  canonicalKey(stripIgnored(doc, new Set(opts.ignoreKeys ?? DEFAULT_IGNORE_KEYS)));

/** sha256 of the canonical content form — a compact identifier. Dedup
 *  decisions inside reduceCompatible use the full canonical string, never this. */
const fingerprint = (doc, opts = {}) =>
  crypto.createHash('sha256').update(contentKey(doc, opts)).digest('hex');

function mergeInner(a, b, path) {
  if (equalUnordered(a, b)) return a; // identical modulo order — keep a's form

  if (isPlainObject(a) && isPlainObject(b)) {
    const out = { ...a };
    for (const [k, vb] of Object.entries(b)) {
      out[k] = k in a ? mergeInner(a[k], vb, `${path}.${k}`) : vb;
    }
    return out;
  }
  throw new MergeConflictError(path, a, b);
}

function checkSharedIdentity(a, b, opts) {
  const req = opts.requireSharedKeys;
  if (!req?.length) return true;
  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  return req.some((k) => k in a && k in b && equalUnordered(a[k], b[k]));
}

function mergeCompatible(a, b, opts = {}) {
  if (!checkSharedIdentity(a, b, opts)) {
    throw new MergeConflictError('$', a, b); // no shared identity key
  }
  const ignore = new Set(opts.ignoreKeys ?? DEFAULT_IGNORE_KEYS);
  if (!isPlainObject(a) || !isPlainObject(b) || ignore.size === 0) {
    return mergeInner(a, b, '$');
  }
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (ignore.has(k)) {
      out[k] = k in a ? a[k] : b[k]; // no conflict check, first doc wins
    } else if (k in a && k in b) {
      out[k] = mergeInner(a[k], b[k], `$.${k}`);
    } else {
      out[k] = k in a ? a[k] : b[k];
    }
  }
  return out;
}

/** All conflicts between two docs (never throws), respecting ignoreKeys. */
function collectConflicts(a, b, opts = {}) {
  const ignore = new Set(opts.ignoreKeys ?? DEFAULT_IGNORE_KEYS);
  const conflicts = [];
  const walk = (x, y, path, top) => {
    if (equalUnordered(x, y)) return;
    if (isPlainObject(x) && isPlainObject(y)) {
      for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
        if (top && ignore.has(k)) continue;
        if (k in x && k in y) walk(x[k], y[k], `${path}.${k}`, false);
      }
      return;
    }
    conflicts.push({ path, a: x, b: y });
  };
  // Remove ignored root metadata before canonical comparison. MongoDB assigns
  // live ObjectId instances to inserted documents, and canonicalKey correctly
  // rejects such BSON values when they are semantic content. Ignored metadata
  // must never reach that comparison in the first place.
  walk(stripIgnored(a, ignore), stripIgnored(b, ignore), '$', false);
  return conflicts;
}

const canMerge = (a, b, opts = {}) =>
  checkSharedIdentity(a, b, opts) && collectConflicts(a, b, opts).length === 0;

/**
 * Strict verification that `existing` already contains everything in every
 * source doc: merging any source into it must be a pure absorption (content
 * unchanged). Use this before treating a duplicate-key collision on a merged
 * doc's hash as "union already exists": hash equality under coerce/trim does
 * NOT imply this. Returns false on any conflict or content growth.
 */
function isUnionWitness(existing, sources, opts = {}) {
  const eCk = contentKey(existing, opts);
  return sources.every((s) => {
    if (!canMerge(existing, s, opts)) return false;
    return contentKey(mergeCompatible(existing, s, opts), opts) === eCk;
  });
}

/**
 * Reduce an array of docs (typically: all docs sharing one barcode).
 *  Phase 1 — exact dedup by FULL canonical content string. Under
 *            `deterministic` (default) the canonically smallest FULL doc
 *            (ignored keys included) survives, so provenance is input-order
 *            independent too.
 *  Phase 2 — deterministic ordering by canonical content form.
 *  Phase 3 — greedy merge. Content-growing merges run `finalize` and count as
 *            stats.merged; pure subset absorption keeps the survivor (and its
 *            valid hash) untouched and counts as stats.absorbed. Docs
 *            compatible with 2+ clusters are ambiguous: kept separate by
 *            default, or merged into the first with `ambiguous: 'first'`.
 */
function reduceCompatible(docs, opts = {}) {
  const stats = opts.stats ?? {};
  stats.input = docs.length;
  stats.exactDuplicates = 0;
  stats.merged = 0;
  stats.absorbed = 0;
  stats.ambiguous = 0;
  const deterministic = opts.deterministic !== false;

  // Phase 1: exact dedup on full canonical content strings
  const byContent = new Map(); // contentKey -> { d, fullCk? }
  const order = [];
  for (const d of docs) {
    const ck = contentKey(d, opts);
    const kept = byContent.get(ck);
    if (!kept) {
      byContent.set(ck, { d });
      order.push(ck);
    } else {
      stats.exactDuplicates += 1;
      if (deterministic) {
        kept.fullCk ??= canonicalKey(kept.d);
        const candFull = canonicalKey(d);
        if (candFull < kept.fullCk) {
          kept.d = d;
          kept.fullCk = candFull;
        }
      }
    }
  }
  const unique = order.map((ck) => ({ d: byContent.get(ck).d, ck }));

  // Phase 2: deterministic clustering order
  if (deterministic) {
    unique.sort((x, y) => (x.ck < y.ck ? -1 : x.ck > y.ck ? 1 : 0));
  }

  // Phase 3: greedy merge with ambiguity policy
  const result = [];
  for (const { d } of unique) {
    const compat = [];
    for (let i = 0; i < result.length && compat.length < 2; i++) {
      if (canMerge(result[i], d, opts)) compat.push(i);
    }
    if (compat.length === 0) {
      result.push(d);
    } else if (compat.length === 1 || opts.ambiguous === 'first') {
      if (compat.length > 1) stats.ambiguous += 1;
      const i = compat[0];
      const before = result[i];
      let m = mergeCompatible(before, d, opts);
      if (contentKey(m, opts) === contentKey(before, opts)) {
        stats.absorbed += 1; // strict subset: survivor & its hash stay valid
        result[i] = m;       // may still have gained ignored keys (e.g. a
                             // hash the survivor lacked — valid: same content)
      } else {
        stats.merged += 1;   // content grew: hash is stale, let caller fix it
        if (opts.finalize) m = opts.finalize(m);
        result[i] = m;
      }
    } else {
      stats.ambiguous += 1; // compatible with 2+ clusters, policy 'keep'
      result.push(d);
    }
  }
  stats.output = result.length;
  return result;
}

module.exports = {
  mergeCompatible,
  collectConflicts,
  canMerge,
  isUnionWitness,
  reduceCompatible,
  fingerprint,
  contentKey,
  equalUnordered,
  canonicalKey,
  MergeConflictError,
  DEFAULT_IGNORE_KEYS,
};

// ---- self-test when run directly: node merge-compatible.js ----
if (require.main === module) {
  const assert = require('node:assert/strict');

  // 1. Complementary fields, shared fields identical
  assert.deepEqual(
    mergeCompatible({ ean: '5701234', name: 'Mælk', tags: ['øko', 'køl'] },
                    { ean: '5701234', price: 12.5, tags: ['køl', 'øko'] }),
    { ean: '5701234', name: 'Mælk', tags: ['øko', 'køl'], price: 12.5 }
  );

  // 2. _id and hash ignored by default; first doc's values kept
  assert.deepEqual(
    mergeCompatible(
      { _id: { $oid: 'aaa' }, hash: 'h1', name: 'Mælk' },
      { _id: { $oid: 'bbb' }, hash: 'h2', name: 'Mælk', price: 12 }
    ),
    { _id: { $oid: 'aaa' }, hash: 'h1', name: 'Mælk', price: 12 }
  );

  // 3. With ignoreKeys disabled, differing hash IS a conflict
  assert.throws(
    () => mergeCompatible({ hash: 'h1' }, { hash: 'h2' }, { ignoreKeys: [] }),
    MergeConflictError
  );

  // 4. Reordered keys / reordered arrays-of-objects
  assert.deepEqual(
    mergeCompatible({ a: { x: 1, y: 2 } }, { a: { y: 2, x: 1 }, b: 3 }),
    { a: { x: 1, y: 2 }, b: 3 }
  );
  assert.deepEqual(
    mergeCompatible({ v: [{ p: 1, q: 2 }, { r: 3 }] },
                    { v: [{ r: 3 }, { q: 2, p: 1 }], extra: true }),
    { v: [{ p: 1, q: 2 }, { r: 3 }], extra: true }
  );

  // 5. Multiset semantics; content differences and scalars conflict, with path
  assert.throws(() => mergeCompatible({ v: [1, 1, 2] }, { v: [1, 2, 2] }), MergeConflictError);
  assert.throws(() => mergeCompatible({ t: ['a', 'b'] }, { t: ['a', 'b', 'c'] }), MergeConflictError);
  try {
    mergeCompatible({ a: { price: 10 } }, { a: { price: 12 } });
    assert.fail('should have thrown');
  } catch (e) { assert.equal(e.path, '$.a.price'); }

  // 6. null vs missing
  assert.deepEqual(mergeCompatible({ a: 1 }, { a: 1, b: null }), { a: 1, b: null });
  assert.throws(() => mergeCompatible({ b: null }, { b: 2 }), MergeConflictError);

  // 7. BSON safety: live Date/class instances FAIL LOUD; EJSON forms compare fine
  assert.throws(() => equalUnordered(new Date(1), new Date(2)), TypeError);
  assert.equal(equalUnordered({ $date: '2026-01-01' }, { $date: '2026-02-02' }), false);
  assert.equal(equalUnordered({ $date: '2026-01-01' }, { $date: '2026-01-01' }), true);

  // 8. NaN / Infinity distinct tokens
  assert.equal(equalUnordered(NaN, null), false);
  assert.equal(equalUnordered(NaN, NaN), true);
  assert.equal(equalUnordered(Infinity, -Infinity), false);

  // 9. Identity guard
  assert.equal(canMerge({ a: 1 }, { b: 2 }, { requireSharedKeys: ['gtin'] }), false);
  assert.equal(canMerge({ gtin: 5, a: 1 }, { gtin: 5, b: 2 }, { requireSharedKeys: ['gtin'] }), true);
  assert.equal(canMerge({ gtin: 5 }, { gtin: 6 }, { requireSharedKeys: ['gtin'] }), false);

  // 10. collectConflicts finds all, respecting ignoreKeys
  const cs = collectConflicts({ hash: 'x', p: 1, q: [1, 2] }, { hash: 'y', p: 2, q: [1, 3] });
  assert.deepEqual(cs.map((c) => c.path).sort(), ['$.p', '$.q']);

  // 11. Content-growing merge runs finalize and counts as merged
  const s11 = {};
  const grown = reduceCompatible(
    [{ hash: 'ha', id: 1, p: 1 }, { hash: 'hb', id: 1, q: 2 }],
    { stats: s11, finalize: (d) => ({ ...d, hash: 'RECOMPUTED' }) }
  );
  assert.equal(grown.length, 1);
  assert.equal(grown[0].hash, 'RECOMPUTED');
  assert.deepEqual({ m: s11.merged, a: s11.absorbed }, { m: 1, a: 0 });

  // 12. Subset absorption does NOT run finalize; survivor's valid hash kept
  const s12 = {};
  const absorbed = reduceCompatible(
    [{ hash: 'VALID', id: 1, name: 'x', extra: true }, { hash: 'h2', id: 1, name: 'x' }],
    { stats: s12, finalize: () => { throw new Error('finalize must not run'); } }
  );
  assert.equal(absorbed.length, 1);
  assert.equal(absorbed[0].hash, 'VALID');
  assert.deepEqual({ m: s12.merged, a: s12.absorbed, d: s12.exactDuplicates }, { m: 0, a: 1, d: 0 });

  // 13. Exact-duplicate provenance is deterministic: same survivor either order
  const X1 = { hash: 'zz', id: 1, name: 'x' };
  const X2 = { hash: 'aa', id: 1, name: 'x' };
  assert.equal(
    JSON.stringify(reduceCompatible([X1, X2], {})),
    JSON.stringify(reduceCompatible([X2, X1], {}))
  );
  // ...and input-order-first survives with deterministic: false
  assert.equal(reduceCompatible([X1, X2], { deterministic: false })[0].hash, 'zz');

  // 14. Ambiguity: kept by default (stable residue), merged with 'first'
  const A = { k: 1, x: 1 }, B = { k: 1, x: 2 }, C = { k: 1 };
  const s14 = {};
  assert.equal(reduceCompatible([A, B, C], { stats: s14 }).length, 3);
  assert.equal(s14.ambiguous, 1);
  assert.equal(reduceCompatible([A, B, C], { ambiguous: 'first' }).length, 2);

  // 15. Whole-result determinism regardless of input order
  assert.equal(
    JSON.stringify(reduceCompatible([A, B, C], {})),
    JSON.stringify(reduceCompatible([B, C, A], {}))
  );

  // 16. isUnionWitness: true only for strict containment, not hash-coercion
  assert.equal(isUnionWitness(
    { hash: 'H', a: 1, b: 2, c: 3 },
    [{ hash: 'h1', a: 1, b: 2 }, { hash: 'h2', a: 1, c: 3 }]
  ), true);
  assert.equal(isUnionWitness({ a: 1, b: 2 }, [{ a: 1, c: 3 }]), false); // grows
  assert.equal(isUnionWitness({ v: '12' }, [{ v: 12 }]), false);         // coercion-only
  assert.equal(isUnionWitness({ v: ' x ' }, [{ v: 'x' }]), false);       // trim-only

  // 17. Ignored live metadata is stripped before strict comparisons. The same
  // unsupported value in semantic content must still fail loudly.
  class ObjectIdLike { constructor(value) { this.value = value; } }
  assert.equal(isUnionWitness(
    { _id: new ObjectIdLike('destination'), id: 1, name: 'x' },
    [{ _id: new ObjectIdLike('source'), id: 1, name: 'x' }],
    { ignoreKeys: ['_id', 'hash'], requireSharedKeys: ['id'] }
  ), true);
  assert.throws(() => canMerge(
    { id: 1, value: new ObjectIdLike('destination') },
    { id: 1, value: new ObjectIdLike('source') },
    { requireSharedKeys: ['id'] }
  ), TypeError);

  console.log('All tests passed');
}
