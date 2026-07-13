"use strict";

import { MongoClient } from "mongodb";
import { BaseProductDatabase } from "./baseMongodb.js";

class ProductDatabase extends BaseProductDatabase {
  static async connectToDatabase(url) {
    this.client = new MongoClient(url, { enableUtf8Validation: false });

    this.client.on("error", function (err) {
      console.log(err);
    });

    await this.client.connect();
  }

  static async cleanObjects(query, { sortByNewestFirst = false } = {}) {
    console.log("Query:", query);
    console.log("Sort by newest _id first:", sortByNewestFirst);

    while (true) {
      let docs = [];
      let ids = [];
      let fetched = 0;
      let readErrors = 0;
      const readStartedAt = Date.now();
      let cursor = this.collection
        .find(query)
        .limit(10000);

      if (sortByNewestFirst) {
        cursor = cursor.sort({ _id: -1 });
      }

      await cursor.forEach(function (product) {
        fetched++;
        try {
          ids.push(product["_id"]);
          docs.push(product);
        } catch (err) {
          readErrors++;
          console.log(err);
        }
      });

      const t_read_validate_ms = Date.now() - readStartedAt;
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
            invalidSkipped: 0,
            deserializeErrors: readErrors,
            t_read_validate_ms,
            safe: false,
          })
        );
        throw new Error("Stopping cleanup because no source IDs could be read from the fetched documents.");
      }

      const metrics = await this.insertAll({
        ids,
        validIds: ids,
        invalidIds: [],
        invalidCount: 0,
        docs,
      });

      console.log(
        "Batch metrics:",
        JSON.stringify({
          fetched,
          validQueued: docsLength,
          invalidSkipped: 0,
          deserializeErrors: readErrors,
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
