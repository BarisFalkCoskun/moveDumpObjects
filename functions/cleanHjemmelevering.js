export function cleanHjemmelevering(element) {
  delete element.productNotificationType;
  delete element.productNotificationSubHeader;
  delete element.productNotification;
  delete element.targetGBB;
  delete element.hasVideo;
  delete element.hasImage;
  delete element.isOnOffer;

  if (
    element?.ATS !== undefined &&
    element?.ATS?.packageSize !== undefined &&
    element?.packageSize === undefined
  ) {
    element.packageSize = element.ATS.packageSize;
    delete element.ATS;

    if (Object.keys(element.ATS).length === 0) {
      delete element.ATS;
    }
  }

  if (
    element?.nutritionPer100g !== undefined &&
    element?.nutritional === undefined
  ) {
    element.nutritional = element.nutritionPer100g;
    delete element.nutritionPer100g;
  }

  if (element?.articleID !== undefined && element?.articleId === undefined) {
    element.articleId = element.articleID;
    delete element.articleID;
  }

  if (element?.mainGTIN !== undefined && element.barcode === undefined) {
    element.barcode = element.mainGTIN;
    delete element.mainGTIN;
  }

  if (
    element?.outAssortmentDate !== undefined &&
    element.outAssortmentDate === 99991231
  ) {
    delete element.outAssortmentDate;
  }

  if (element?.brand !== undefined && element?.brand === element?.targetBrand) {
    delete element.targetBrand;
  }

  if (element?.brand === undefined && element?.targetBrand !== undefined) {
    element.brand = element.targetBrand;
    delete element.targetBrand;
  }

  if (
    element?.productType !== undefined &&
    element?.productType === element?.targetProductType
  ) {
    delete element.targetProductType;
  }

  if (element?.subBranding !== undefined && element?.subBrand === undefined) {
    element.subBrand = element.subBranding;
    delete element.subBranding;
  }

  return element;
}