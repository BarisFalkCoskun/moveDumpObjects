import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "bson";
import {
  DEFAULT_IGNORE_KEYS,
  createProductHasher,
  groupSortedDocuments,
  hashDocument,
  isUnionWitness,
  persistReducedGroup,
  prepareDocument,
  reduceCompatibleRecords,
} from "../lib/merge-records.js";

const identityOptions = {
  ignoreKeys: DEFAULT_IGNORE_KEYS,
  requireSharedKeys: ["id", "mainGTIN"],
};

function record(id, doc) {
  return { doc, sourceIds: [id], sourceDocs: [doc] };
}

test("compatible records merge and retain source IDs only in the sidecar", () => {
  const stats = {};
  const reduced = reduceCompatibleRecords(
    [
      record("source-a", { id: "p1", mainGTIN: 1, name: "Pizza" }),
      record("source-b", {
        id: "p1",
        mainGTIN: 1,
        name: "Pizza",
        promoSplashLabel: "End 2 End",
      }),
    ],
    { ...identityOptions, stats },
  );

  assert.equal(reduced.length, 1);
  assert.deepEqual(reduced[0].sourceIds.sort(), ["source-a", "source-b"]);
  assert.equal(reduced[0].doc.promoSplashLabel, "End 2 End");
  assert.equal("mergedFrom" in reduced[0].doc, false);
  assert.equal(stats.merged + stats.absorbed, 1);
});

test("conflicting values remain separate", () => {
  const reduced = reduceCompatibleRecords(
    [
      record("a", { id: "p1", mainGTIN: 1, price: 10 }),
      record("b", { id: "p1", mainGTIN: 1, price: 12 }),
    ],
    identityOptions,
  );
  assert.equal(reduced.length, 2);
});

test("ambiguous records are kept instead of assigned silently", () => {
  const stats = {};
  const reduced = reduceCompatibleRecords(
    [
      record("a", { id: "p1", x: 1 }),
      record("b", { id: "p1", x: 2 }),
      record("c", { id: "p1" }),
    ],
    {
      ignoreKeys: DEFAULT_IGNORE_KEYS,
      requireSharedKeys: ["id"],
      stats,
    },
  );
  assert.equal(reduced.length, 3);
  assert.equal(stats.ambiguous, 1);
});

test("grouping remains complete across asynchronous cursor batches", async () => {
  async function* cursorFixture() {
    yield { _id: 1, id: "a" };
    await Promise.resolve();
    yield { _id: 2, id: "a" };
    await Promise.resolve();
    yield { _id: 3, id: "b" };
  }

  const groups = [];
  for await (const group of groupSortedDocuments(cursorFixture(), "id")) {
    groups.push(group);
  }
  assert.deepEqual(groups.map((group) => group.documents.length), [2, 1]);
});

test("preparation trims whitespace and removes empty fields before hashing", async () => {
  const prepared = await prepareDocument({
    _id: "source",
    id: "p1",
    name: "  Pizza\u00a0  Special  ",
    empty: "",
  });
  assert.equal(prepared.name, "Pizza Special");
  assert.equal("empty" in prepared, false);
  assert.equal("_id" in prepared, false);

  const productHasher = createProductHasher();
  assert.equal(hashDocument(prepared, productHasher), productHasher.hash(prepared));
});

test("coercion-only and trim-only hash twins are not union witnesses", () => {
  assert.equal(isUnionWitness({ v: "12" }, [{ v: 12 }]), false);
  assert.equal(isUnionWitness({ v: " Lambi " }, [{ v: "Lambi" }]), false);
});

test("ignored MongoDB ObjectIds do not enter semantic witness comparisons", () => {
  const semantic = { id: "p1", mainGTIN: 1, name: "Pizza" };
  assert.equal(
    isUnionWitness(
      { _id: new ObjectId(), hash: "destination", ...semantic },
      [{ _id: new ObjectId(), hash: "source", ...semantic }],
      identityOptions,
    ),
    true,
  );
  assert.throws(
    () =>
      isUnionWitness(
        { id: "p1", value: new ObjectId() },
        [{ id: "p1", value: new ObjectId() }],
        identityOptions,
      ),
    /unsupported non-plain object \(ObjectId\)/,
  );
});

test("sources are deleted only after every destination candidate is witnessed", async () => {
  const stored = new Map();
  const destination = {
    async insertOne(doc) {
      if (stored.has(doc.hash)) {
        const error = new Error("duplicate");
        error.code = 11000;
        throw error;
      }
      stored.set(doc.hash, { _id: `dest-${stored.size}`, ...doc });
    },
    async findOne(query) {
      return stored.get(query.hash) ?? null;
    },
  };
  const deleted = [];
  const source = {
    async deleteMany(query) {
      deleted.push(...query._id.$in);
      return { deletedCount: query._id.$in.length };
    },
  };
  const sourceDoc = { id: "p1", mainGTIN: 1, name: "Pizza" };
  const productHasher = createProductHasher();
  const candidate = {
    doc: { ...sourceDoc, hash: hashDocument(sourceDoc, productHasher) },
    sourceIds: ["source-a"],
    sourceDocs: [sourceDoc],
  };

  const result = await persistReducedGroup({
    destination,
    source,
    records: [candidate],
    witnessOptions: identityOptions,
  });
  assert.deepEqual(result, { inserted: 1, alreadyExisted: 0, deleted: 1 });
  assert.deepEqual(deleted, ["source-a"]);
});

test("a strict union witness makes E11000 safe", async () => {
  const productHasher = createProductHasher();
  const first = { id: "p1", mainGTIN: 1, name: "Pizza" };
  const second = { id: "p1", mainGTIN: 1, promoSplashLabel: "End 2 End" };
  const union = { ...first, ...second };
  const hash = hashDocument(union, productHasher);
  const destination = {
    async insertOne() {
      const error = new Error("duplicate");
      error.code = 11000;
      throw error;
    },
    async findOne() {
      return { _id: "existing", ...union, hash };
    },
  };
  let deleted = 0;
  const source = {
    async deleteMany(query) {
      deleted = query._id.$in.length;
      return { deletedCount: deleted };
    },
  };

  const result = await persistReducedGroup({
    destination,
    source,
    records: [
      {
        doc: { ...union, hash },
        sourceIds: ["source-a", "source-b"],
        sourceDocs: [first, second],
      },
    ],
    witnessOptions: identityOptions,
  });
  assert.deepEqual(result, { inserted: 0, alreadyExisted: 1, deleted: 2 });
  assert.equal(deleted, 2);
});

test("unsafe E11000 collision keeps every source document", async () => {
  const productHasher = createProductHasher();
  const sourceDoc = { id: "p1", v: 12 };
  const hash = hashDocument(sourceDoc, productHasher);
  const destination = {
    async insertOne() {
      const error = new Error("duplicate");
      error.code = 11000;
      throw error;
    },
    async findOne() {
      return { id: "p1", v: "12", hash };
    },
  };
  let deleteCalled = false;
  const source = {
    async deleteMany() {
      deleteCalled = true;
      return { deletedCount: 1 };
    },
  };

  await assert.rejects(
    persistReducedGroup({
      destination,
      source,
      records: [
        {
          doc: { ...sourceDoc, hash },
          sourceIds: ["source-a"],
          sourceDocs: [sourceDoc],
        },
      ],
      witnessOptions: { ignoreKeys: DEFAULT_IGNORE_KEYS, requireSharedKeys: ["id"] },
    }),
    /not a strict union witness/,
  );
  assert.equal(deleteCalled, false);
});
