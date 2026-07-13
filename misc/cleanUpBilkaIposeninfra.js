function cleanUpBilkaIposeninfra(element) {
  delete element.hierarchyNode;

  if (element?.images !== undefined && element?.images.length > 0) {
    delete element.img;

    if (element?.oldImages === undefined) {
      element.oldImages = element.images;
      delete element.images;
    }

    if (element?.damGuid !== undefined && element?.images === undefined) {
      element.images = [
        "https://digitalassets.sallinggroup.com/image/upload/" +
          element.damGuid,
      ];
      delete element.damGuid;
    }
  }

  const storeKeyedFields = [
    "storeData",
    "offer",
    "offerDescription",
    "price",
    "uomprice",
    "uompriceUnits",
  ];

  for (const field of storeKeyedFields) {
    if (element?.[field]) {
      element[field] = simplifyStoreKeyedObject(element[field]);
    }
  }

  if (element?.uom !== undefined && element?.unitsOfMeasure === undefined) {
    element.unitsOfMeasure = element.uom;
    delete element.uom;
  }

  if (
    element?.uomprice !== undefined &&
    element?.unitOfMeasurePrice === undefined
  ) {
    element.unitOfMeasurePrice = element.uomprice;
    delete element.uomprice;
  }

  if (
    element?.uompriceUnits !== undefined &&
    element?.unitOfMeasurePriceUnits === undefined
  ) {
    element.unitOfMeasurePriceUnits = element.uompriceUnits;
    delete element.uompriceUnits;
  }

  return element;
}