"use strict";

import { MongoClient } from "mongodb";
import { BSON } from "bson";
import { hasher } from "node-object-hash";
import cleaner from "fast-clean";
import sortKeysRecursive from "sort-keys-recursive";
import { reassembleStringifiedJSON } from "../functions/reassembleStringifiedJSON.js";
import { cleanFillop } from "../functions/cleanFillop.js";
import { cleanFoetexPlus } from "../functions/cleanFoetexPlus.js";
import { cleanHjemmelevering } from "../functions/cleanHjemmelevering.js";
import { cleanKoeboghent } from "../functions/cleanKoeboghent.js";
import { cleanNettoEAN } from "../functions/cleanNettoEAN.js";
import { cleanNettoGtin } from "../functions/cleanNettoGtin.js";

const uniqueCodes = new Set();

class BaseProductDatabase {
  static dbName;
  static collName;
  static db;
  static collection;
  static collection2;
  static currentName;
  static hashSortCoerce;
  static cleanerOptions;
  static totalInserted = 0;
  static isImagesCollection = false;
  static client;
  static client2;
  static db2;

  static async getMongoDBURL(username) {
    let url = null;
    switch (username) {
      default:
        url = "mongodb://127.0.0.1:27017/";
    }

    return url;
  }

  static async initialize(
    dbName,
    collName = "products",
    newCollName = collName + "0",
  ) {
    this.hashSortCoerce = hasher({
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
    this.cleanerOptions = {
      nullCleaner: true,
      emptyArraysCleaner: true,
      emptyObjectsCleaner: true,
      emptyStringsCleaner: true,
      nanCleaner: true,
    };

    if (collName.includes("images")) {
      this.isImagesCollection = true;
    } else {
      this.isImagesCollection = false;
    }

    const url = await this.getMongoDBURL("default");
    await this.connectToDatabase(url);
    this.dbName = dbName;
    this.collName = newCollName;
    this.db = this.client.db(this.dbName);
    this.db2 = (this.client2 ?? this.client).db(this.dbName);
    this.currentName = collName;
    this.collection = await this.db.collection(this.currentName, {
      enableUtf8Validation: false,
    });
    this.collection2 = await this.db2.collection(this.collName);
    await this.createIndexes();
    console.log("Current database:", this.dbName);
    console.log("Current shop:", this.currentName);
    console.log("New collection:", this.collName);
  }

  static async createIndexes() {
    if (this.isImagesCollection) {
      await this.collection2.createIndex(
        { hashedName: 1, hashedUrl: 1 },
        { unique: true, sparse: true }
      );
      return;
    }

    // await this.collection.createIndex({ hash: 1 }, { unique: true, sparse: true });
    // await this.collection.createIndex({ "$**": "text" }, { name: "TextIndex" });

    await this.collection2.createIndex({ hash: 1 }, { unique: true, sparse: true });
    // await this.collection2.createIndex({ "$**": "text" }, { name: "TextIndex" });
  }

  static async connectToDatabase(url) {
    throw new Error("connectToDatabase must be implemented by subclass");
  }

  static async getAllCollectionNames(dbName) {
    const url = await this.getMongoDBURL("default");
    const rawClient = new MongoClient(url, { enableUtf8Validation: false });
    const db = rawClient.db(dbName);

    const collections = await db.listCollections().toArray();
    await rawClient.close();
    return collections.map(({ name }) => name);
  }

  static async getHashValueOfObject(originalObject) {
    const copy = { ...originalObject };
    delete copy._id;
    delete copy.hash;
    delete copy.normalizeProcessed;

    return this.hashSortCoerce.hash(copy);
  }

  static normalizeString(input) {
    return (
      input
        // 1) Normalize a broad set of "spacey" characters to regular space
        .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, " ")
        // 2) Remove zero-width / BOM-like characters
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        // 3) Preserve line endings exactly, but clean each text segment
        .split(/(\r?\n)/) // keep the separators as separate elements
        .map((part, i) =>
          // even indices = text between newlines, odd = the newline itself
          i % 2 === 0
            ? // collapse non-newline whitespace runs, then trim edges
            part.replace(/[^\S\n]+/g, " ").trim()
            : part,
        )
        .join("")
    );
  }

  static normalizeWhitespace(obj) {
    const seen = new WeakSet();

    const inner = (value) => {
      if (value == null) return value;

      if (typeof value === "string") {
        return this.normalizeString(value);
      }

      if (typeof value !== "object") {
        return value;
      }

      if (seen.has(value)) {
        return value; // avoid infinite recursion on cycles
      }
      seen.add(value);

      // Skip built-ins: we don't try to clean inside them
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

      if (Array.isArray(value)) {
        // mutate in place to preserve identity & prototypes
        for (let i = 0; i < value.length; i++) {
          value[i] = inner(value[i]);
        }
        return value;
      }

      // Any other object (including class instances) – mutate in place
      for (const key of Object.keys(value)) {
        value[key] = inner(value[key]);
      }
      // If you care about symbol keys as well, uncomment:
      // for (const sym of Object.getOwnPropertySymbols(value)) {
      //   value[sym] = inner(value[sym]);
      // }

      return value;
    };

    return inner(obj);
  }

  static isEmpty(value) {
    return (
      value === "" ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0) ||
      (value instanceof Map && value.size === 0) ||
      (value instanceof Set && value.size === 0) ||
      (typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype &&
        Object.keys(value).length === 0)
    );
  }

  static isNull(value) {
    return value === null || value === undefined;
  }

  static isNotNull(value) {
    return !this.isNull(value);
  }

  static isFalse(value) {
    return (
      value === false ||
      value === 0 ||
      value === undefined ||
      value === null ||
      value === "0" ||
      value === "false"
    );
  }

  static isNotNumber(value) {
    return Number.isNaN(value);
  }

  static removeWebArchiveUrls(obj) {
    if (typeof obj === "string") {
      // Match and remove Web Archive prefix from URLs
      return obj.replace(/https?:\/\/web\.archive\.org\/web\/\d+\//gi, "");
    } else if (Array.isArray(obj)) {
      return obj.map((item) => this.removeWebArchiveUrls(item));
    } else if (typeof obj === "object" && obj !== null) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.removeWebArchiveUrls(value);
      }
      return result;
    }
    return obj;
  }

  static isObjectEmpty(obj) {
    if (obj === null || obj === undefined) return true;

    if (typeof obj !== "object") return false;

    if (Array.isArray(obj)) return obj.length === 0;

    const keys = Object.keys(obj);
    if (keys.length === 0) return true;

    return keys.every((key) => this.isObjectEmpty(obj[key]));
  }

  static areObjectsIdentical(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== typeof obj2) return false;

    if (typeof obj1 !== "object") return obj1 === obj2;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.areObjectsIdentical(obj1[key], obj2[key])) return false;
    }

    return true;
  }

  static parseStringifiedJSON(input, seen = new WeakSet()) {
    if (typeof input === "string") {
      try {
        return this.parseStringifiedJSON(JSON.parse(input), seen);
      } catch {
        return input;
      }
    } else if (Array.isArray(input)) {
      return input.map((item) => this.parseStringifiedJSON(item, seen));
    } else if (typeof input === "object" && input !== null) {
      if (seen.has(input)) {
        return input;
      }
      seen.add(input);
      const result = Object.fromEntries(
        Object.entries(input).map(([key, value]) => [
          key,
          this.parseStringifiedJSON(value, seen),
        ]),
      );
      seen.delete(input);
      return result;
    }
    return input;
  }

  static async cleanObjects(query) {
    throw new Error("cleanObjects must be implemented by subclass");
  }

  static async insertAll(batchOrIds, docsArg) {
    const batch = Array.isArray(batchOrIds)
      ? {
        ids: batchOrIds,
        validIds: batchOrIds,
        invalidIds: [],
        invalidCount: 0,
        docs: docsArg,
      }
      : {
        ids: batchOrIds?.ids,
        validIds: batchOrIds?.validIds,
        invalidIds: batchOrIds?.invalidIds,
        invalidCount: batchOrIds?.invalidCount,
        docs: batchOrIds?.docs,
      };
    const ids = Array.isArray(batch.ids) ? batch.ids : [];
    const invalidIds = Array.isArray(batch.invalidIds) ? batch.invalidIds : [];
    const invalidIdKeys = new Set(invalidIds.map((id) => String(id)));
    const validIds = Array.isArray(batch.validIds) && batch.validIds.length > 0
      ? batch.validIds
      : ids.filter((id) => !invalidIdKeys.has(String(id)));
    const invalidCount = batch.invalidCount ?? invalidIds.length;
    const docs = batch.docs;
    const metrics = {
      insertedCount: 0,
      duplicateCount: 0,
      otherErrorCount: 0,
      writeConcernFailed: false,
      safe: true,
      t_insert_ms: 0,
      t_delete_ms: 0,
      deletedCount: 0,
      validDeleted: 0,
      invalidDeleted: 0,
    };

    if (docs === undefined) {
      return metrics;
    }

    if (docs.length === 0 && ids.length > 0) {
      const invalidTotal = invalidCount || ids.length;
      console.log(`insert skipped: all ${invalidTotal} docs invalid replacement-char docs`);
      const deleteStartedAt = Date.now();
      const invalidDeleteIds = invalidIds.length > 0 ? invalidIds : ids;
      // Safe by policy: replacement-char docs are intentionally purged, not migrated.
      const deletions = await this.collection.deleteMany({ _id: { $in: invalidDeleteIds } });
      metrics.t_delete_ms = Date.now() - deleteStartedAt;
      metrics.deletedCount = deletions.deletedCount;
      metrics.invalidDeleted = deletions.deletedCount;
      console.log("deleted invalid source docs:", deletions.deletedCount);
      return metrics;
    }

    if (docs.length === 0) {
      return metrics;
    }

    let objects = [];
    for (let doc of docs) {
      let prod = doc;
      
      // prod["hash"] = await this.getHashValueOfObject(prod);
      // prod = this.parseStringifiedJSON(prod);
      // prod = this.normalizeWhitespace(prod);
      // prod = await cleaner.clean(prod, this.cleanerOptions);
      // prod = await sortKeysRecursive(prod);

      objects.push(prod);
    }

    const getInsertedCount = (result) => {
      if (Number.isFinite(result?.insertedCount)) {
        return result.insertedCount;
      }
      if (Number.isFinite(result?.result?.insertedCount)) {
        return result.result.insertedCount;
      }
      return 0;
    };
    const getWriteErrors = (error) => {
      if (error?.writeErrors instanceof Map) {
        return Array.from(error.writeErrors.values());
      }
      if (Array.isArray(error?.writeErrors)) {
        return error.writeErrors;
      }
      if (error?.writeErrors) {
        return [error.writeErrors];
      }
      return [];
    };
    const getWriteConcernError = (error) => {
      if (error?.writeConcernError) {
        return error.writeConcernError;
      }
      if (error?.err) {
        return error.err;
      }
      return error?.result?.getWriteConcernError?.();
    };
    const normalizeWriteError = (writeError) => (
      Array.isArray(writeError) ? writeError[1] : writeError
    );
    const getWriteErrorCode = (writeError) => {
      const error = normalizeWriteError(writeError);
      const json = error?.toJSON?.();
      return (
        error?.code ??
        error?.err?.code ??
        error?.errorResponse?.code ??
        error?.writeError?.code ??
        json?.code
      );
    };
    const getWriteErrorMessage = (writeError) => {
      const error = normalizeWriteError(writeError);
      const json = error?.toJSON?.();
      return (
        error?.errmsg ??
        error?.err?.errmsg ??
        error?.message ??
        error?.errorResponse?.errmsg ??
        json?.errmsg ??
        json?.message
      );
    };
    const getExistingHashCount = async (candidates) => {
      if (this.isImagesCollection) {
        return { checked: false, existingCount: 0, expectedCount: 0 };
      }

      const hashes = [...new Set(candidates.map((candidate) => candidate?.hash).filter(Boolean))];
      if (hashes.length === 0) {
        return { checked: false, existingCount: 0, expectedCount: 0 };
      }

      const existingHashes = await this.collection2
        .find({ hash: { $in: hashes } })
        .project({ _id: 0, hash: 1 })
        .toArray();
      const existingHashValues = existingHashes.map((doc) => {
        if (!Buffer.isBuffer(doc)) {
          return doc?.hash;
        }

        return BSON.deserialize(doc, {
          validation: {
            utf8: {
              writeErrors: true,
            },
          },
        })?.hash;
      });
      return {
        checked: true,
        existingCount: new Set(existingHashValues.filter(Boolean)).size,
        expectedCount: hashes.length,
      };
    };
    const summarizeWriteErrorShape = (writeError) => {
      const error = normalizeWriteError(writeError);
      const summary = {
        type: typeof error,
        constructorName: error?.constructor?.name,
        isArray: Array.isArray(error),
        isBuffer: Buffer.isBuffer(error),
        ownKeys: error && typeof error === "object"
          ? Reflect.ownKeys(error).map((key) => String(key))
          : [],
        prototypeKeys: error && typeof error === "object"
          ? Reflect.ownKeys(Object.getPrototypeOf(error) ?? {}).map((key) => String(key))
          : [],
        code: error?.code,
        errCode: error?.err?.code,
        errorResponseCode: error?.errorResponse?.code,
        jsonCode: error?.toJSON?.()?.code,
        stringValue: String(error),
      };

      if (Buffer.isBuffer(error)) {
        try {
          const decoded = BSON.deserialize(error, {
            validation: {
              utf8: {
                writeErrors: true,
              },
            },
          });
          summary.decoded = {
            keys: Object.keys(decoded),
            code: decoded?.code,
            errmsg: decoded?.errmsg,
            message: decoded?.message,
            index: decoded?.index,
            opKeys: decoded?.op && typeof decoded.op === "object"
              ? Object.keys(decoded.op)
              : undefined,
          };
        } catch (decodeError) {
          summary.decodeError = decodeError?.message;
        }
      }

      return summary;
    };

    const insertStartedAt = Date.now();
    try {
      const insertions = await this.collection2.insertMany(objects, { ordered: false });
      metrics.insertedCount = getInsertedCount(insertions);
    } catch (error) {
      metrics.insertedCount = getInsertedCount(error);

      if (error?.name !== "MongoBulkWriteError") {
        metrics.safe = false;
        metrics.otherErrorCount = 1;
        metrics.t_insert_ms = Date.now() - insertStartedAt;
        console.log("[delete skipped] Bulk insert failed before source delete. Source documents were kept.", {
          name: error?.name,
          message: error?.message,
        });
        return metrics;
      }

      const writeErrors = getWriteErrors(error);
      metrics.duplicateCount = writeErrors.filter((writeError) => getWriteErrorCode(writeError) === 11000).length;
      metrics.otherErrorCount = writeErrors.length - metrics.duplicateCount;
      metrics.writeConcernFailed = getWriteConcernError(error) !== undefined;
      metrics.safe = (
        writeErrors.length > 0 &&
        metrics.otherErrorCount === 0 &&
        !metrics.writeConcernFailed
      );

      const hasUnclassifiedWriteErrors = writeErrors.some((writeError) => getWriteErrorCode(writeError) === undefined);
      let existingHashCheck = { checked: false, existingCount: 0, expectedCount: 0 };
      if (!metrics.safe && !metrics.writeConcernFailed && hasUnclassifiedWriteErrors) {
        existingHashCheck = await getExistingHashCount(objects);
        if (existingHashCheck.checked && existingHashCheck.existingCount === existingHashCheck.expectedCount) {
          metrics.duplicateCount = writeErrors.length;
          metrics.otherErrorCount = 0;
          metrics.safe = true;
          console.log(
            `[duplicates ok] ${metrics.duplicateCount} cleaned objects already existed in target collection by hash fallback`
          );
        }
      }

      if (!metrics.safe) {
        metrics.t_insert_ms = Date.now() - insertStartedAt;
        this.totalInserted += metrics.insertedCount;
        console.log("[delete skipped] Bulk insert had non-duplicate or write-concern errors. Source documents were kept.", {
          insertedCount: metrics.insertedCount,
          duplicateCount: metrics.duplicateCount,
          otherErrorCount: metrics.otherErrorCount,
          writeConcernFailed: metrics.writeConcernFailed,
          writeErrorCount: writeErrors.length,
          firstWriteErrorCode: getWriteErrorCode(writeErrors[0]),
          firstWriteErrorMessage: getWriteErrorMessage(writeErrors[0]),
          firstWriteErrorShape: summarizeWriteErrorShape(writeErrors[0]),
          existingHashCheck,
        });
        return metrics;
      }

      console.log(`[duplicates ok] ${metrics.duplicateCount} cleaned objects already existed in target collection`);
    }
    metrics.t_insert_ms = Date.now() - insertStartedAt;

    console.log("Insertions:", metrics.insertedCount);
    this.totalInserted += metrics.insertedCount;

    const deleteStartedAt = Date.now();
    if (validIds.length > 0) {
      const deletions = await this.collection.deleteMany({ _id: { $in: validIds } });
      metrics.validDeleted = deletions.deletedCount;
      metrics.deletedCount += deletions.deletedCount;
      console.log("Deleted valid source documents:", deletions.deletedCount);
    }

    if (invalidIds.length > 0) {
      const invalidDeletions = await this.collection.deleteMany({ _id: { $in: invalidIds } });
      metrics.invalidDeleted = invalidDeletions.deletedCount;
      metrics.deletedCount += invalidDeletions.deletedCount;
      console.log("deleted invalid source docs:", invalidDeletions.deletedCount);
    }
    metrics.t_delete_ms = Date.now() - deleteStartedAt;
    return metrics;
  }

  static async closeDatabase() {
    // Check if the original collection is empty
    if (this.collection && this.collection2) {
      const count = await this.collection.estimatedDocumentCount();
      console.log(
        `Original collection ${this.currentName} estimated count: ${count}`
      );
      const count2 = await this.collection.countDocuments();
      console.log(`Original collection ${this.currentName} count: ${count2}`);
      if (count === 0 && count2 === 0) {
        console.log(`Dropping empty collection ${this.currentName}`);
        await this.collection.drop();

        // Check if new collection name ends with '0' and rename it
        const newCollName = this.collection2.collectionName;
        if (newCollName.endsWith("0")) {
          const renamedCollName = newCollName.slice(0, -1);
          console.log(
            `Renaming collection ${newCollName} to ${renamedCollName}`
          );
          await this.collection2.rename(renamedCollName);
        }
      }

      const count3 = await this.collection2.estimatedDocumentCount();
      console.log(`New collection ${this.collName} estimated count: ${count3}`);
      const count4 = await this.collection2.countDocuments();
      console.log(`New collection ${this.collName} count: ${count4}`);

      if (count3 === 0 && count4 === 0) {
        console.log(`Dropping empty collection ${this.collName}`);
        await this.collection2.drop();
      }
    }

    await this.client?.close();
    if (this.client2 && this.client2 !== this.client) {
      await this.client2.close();
    }

    if (uniqueCodes.size > 0) {
      console.log(
        "Unique codes found in large infos arrays:",
        Array.from(uniqueCodes)
      );
    }

    console.log("Database closed!");
    console.log(
      `${this.totalInserted} documents inserted from ${this.currentName} to ${this.collName} in ${this.dbName}`
    );
    this.totalInserted = 0;
    return;
  }
}

export { BaseProductDatabase, uniqueCodes };
