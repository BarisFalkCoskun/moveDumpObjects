"use strict";

import { MongoClient } from "mongodb";
import { BaseProductDatabase } from "./baseMongodb.js";
import { BSON, EJSON } from "bson";

class ProductDatabase extends BaseProductDatabase {
  static async connectToDatabase(url) {
    this.client = new MongoClient(url, { enableUtf8Validation: false, raw: true });
    this.client2 = new MongoClient(url);

    this.client.on("error", function (err) {
      console.log(err);
    });
    this.client2.on("error", function (err) {
      console.log(err);
    });

    await Promise.all([
      this.client.connect(),
      this.client2.connect(),
    ]);
  }

  static async cleanObjects(query, { sortByNewestFirst = false } = {}) {
    console.log("Query:", query);
    console.log("Sort by newest _id first:", sortByNewestFirst);

    while (true) {
      let docs = [];
      let ids = [];
      let validIds = [];
      let invalidIds = [];
      let fetched = 0;
      let invalidSkipped = 0;
      let deserializeErrors = 0;
      const readValidateStartedAt = Date.now();
      let cursor = this.collection
        .find(query)
        .limit(10000);

      if (sortByNewestFirst) {
        cursor = cursor.sort({ _id: -1 });
      }

      await cursor.forEach(function (myDoc) {
        fetched++;
        let doc;
        let doc2;
        try {
          // �
          doc2 = BSON.deserialize(myDoc, {
            validation: {
              utf8: {
                writeErrors: true,
              },
            },
          });

          // doc2 = reassembleStringifiedJSON(doc2);
          doc = EJSON.stringify(doc2);

          ids.push(doc2._id);
          if (!doc.includes("�")) {
            docs.push(doc2);
            validIds.push(doc2._id);
          } else {
            invalidIds.push(doc2._id);
            invalidSkipped++;
          }
        } catch (err) {
          deserializeErrors++;
          console.log("Error deserializing document:", err);
        }
      });

      const t_read_validate_ms = Date.now() - readValidateStartedAt;
      const docsLength = docs.length;
      const idsLength = ids.length;
      if (fetched == 0) {
        console.log("DONE!");
        return;
      }

      if (idsLength == 0) {
        console.log(
          "Batch metrics:",
          JSON.stringify({
            fetched,
            validQueued: docsLength,
            invalidSkipped,
            deserializeErrors,
            t_read_validate_ms,
            safe: false,
          })
        );
        throw new Error("Stopping cleanup because no source IDs could be read from the fetched documents.");
      }

      const metrics = await this.insertAll({
        ids,
        validIds,
        invalidIds,
        invalidCount: invalidSkipped,
        docs,
      });

      console.log(
        "Batch metrics:",
        JSON.stringify({
          fetched,
          validQueued: docsLength,
          invalidSkipped,
          deserializeErrors,
          t_read_validate_ms,
          ...metrics,
        })
      );

      if (!metrics.safe) {
        throw new Error("Stopping cleanup because insertAll reported an unsafe insert result; source documents were kept.");
      }
    }
  }
}

export { ProductDatabase };
