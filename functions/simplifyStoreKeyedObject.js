export function simplifyStoreKeyedObject(obj) {
  if (!obj || typeof obj !== "object") return obj;

  const storeKeys = Object.keys(obj);
  if (storeKeys.length <= 1) return obj;

  const firstValue = obj[storeKeys[0]];

  // Check if all values are identical
  const allIdentical = storeKeys.every(
    (key) => JSON.stringify(obj[key]) === JSON.stringify(firstValue)
  );

  // If all values are identical, keep only the first one
  if (allIdentical) {
    return { [storeKeys[0]]: firstValue };
  }

  return obj;
}