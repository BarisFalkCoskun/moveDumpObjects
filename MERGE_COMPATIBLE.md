# Compatible-object transfers

`app/mergeCompatible.js` transfers documents between MongoDB collections while
strictly merging objects that share a configured identity. It never writes a
`mergedFrom` field; source `_id` values exist only in memory until their
destination objects have been verified.

The default command is read-only:

```sh
npm run merge-compatible
```

It defaults to `hjemmelevering.products`, groups by `id`, and only reports what
would be transferred to `productsMerged`. Edit the configuration at the top of
`app/mergeCompatible.js` or set environment variables:

```sh
MERGE_DB=hjemmelevering \
MERGE_SOURCE=products \
MERGE_DESTINATION=productsMerged \
MERGE_GROUP_KEY=id \
MERGE_IDENTITY_KEYS=id,mainGTIN \
npm run merge-compatible
```

Only after reviewing the dry-run summary, enable mutations explicitly:

```sh
MERGE_APPLY=1 npm run merge-compatible
```

Apply mode creates a source index for the configured group key when necessary,
creates a unique sparse destination `hash` index, inserts and strictly verifies
every output, and only then deletes the contributing source documents. A weak
hash collision, conflicting value, unsupported BSON value, changed grouping
identity, insertion error, or failed witness check aborts without deleting the
current source group. The process is resumable because already-present strict
union witnesses are accepted on the next run.

Matching remains conservative:

- missing fields may be filled from another compatible snapshot;
- conflicting values never merge;
- ambiguous matches remain separate;
- whitespace is normalized before comparison;
- empty values are removed before comparison;
- the hash is recomputed with exactly `node-object-hash@3.1.1`;
- fixed point means exact duplicates, content-growing merges, and subset
  absorptions are all zero. Ambiguous documents are reported separately.
