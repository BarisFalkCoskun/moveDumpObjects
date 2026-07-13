export function reassembleStringifiedJSON(doc) {
  delete doc._id;
  delete doc.hash;
  let vals = Object.values(doc);
  let str = "";
  for (let v of vals) {
    if (typeof v === "string") {
      str += v;
    }
    else {
      str += String(v);
    }
  }
  try {
    return JSON.parse(str)

  } catch (err) {
    console.log(str)
    process.exit(1);
  }
}