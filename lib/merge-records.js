import { createRequire } from "node:module";
import cleaner from "fast-clean";
import { hasher } from "node-object-hash";

const require = createRequire(import.meta.url);
const kernel = require("./merge-compatible.cjs");
const hashPackage = require("node-object-hash/package.json");

const {
  canMerge,
  canonicalKey,
  contentKey,
  isUnionWitness,
  mergeCompatible,
} = kernel;

export const EXPECTED_HASHER_VERSION = "3.1.1";
export const DEFAULT_IGNORE_KEYS = ["_id", "hash", "normalizeProcessed"];

export function assertHasherVersion() {
  if (hashPackage.version !== EXPECTED_HASHER_VERSION) {
    throw new Error(
      `node-object-hash ${EXPECTED_HASHER_VERSION} is required; found ${hashPackage.version}`,
    );
  }
}

export function createProductHasher() {
  assertHasherVersion();
  return hasher({
    sort: {
      array: true,
      typedArray: true,
      object: true,
      set: true,
      map: true,
      bigint: true,
    },
    coerce: true,
    trim: true,
  });
}

export function normalizeString(input) {
  return input
    .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .split(/(\r?\n)/)
    .map((part, index) =>
      index % 2 === 0 ? part.replace(/[^\S\n]+/g, " ").trim() : part,
    )
    .join("");
}

export function normalizeWhitespace(value, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === "string") return normalizeString(value);
  if (typeof value !== "object") return value;
  if (seen.has(value)) return value;

  if (
    value instanceof Date ||
    value instanceof RegExp ||
    value instanceof Map ||
    value instanceof Set ||
    value instanceof Promise ||
    value instanceof Error
  ) {
    return value;
  }

  seen.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      value[index] = normalizeWhitespace(value[index], seen);
    }
  } else {
    for (const key of Object.keys(value)) {
      value[key] = normalizeWhitespace(value[key], seen);
    }
  }
  seen.delete(value);
  return value;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function parseStringifiedJSON(value, seen = new WeakSet()) {
  if (typeof value === "string") {
    try {
      return parseStringifiedJSON(JSON.parse(value), seen);
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) {
    return value.map((item) => parseStringifiedJSON(item, seen));
  }
  if (!isPlainObject(value)) return value;
  if (seen.has(value)) return value;

  seen.add(value);
  const result = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      parseStringifiedJSON(item, seen),
    ]),
  );
  seen.delete(value);
  return result;
}

export async function prepareDocument(
  source,
  {
    cleanEmptyValues = true,
    normalize = true,
    parseJSONStrings = false,
  } = {},
) {
  let doc = { ...source };
  delete doc._id;
  delete doc.hash;
  delete doc.normalizeProcessed;

  if (parseJSONStrings) doc = parseStringifiedJSON(doc);
  if (normalize) doc = normalizeWhitespace(doc);
  if (cleanEmptyValues) {
    doc = await cleaner.clean(doc, {
      nullCleaner: true,
      emptyArraysCleaner: true,
      emptyObjectsCleaner: true,
      emptyStringsCleaner: true,
      nanCleaner: true,
    });
  }
  return doc;
}

export function hashDocument(doc, productHasher) {
  const copy = { ...doc };
  delete copy._id;
  delete copy.hash;
  delete copy.normalizeProcessed;
  return productHasher.hash(copy);
}

function combineUnique(left, right, key = String) {
  const result = [...left];
  const seen = new Set(left.map(key));
  for (const value of right) {
    const valueKey = key(value);
    if (!seen.has(valueKey)) {
      seen.add(valueKey);
      result.push(value);
    }
  }
  return result;
}

function combineRecords(left, right, doc) {
  return {
    doc,
    sourceIds: combineUnique(left.sourceIds, right.sourceIds),
    sourceDocs: [...left.sourceDocs, ...right.sourceDocs],
  };
}

export function reduceCompatibleRecords(records, opts = {}) {
  const stats = opts.stats ?? {};
  stats.input = records.length;
  stats.exactDuplicates = 0;
  stats.merged = 0;
  stats.absorbed = 0;
  stats.ambiguous = 0;
  const deterministic = opts.deterministic !== false;

  const byContent = new Map();
  const order = [];
  for (const record of records) {
    const ck = contentKey(record.doc, opts);
    const kept = byContent.get(ck);
    if (!kept) {
      byContent.set(ck, { record });
      order.push(ck);
      continue;
    }

    stats.exactDuplicates += 1;
    let survivor = kept.record;
    let duplicate = record;
    if (deterministic && canonicalKey(record.doc) < canonicalKey(kept.record.doc)) {
      survivor = record;
      duplicate = kept.record;
    }
    kept.record = combineRecords(survivor, duplicate, survivor.doc);
  }

  const unique = order.map((ck) => ({ record: byContent.get(ck).record, ck }));
  if (deterministic) {
    unique.sort((left, right) =>
      left.ck < right.ck ? -1 : left.ck > right.ck ? 1 : 0,
    );
  }

  const result = [];
  for (const { record } of unique) {
    const compatibleIndexes = [];
    for (
      let index = 0;
      index < result.length && compatibleIndexes.length < 2;
      index++
    ) {
      if (canMerge(result[index].doc, record.doc, opts)) {
        compatibleIndexes.push(index);
      }
    }

    if (compatibleIndexes.length === 0) {
      result.push(record);
      continue;
    }

    if (compatibleIndexes.length === 1 || opts.ambiguous === "first") {
      if (compatibleIndexes.length > 1) stats.ambiguous += 1;
      const index = compatibleIndexes[0];
      const before = result[index];
      const mergedDoc = mergeCompatible(before.doc, record.doc, opts);
      if (contentKey(mergedDoc, opts) === contentKey(before.doc, opts)) {
        stats.absorbed += 1;
      } else {
        stats.merged += 1;
      }
      result[index] = combineRecords(before, record, mergedDoc);
      continue;
    }

    stats.ambiguous += 1;
    result.push(record);
  }

  stats.output = result.length;
  return result;
}

export function getValueByPath(doc, path) {
  let value = doc;
  for (const part of path.split(".")) {
    if (value === null || typeof value !== "object") return undefined;
    value = value[part];
  }
  return value;
}

export function sameScalarValue(left, right) {
  return typeof left === typeof right && Object.is(left, right);
}

function groupToken(value, groupKey) {
  if (value === undefined || value === null) return undefined;
  if (!["string", "number", "bigint", "boolean"].includes(typeof value)) {
    throw new TypeError(
      `Merge group key ${groupKey} must be scalar; received ${value?.constructor?.name ?? typeof value}`,
    );
  }
  return canonicalKey(value);
}

export async function* groupSortedDocuments(iterable, groupKey) {
  let currentToken;
  let currentValue;
  let documents = [];

  for await (const doc of iterable) {
    const value = getValueByPath(doc, groupKey);
    const token = groupToken(value, groupKey);

    if (token === undefined) {
      if (documents.length > 0) {
        yield { key: currentValue, documents };
        documents = [];
        currentToken = undefined;
        currentValue = undefined;
      }
      yield { key: undefined, documents: [doc] };
      continue;
    }

    if (documents.length > 0 && token !== currentToken) {
      yield { key: currentValue, documents };
      documents = [];
    }
    currentToken = token;
    currentValue = value;
    documents.push(doc);
  }

  if (documents.length > 0) yield { key: currentValue, documents };
}

function duplicateKeyCode(error) {
  return error?.code ?? error?.errorResponse?.code ?? error?.writeError?.code;
}

export async function persistReducedGroup({
  destination,
  source,
  records,
  witnessOptions,
}) {
  let inserted = 0;
  let alreadyExisted = 0;

  for (const record of records) {
    try {
      await destination.insertOne(record.doc);
      inserted += 1;
    } catch (error) {
      if (duplicateKeyCode(error) !== 11000) throw error;
      alreadyExisted += 1;
    }

    const existing = await destination.findOne({ hash: record.doc.hash });
    if (!existing) {
      throw new Error(
        `Destination verification failed: hash ${record.doc.hash} was not found after insert`,
      );
    }
    if (!isUnionWitness(existing, record.sourceDocs, witnessOptions)) {
      throw new Error(
        `Unsafe duplicate hash ${record.doc.hash}: destination is not a strict union witness`,
      );
    }
  }

  const sourceIds = combineUnique(
    [],
    records.flatMap((record) => record.sourceIds),
  );
  const deletion = await source.deleteMany({ _id: { $in: sourceIds } });
  if (deletion.deletedCount !== sourceIds.length) {
    throw new Error(
      `Source deletion count mismatch: expected ${sourceIds.length}, deleted ${deletion.deletedCount}`,
    );
  }

  return {
    inserted,
    alreadyExisted,
    deleted: deletion.deletedCount,
  };
}

export { isUnionWitness };
