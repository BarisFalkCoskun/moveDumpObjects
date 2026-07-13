import { MongoClient } from "mongodb";
import {
  DEFAULT_IGNORE_KEYS,
  assertHasherVersion,
  createProductHasher,
  groupSortedDocuments,
  hashDocument,
  getValueByPath,
  persistReducedGroup,
  prepareDocument,
  reduceCompatibleRecords,
  sameScalarValue,
} from "../lib/merge-records.js";

// This mode is deliberately separate from app/index.js. Edit these defaults or
// override the string values with MERGE_DB, MERGE_SOURCE, MERGE_DESTINATION,
// MERGE_GROUP_KEY, and MERGE_IDENTITY_KEYS. Nothing is written unless
// MERGE_APPLY=1 is explicitly set.
const config = {
  mongoUrl: "mongodb://127.0.0.1:27017/",
  dbName: process.env.MERGE_DB ?? "hjemmelevering",
  sourceCollection: process.env.MERGE_SOURCE ?? "products",
  destinationCollection: process.env.MERGE_DESTINATION ?? "productsMerged",
  query: {},
  groupKey: process.env.MERGE_GROUP_KEY ?? "id",
  identityKeys: (process.env.MERGE_IDENTITY_KEYS ?? "id,mainGTIN")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  dryRun: process.env.MERGE_APPLY !== "1",
  createSourceIndexOnApply: true,
  normalizeWhitespace: true,
  cleanEmptyValues: true,
  parseStringifiedJSON: false,
  cursorBatchSize: 1000,
  progressEveryDocuments: 10000,
  changedGroupLogLimit: 30,
};

function indexStartsWith(index, field) {
  return Object.keys(index.key ?? {})[0] === field;
}

function printableKey(value) {
  if (value === undefined) return "<missing>";
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

async function run() {
  assertHasherVersion();
  if (config.sourceCollection === config.destinationCollection) {
    throw new Error("Source and destination collections must be different");
  }
  if (!config.identityKeys.includes(config.groupKey)) {
    throw new Error("The merge group key must also be listed in identityKeys");
  }

  const client = new MongoClient(config.mongoUrl, { enableUtf8Validation: false });
  await client.connect();

  try {
    const db = client.db(config.dbName);
    const source = db.collection(config.sourceCollection);
    const destination = db.collection(config.destinationCollection);
    const productHasher = createProductHasher();

    const sourceIndexes = await source.listIndexes().toArray();
    let hasGroupIndex = sourceIndexes.some((index) =>
      indexStartsWith(index, config.groupKey),
    );

    console.log(
      "[merge-config]",
      JSON.stringify({
        db: config.dbName,
        source: config.sourceCollection,
        destination: config.destinationCollection,
        groupKey: config.groupKey,
        identityKeys: config.identityKeys,
        dryRun: config.dryRun,
        sourceGroupIndexPresent: hasGroupIndex,
      }),
    );

    if (!config.dryRun) {
      if (!hasGroupIndex && config.createSourceIndexOnApply) {
        const safeName = config.groupKey.replace(/[^a-zA-Z0-9_]/g, "_");
        const indexName = `merge_${safeName}_id`;
        console.log(
          "[merge-diagnostic]",
          JSON.stringify({ action: "createSourceIndex", indexName }),
        );
        await source.createIndex(
          { [config.groupKey]: 1, _id: 1 },
          { name: indexName },
        );
        hasGroupIndex = true;
      }
      await destination.createIndex(
        { hash: 1 },
        { unique: true, sparse: true },
      );
    }

    if (!hasGroupIndex) {
      console.log(
        "[merge-diagnostic]",
        JSON.stringify({
          warning: "source group index missing; dry-run sort may use disk",
          groupKey: config.groupKey,
        }),
      );
    }

    const cursor = source
      .find(config.query, { noCursorTimeout: true })
      .sort({ [config.groupKey]: 1, _id: 1 })
      .batchSize(config.cursorBatchSize)
      .allowDiskUse(true);

    const totals = {
      documents: 0,
      groups: 0,
      keyless: 0,
      outputDocuments: 0,
      exactDuplicates: 0,
      merged: 0,
      absorbed: 0,
      ambiguous: 0,
      inserted: 0,
      alreadyExisted: 0,
      deleted: 0,
    };
    let changedGroupsLogged = 0;

    for await (const group of groupSortedDocuments(cursor, config.groupKey)) {
      totals.groups += 1;
      totals.documents += group.documents.length;
      if (group.key === undefined) totals.keyless += group.documents.length;

      const records = [];
      for (const sourceDoc of group.documents) {
        const prepared = await prepareDocument(sourceDoc, {
          cleanEmptyValues: config.cleanEmptyValues,
          normalize: config.normalizeWhitespace,
          parseJSONStrings: config.parseStringifiedJSON,
        });
        const preparedGroupKey = getValueByPath(prepared, config.groupKey);
        if (
          group.key !== undefined &&
          !sameScalarValue(group.key, preparedGroupKey)
        ) {
          throw new Error(
            `Cleaning changed merge group key ${config.groupKey} for source ${sourceDoc._id}; ` +
              "aborting because sorted grouping would no longer be complete",
          );
        }
        records.push({
          doc: prepared,
          sourceIds: [sourceDoc._id],
          sourceDocs: [prepared],
        });
      }

      const stats = {};
      const witnessOptions = {
        ignoreKeys: DEFAULT_IGNORE_KEYS,
        requireSharedKeys:
          group.key === undefined ? [] : config.identityKeys,
        ambiguous: "keep",
        deterministic: true,
        stats,
      };
      const reduced = reduceCompatibleRecords(records, witnessOptions).map(
        (record) => ({
          ...record,
          doc: {
            ...record.doc,
            hash: hashDocument(record.doc, productHasher),
          },
        }),
      );

      totals.outputDocuments += reduced.length;
      totals.exactDuplicates += stats.exactDuplicates;
      totals.merged += stats.merged;
      totals.absorbed += stats.absorbed;
      totals.ambiguous += stats.ambiguous;

      const changed =
        stats.exactDuplicates + stats.merged + stats.absorbed + stats.ambiguous > 0;
      if (changed && changedGroupsLogged < config.changedGroupLogLimit) {
        changedGroupsLogged += 1;
        console.log(
          "[merge-group]",
          JSON.stringify({
            key: printableKey(group.key),
            input: group.documents.length,
            output: reduced.length,
            exactDuplicates: stats.exactDuplicates,
            merged: stats.merged,
            absorbed: stats.absorbed,
            ambiguous: stats.ambiguous,
          }),
        );
      }

      if (!config.dryRun) {
        const persisted = await persistReducedGroup({
          destination,
          source,
          records: reduced,
          witnessOptions,
        });
        totals.inserted += persisted.inserted;
        totals.alreadyExisted += persisted.alreadyExisted;
        totals.deleted += persisted.deleted;
      }

      if (
        totals.documents % config.progressEveryDocuments < group.documents.length
      ) {
        console.log("[merge-progress]", JSON.stringify(totals));
      }
    }

    const fixedPoint =
      totals.exactDuplicates === 0 &&
      totals.merged === 0 &&
      totals.absorbed === 0;
    console.log(
      "[merge-summary]",
      JSON.stringify({ ...totals, fixedPoint, dryRun: config.dryRun }),
    );
    if (config.dryRun) {
      console.log(
        "[merge-dry-run] No documents were inserted or deleted. Set MERGE_APPLY=1 only after reviewing the summary.",
      );
    }
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error("[merge-fatal]", error);
  process.exitCode = 1;
});
