  // Outside of class
const uniqueCodes = new Set();

function cleanNettoGtin(element) {
  delete element.hasImage;
  delete element.isOnOfferIn;
  delete element.consumerFacingHierarchy;
  delete element.cpOfferId;
  delete element.categories;
  delete element.ageCode;
  delete element.isInOffer;
  delete element.targetOffer;
  delete element.targetGBB;
  delete element.facetFilters;

  if (element?.gtin !== undefined) {
    element.barcode = element.gtin;
    delete element.gtin;
  }

  if (
    element?.manufacturer !== undefined &&
    element?.manufacturer === element?.targetManufacturer
  ) {
    delete element.targetManufacturer;
  }

  if (
    element?.productType !== undefined &&
    element?.productType === element?.targetProductType
  ) {
    delete element.targetProductType;
  }

  if (
    element?.article !== undefined &&
    element?.objectID !== undefined &&
    element.article === element.objectID
  ) {
    delete element.objectID;
  }

  if (element?.infos) {
    element.infos = element.infos.filter((info) => {
      // Skip if info doesn't have both title and code
      if (!info.title || !info.code) return true;

      // Check if the data has already been processed
      switch (info.code) {
        case "description":
          return !element.description;
        case "ingredients":
          return !element.ingredients;
        case "nutritional_100":
          return !element.nutritional;
        case "brand":
          // Only keep if we don't have a brand field or if the values don't match
          if (!element.brand) {
            if (info.items?.[0]?.value) {
              element.brand = info.items[0].value;
              return false;
            }
            return true;
          }
          // Check if the brand value matches what we have
          return info.items?.[0]?.value !== element.brand;
        case "allergens":
          // Keep allergens info if it hasn't been processed
          if (!element.allergens && info.items) {
            element.allergens = info.items
              .map((item) => ({
                title: item.title,
                value: item.value,
              }))
              .filter((item) => item.title && item.value);
            return false;
          }
          return !element.allergens;
        default:
          // Keep any unprocessed info codes
          return true;
      }
    });

    const titleToCodeMap = {
      Beskrivelse: "description",
      Brand: "brand",
      Ingredienser: "ingredients",
      "Næringsindhold pr. 100 gr.": "nutritional_100",
      "Info om allergener": "allergens",
      Opbevaring: "storage",
      "Produkt detaljer": "product_details",
      Specificationer: "productsspecifications",
    };

    // Check if we're dealing with title-based structure
    const isTitleBased = element.infos.some((info) => !info.code && info.title);

    if (isTitleBased) {
      element.infos = element.infos.map((info) => ({
        ...info,
        code: titleToCodeMap[info.title] || info.title.toLowerCase(),
      }));
    }

    // Process description
    const descriptionObj = element.infos.find(
      (info) => info.code === "description"
    );
    if (descriptionObj && Array.isArray(descriptionObj.items)) {
      const processedValues = [];
      element.description = descriptionObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      if (
        processedValues.length === descriptionObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter(
          (info) => info.code !== "description"
        );
      }
    }

    // Find and process ingredients objects
    const ingredientsObj = element.infos.find(
      (info) => info.code === "ingredients"
    );
    if (ingredientsObj && Array.isArray(ingredientsObj.items)) {
      const processedValues = [];
      element.ingredients = ingredientsObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      // Only remove ingredients object if all values were processed successfully
      if (
        processedValues.length === ingredientsObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter(
          (info) => info.code !== "ingredients"
        );
      }
    }

    // Find and process nutritional_100 objects
    const nutritionalObj = element.infos.find(
      (info) => info.code === "nutritional_100"
    );
    if (nutritionalObj && nutritionalObj.items) {
      if (Array.isArray(nutritionalObj.items)) {
        const processedItems = [];
        const validNutritionalItems = nutritionalObj.items
          .map((item) => {
            const { type, ...rest } = item;
            if (rest.title && rest.value) {
              processedItems.push(item);
              return {
                title: rest.title,
                value: rest.value,
              };
            }
            return null;
          })
          .filter(Boolean);

        if (validNutritionalItems.length > 0) {
          element.nutritional = validNutritionalItems;
          // Only remove if all items were processed successfully
          if (processedItems.length === nutritionalObj.items.length) {
            element.infos = element.infos.filter(
              (info) => info.code !== "nutritional_100"
            );
          }
        }
      }
    }

    // Find and process storage objects
    const storageObj = element.infos.find((info) => info.code === "storage");
    if (storageObj && Array.isArray(storageObj.items)) {
      const processedValues = [];
      element.storage = storageObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      // Only remove storage object if all values were processed successfully
      if (
        processedValues.length === storageObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter((info) => info.code !== "storage");
      }
    }

    // Find and process product_details objects
    const productDetailsObj = element.infos.find(
      (info) => info.code === "product_details"
    );
    if (productDetailsObj && Array.isArray(productDetailsObj.items)) {
      const processedTitles = new Set();

      productDetailsObj.items.forEach((item) => {
        const { type, ...rest } = item;
        switch (rest.title) {
          case "Artikel":
          case "Article":
            if (!element.articleNumber) {
              element.articleNumber = rest.value;
              processedTitles.add(rest.title);
            }
            break;
          case "EAN":
            if (element?.barcode === rest.value) {
              element.barcode = rest.value;
              processedTitles.add(rest.title);
            }
            if (element?.barcode === undefined) {
              element.barcode = rest.value;
              processedTitles.add(rest.title);
            }
            break;
          case "PID":
            if (element?.id === undefined) {
              element.id = rest.value;
            } else if (element?.id !== rest.value) {
              element.productId = rest.value;
            }

            processedTitles.add(rest.title);
            break;
          case "Netto mængde":
            if (!element.netQuantity) {
              element.netQuantity = rest.value;
              processedTitles.add(rest.title);
            }
            break;
          case "Produkt type":
            if (!element.productType) {
              element.productType = rest.value;
              processedTitles.add(rest.title);
            } else if (!element.productType2) {
              element.productType2 = rest.value;
              processedTitles.add(rest.title);
            }
            break;
        }
      });

      // Remove only the processed items
      productDetailsObj.items = productDetailsObj.items.filter(
        (item) => !processedTitles.has(item.title)
      );

      // Only remove the entire object if all items were processed
      if (productDetailsObj.items.length === 0) {
        element.infos = element.infos.filter(
          (info) => info.code !== "product_details"
        );
      }
    }

    // Find and process productsspecifications/productspecification objects
    const specificationsObj = element.infos.find(
      (info) =>
        info.code === "productsspecifications" ||
        info.code === "productspecification"
    );
    if (specificationsObj && Array.isArray(specificationsObj.items)) {
      const processedItems = [];
      element.specifications = specificationsObj.items
        .map((item) => {
          const { type, ...rest } = item;
          if (rest.title && rest.value) {
            processedItems.push(item);
            return {
              title: rest.title,
              value: rest.value,
            };
          }
          return null;
        })
        .filter(Boolean);

      // Only remove specifications object if all items were processed
      if (processedItems.length === specificationsObj.items.length) {
        element.infos = element.infos.filter(
          (info) =>
            info.code !== "productsspecifications" &&
            info.code !== "productspecification"
        );
      }
    }

    // Find and process safetyinformation objects
    const safetyObj = element.infos.find(
      (info) => info.code === "safetyinformation"
    );
    if (safetyObj && Array.isArray(safetyObj.items)) {
      const processedValues = [];
      element.safety = safetyObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      // Only remove safety object if all values were processed successfully
      if (
        processedValues.length === safetyObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter(
          (info) => info.code !== "safetyinformation"
        );
      }
    }

    // Find and process info objects
    const infoObj = element.infos.find((info) => info.code === "info");
    if (infoObj && Array.isArray(infoObj.items)) {
      const processedValues = [];
      element.productInfo = infoObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      // Only remove info object if all values were processed successfully
      if (
        processedValues.length === infoObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter((info) => info.code !== "info");
      }
    }

    // Find and process brand objects
    const brandObj = element.infos.find((info) => info.code === "brand");
    if (brandObj && Array.isArray(brandObj.items)) {
      const processedValues = [];
      const brandValues = brandObj.items
        .map((item) => {
          const { type, ...rest } = item;
          if (rest.value) {
            processedValues.push(rest.value);
          }
          return rest.value;
        })
        .filter(Boolean);

      if (brandValues.length > 0 && !element.brand) {
        element.brand = brandValues[0];
        // Only remove brand object if all values were processed
        if (processedValues.length === brandObj.items.length) {
          element.infos = element.infos.filter((info) => info.code !== "brand");
        }
      }
    }

    // Remove infos if empty
    if (element.infos.length === 0) {
      delete element.infos;
    }
  }

  return element;
}

function transformFillop(element) {
  if (element?.barcode) {
    delete element.gtin;
  }

  if (element?.producer) {
    // Remove trailing spaces
    element.producer = element.producer.trim();

    // Special case for "Italien Fra Italien"
    if (element.producer === "Italien Fra Italien") {
      element.producer = "Italien";
    }

    const countryMap = new Set([
      "Australien",
      "New Zealand",
      "Tyskland",
      "Frankrig",
      "Italien",
      "Spanien",
      "USA",
      "Sydafrika",
    ]);

    if (countryMap.has(element.producer)) {
      element.countryOfOrigin = element.producer;
      delete element.producer;
    } else {
      element.manufacturer = element.producer;
      delete element.producer;
    }
  }

  if (
    element?.brand !== undefined &&
    element?.producer !== undefined &&
    element.producer.toLowerCase() === element.brand.toLowerCase()
  ) {
    delete element.producer;
  }

  delete element.alternative_hierarchy;
  delete element.facetFilters;
  delete element.multipromo;
  delete element.msg;

  if (
    element?.promotion !== undefined &&
    element.promotion?.productType === undefined
  ) {
    if (element.promotion?.title !== undefined) {
      element.productType = element.promotion.title;
      delete element.promotion.title;
    }

    if (Object.keys(element.promotion).length === 0) {
      delete element.promotion;
    }
  }

  if (element?.gtin !== undefined) {
    element.barcode = element.gtin;
    delete element.gtin;
  }

  if (element?.uom !== undefined) {
    element.unitsOfMeasure = element.uom;
    delete element.uom;
  }

  if (element?.uomprice !== undefined) {
    element.unitOfMeasurePrice = element.uomprice;
    delete element.uomprice;
  }

  if (element?.auom !== undefined && element?.article === undefined) {
    element.article = element.auom;
    delete element.auom;
  }

  if (element?.info) {
    // Store info array in infos if it doesn't exist
    if (element.infos === undefined) {
      element.infos = element.info;
      delete element.info;
    }
  }

  if (element?.infos) {
    element.infos = element.infos.filter((info) => {
      // Skip if info doesn't have both title and code
      if (!info.title || !info.code) return true;

      // Check if the data has already been processed
      switch (info.code) {
        case "description":
          return !element.description;
        case "ingredients":
          return !element.ingredients;
        case "nutritional_100":
          return !element.nutritional;
        case "brand":
          // Only keep if we don't have a brand field or if the values don't match
          if (!element.brand) {
            if (info.items?.[0]?.value) {
              element.brand = info.items[0].value;
              return false;
            }
            return true;
          }
          // Check if the brand value matches what we have
          return info.items?.[0]?.value !== element.brand;
        case "allergens":
          // Keep allergens info if it hasn't been processed
          if (!element.allergens && info.items) {
            element.allergens = info.items
              .map((item) => ({
                title: item.title,
                value: item.value,
              }))
              .filter((item) => item.title && item.value);
            return false;
          }
          return !element.allergens;
        default:
          // Keep any unprocessed info codes
          return true;
      }
    });

    const titleToCodeMap = {
      Beskrivelse: "description",
      Brand: "brand",
      Ingredienser: "ingredients",
      "Næringsindhold pr. 100 gr.": "nutritional_100",
      "Info om allergener": "allergens",
      Opbevaring: "storage",
      "Produkt detaljer": "product_details",
      Specificationer: "productsspecifications",
    };

    // Check if we're dealing with title-based structure
    const isTitleBased = element.infos.some((info) => !info.code && info.title);

    if (isTitleBased) {
      element.infos = element.infos.map((info) => ({
        ...info,
        code: titleToCodeMap[info.title] || info.title.toLowerCase(),
      }));
    }

    // Process description
    const descriptionObj = element.infos.find(
      (info) => info.code === "description"
    );
    if (descriptionObj && Array.isArray(descriptionObj.items)) {
      const processedValues = [];
      element.description = descriptionObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      if (
        processedValues.length === descriptionObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter(
          (info) => info.code !== "description"
        );
      }
    }

    // Find and process ingredients objects
    const ingredientsObj = element.infos.find(
      (info) => info.code === "ingredients"
    );
    if (ingredientsObj && Array.isArray(ingredientsObj.items)) {
      const processedValues = [];
      element.ingredients = ingredientsObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      // Only remove ingredients object if all values were processed successfully
      if (
        processedValues.length === ingredientsObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter(
          (info) => info.code !== "ingredients"
        );
      }
    }

    // Find and process nutritional_100 objects
    const nutritionalObj = element.infos.find(
      (info) => info.code === "nutritional_100"
    );
    if (nutritionalObj && nutritionalObj.items) {
      if (Array.isArray(nutritionalObj.items)) {
        const processedItems = [];
        const validNutritionalItems = nutritionalObj.items
          .map((item) => {
            const { type, ...rest } = item;
            if (rest.title && rest.value) {
              processedItems.push(item);
              return {
                title: rest.title,
                value: rest.value,
              };
            }
            return null;
          })
          .filter(Boolean);

        if (validNutritionalItems.length > 0) {
          element.nutritional = validNutritionalItems;
          // Only remove if all items were processed successfully
          if (processedItems.length === nutritionalObj.items.length) {
            element.infos = element.infos.filter(
              (info) => info.code !== "nutritional_100"
            );
          }
        }
      }
    }

    // Find and process storage objects
    const storageObj = element.infos.find((info) => info.code === "storage");
    if (storageObj && Array.isArray(storageObj.items)) {
      const processedValues = [];
      element.storage = storageObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      // Only remove storage object if all values were processed successfully
      if (
        processedValues.length === storageObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter((info) => info.code !== "storage");
      }
    }

    // Find and process product_details objects
    const productDetailsObj = element.infos.find(
      (info) => info.code === "product_details"
    );
    if (productDetailsObj && Array.isArray(productDetailsObj.items)) {
      const processedTitles = new Set();

      productDetailsObj.items.forEach((item) => {
        const { type, ...rest } = item;
        switch (rest.title) {
          case "Artikel":
          case "Article":
            if (!element.articleNumber) {
              element.articleNumber = rest.value;
              processedTitles.add(rest.title);
            }
            break;
          case "EAN":
            if (element?.barcode === rest.value) {
              element.barcode = rest.value;
              processedTitles.add(rest.title);
            }
            if (element?.barcode === undefined) {
              element.barcode = rest.value;
              processedTitles.add(rest.title);
            }
            break;
          case "PID":
            if (element?.id === undefined) {
              element.id = rest.value;
            } else if (element?.id !== rest.value) {
              element.productId = rest.value;
            }

            processedTitles.add(rest.title);
            break;
          case "Netto mængde":
            if (!element.netQuantity) {
              element.netQuantity = rest.value;
              processedTitles.add(rest.title);
            }
            break;
          case "Produkt type":
            if (!element.productType) {
              element.productType = rest.value;
              processedTitles.add(rest.title);
            } else if (!element.productType2) {
              element.productType2 = rest.value;
              processedTitles.add(rest.title);
            }
            break;
        }
      });

      // Remove only the processed items
      productDetailsObj.items = productDetailsObj.items.filter(
        (item) => !processedTitles.has(item.title)
      );

      // Only remove the entire object if all items were processed
      if (productDetailsObj.items.length === 0) {
        element.infos = element.infos.filter(
          (info) => info.code !== "product_details"
        );
      }
    }

    // Find and process productsspecifications/productspecification objects
    const specificationsObj = element.infos.find(
      (info) =>
        info.code === "productsspecifications" ||
        info.code === "productspecification"
    );
    if (specificationsObj && Array.isArray(specificationsObj.items)) {
      const processedItems = [];
      element.specifications = specificationsObj.items
        .map((item) => {
          const { type, ...rest } = item;
          if (rest.title && rest.value) {
            processedItems.push(item);
            return {
              title: rest.title,
              value: rest.value,
            };
          }
          return null;
        })
        .filter(Boolean);

      // Only remove specifications object if all items were processed
      if (processedItems.length === specificationsObj.items.length) {
        element.infos = element.infos.filter(
          (info) =>
            info.code !== "productsspecifications" &&
            info.code !== "productspecification"
        );
      }
    }

    // Find and process safetyinformation objects
    const safetyObj = element.infos.find(
      (info) => info.code === "safetyinformation"
    );
    if (safetyObj && Array.isArray(safetyObj.items)) {
      const processedValues = [];
      element.safety = safetyObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      // Only remove safety object if all values were processed successfully
      if (
        processedValues.length === safetyObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter(
          (info) => info.code !== "safetyinformation"
        );
      }
    }

    // Find and process info objects
    const infoObj = element.infos.find((info) => info.code === "info");
    if (infoObj && Array.isArray(infoObj.items)) {
      const processedValues = [];
      element.productInfo = infoObj.items.map((item) => {
        const { type, ...rest } = item;
        processedValues.push(rest.value);
        return rest.value;
      });

      // Only remove info object if all values were processed successfully
      if (
        processedValues.length === infoObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter((info) => info.code !== "info");
      }
    }

    // Find and process brand objects
    const brandObj = element.infos.find((info) => info.code === "brand");
    if (brandObj && Array.isArray(brandObj.items)) {
      const processedValues = [];
      const brandValues = brandObj.items
        .map((item) => {
          const { type, ...rest } = item;
          if (rest.value) {
            processedValues.push(rest.value);
          }
          return rest.value;
        })
        .filter(Boolean);

      if (brandValues.length > 0 && !element.brand) {
        element.brand = brandValues[0];
        // Only remove brand object if all values were processed
        if (processedValues.length === brandObj.items.length) {
          element.infos = element.infos.filter((info) => info.code !== "brand");
        }
      }
    }

    // Remove infos if empty
    if (element.infos.length === 0) {
      delete element.infos;
    }
  }

  if (
    element.categories &&
    typeof element.categories === "object" &&
    !Array.isArray(element.categories)
  ) {
    delete element.categories;
  }

  if (
    element?.articleNumber !== undefined &&
    element?.code !== undefined &&
    element.articleNumber === element.code
  ) {
    delete element.code;
  }

  const guidsSet = new Set();
  const anglesSet = new Set();

  // Process images array
  if (
    element?.images !== undefined &&
    Array.isArray(element.images) &&
    element.images.length > 0
  ) {
    const baseUrl = "https://dsdam.imgix.net/services/assets.img/id/";
    const suffix = "/size/DEFAULT.jpg";

    // Filter out and process matching URLs
    element.images = element.images.filter((url) => {
      if (url.startsWith(baseUrl) && url.endsWith(suffix)) {
        const guid = url.substring(baseUrl.length, url.length - suffix.length);
        guidsSet.add(guid);
        return false; // Remove from array
      }
      return true; // Keep non-matching URLs
    });

    // Delete images array if empty
    if (element.images.length === 0) {
      delete element.images;
    }
  }

  // Process damGuid
  if (element.damGuid) {
    guidsSet.add(element.damGuid);
    delete element.damGuid;
  }

  // Process imageGUIDs
  if (element.imageGUIDs) {
    let processedAllImageGuids = true;

    for (const [angle, guid] of Object.entries(element.imageGUIDs)) {
      if (typeof guid === "string" && guid.length > 0) {
        guidsSet.add(guid);
        // Convert angle to number and add to angles set
        const angleNum = parseInt(angle, 10);
        if (!isNaN(angleNum)) {
          anglesSet.add(angleNum);
        } else {
          processedAllImageGuids = false;
        }
      } else {
        processedAllImageGuids = false;
      }
    }

    // Only delete if all were processed successfully
    if (processedAllImageGuids) {
      delete element.imageGUIDs;
    }
  }

  // Process angles array
  if (
    element.angles &&
    Array.isArray(element.angles) &&
    element.angles.length > 0
  ) {
    element.angles.forEach((angle) => {
      if (typeof angle === "number") {
        anglesSet.add(angle);
      }
    });
    delete element.angles;
  }

  if (guidsSet.size > 0) {
    element.images = Array.from(guidsSet)
      .sort()
      .map(
        (guid) => `https://digitalassets.sallinggroup.com/image/upload/${guid}`
      );
  }

  if (anglesSet.size > 0) {
    element.oldImages = Array.from(anglesSet)
      .sort((a, b) => a - b)
      .map(
        (angle) =>
          `https://image.prod.iposeninfra.com/bilkaimg.php?pid=${element.id}&imgType=jpeg&imgSize=default&angle=${angle}`
      );
  }

  if (
    element?.productId !== undefined &&
    element?.id !== undefined &&
    element.productId === element.id
  ) {
    delete element.productId;
  }

  // Process deposits array
  if (element.deposits && Array.isArray(element.deposits)) {
    element.deposits = element.deposits.map((deposit) => {
      // Create new object without id field
      const { id, amount, ...rest } = deposit;

      // Rename amount to quantity
      const newDeposit = {
        ...rest,
        quantity: amount,
      };

      // Process PANT naming based on price
      if (newDeposit.name === "PANT") {
        switch (newDeposit.price) {
          case 100:
            newDeposit.name = "Pant A";
            break;
          case 150:
            newDeposit.name = "Pant B";
            break;
          case 300:
            newDeposit.name = "Pant C";
            break;
        }
      }

      return newDeposit;
    });
  }

  if (element?.code !== undefined && element?.articleNumber === undefined) {
    element.articleNumber = element.code;
    delete element.code;
  }

  if (element?.code !== undefined && element?.code === element?.articleNumber) {
    delete element.code;
  }

  return element;
}

function cleanNettoBarcode(element) {
  delete element.multipromos;

  if (element?.alternativeSearchWords !== undefined) {
    element.ids = element.alternativeSearchWords;
    delete element.alternativeSearchWords;
  }

  if (element?.article !== undefined && element?.articleNumber === undefined) {
    element.articleNumber = element.article;
    delete element.article;
  }
  if (
    element?.manufacturer !== undefined &&
    element?.manufacturer === element?.targetManufacturer
  ) {
    delete element.targetManufacturer;
  }

  // Create labels object based on target fields
  if (
    element?.targetCSR ||
    element?.targetEnvironmental ||
    element?.targetOrganic
  ) {
    element.labels = {};

    if (element.targetCSR) {
      element.labels.csr = true;
      delete element.targetCSR;
    }

    if (element.targetEnvironmental) {
      element.labels.environmental = true;
      delete element.targetEnvironmental;
    }

    if (element.targetOrganic) {
      element.labels.organic = true;
      delete element.targetOrganic;
    }

    // Remove labels object if it's empty
    if (Object.keys(element.labels).length === 0) {
      delete element.labels;
    }
  }

  if (element?.properties && Array.isArray(element.properties)) {
    // Create labels object if it doesn't exist
    if (!element.labels) {
      element.labels = {};
    }

    // Process properties and update labels
    const propertiesToKeep = element.properties.filter((prop) => {
      switch (prop) {
        case "allergi venlig":
          element.labels.allergyFriendly = true;
          return false;
        case "fairtrade":
          element.labels.fairtrade = true;
          return false;
        case "fuldkorn":
          element.labels.wholemeal = true;
          return false;
        case "glutenfri":
          element.labels.glutenFree = true;
          return false;
        case "lactosefri":
          element.labels.lactoseFree = true;
          return false;
        case "økologi":
          element.labels.organic = true;
          return false;
        case "nøglehul":
          element.labels.noglehul = true;
          return false;
        default:
          return true;
      }
    });

    // Update properties array with remaining values
    if (propertiesToKeep.length > 0) {
      element.properties = propertiesToKeep;
    } else {
      delete element.properties;
    }

    // Remove labels if empty
    if (Object.keys(element.labels).length === 0) {
      delete element.labels;
    }
  }

  const guidsSet = new Set();
  const anglesSet = new Set();

  // Process images array
  if (
    element?.images !== undefined &&
    Array.isArray(element.images) &&
    element.images.length > 0
  ) {
    const baseUrl = "https://dsdam.imgix.net/services/assets.img/id/";
    const suffix = "/size/DEFAULT.jpg";

    // Filter out and process matching URLs
    element.images = element.images.filter((url) => {
      if (url.startsWith(baseUrl) && url.endsWith(suffix)) {
        const guid = url.substring(baseUrl.length, url.length - suffix.length);
        guidsSet.add(guid);
        return false; // Remove from array
      }
      return true; // Keep non-matching URLs
    });

    // Delete images array if empty
    if (element.images.length === 0) {
      delete element.images;
    }
  }

  // Process damGuid
  if (element.damGuid) {
    guidsSet.add(element.damGuid);
    delete element.damGuid;
  }

  // Process imageGUIDs
  if (element.imageGUIDs) {
    let processedAllImageGuids = true;

    for (const [angle, guid] of Object.entries(element.imageGUIDs)) {
      if (typeof guid === "string" && guid.length > 0) {
        guidsSet.add(guid);
        // Convert angle to number and add to angles set
        const angleNum = parseInt(angle, 10);
        if (!isNaN(angleNum)) {
          anglesSet.add(angleNum);
        } else {
          processedAllImageGuids = false;
        }
      } else {
        processedAllImageGuids = false;
      }
    }

    // Only delete if all were processed successfully
    if (processedAllImageGuids) {
      delete element.imageGUIDs;
    }
  }

  // Process angles array
  if (
    element.angles &&
    Array.isArray(element.angles) &&
    element.angles.length > 0
  ) {
    element.angles.forEach((angle) => {
      if (typeof angle === "number") {
        anglesSet.add(angle);
      }
    });
    delete element.angles;
  }

  if (guidsSet.size > 0) {
    element.images = Array.from(guidsSet)
      .sort()
      .map(
        (guid) => `https://digitalassets.sallinggroup.com/image/upload/${guid}`
      );
  }

  if (anglesSet.size > 0) {
    element.oldImages = Array.from(anglesSet)
      .sort((a, b) => a - b)
      .map(
        (angle) =>
          `https://image.prod.iposeninfra.com/bilkaimg.php?pid=${element.id}&imgType=jpeg&imgSize=default&angle=${angle}`
      );
  }

  return element;
}

  // Inside of class
  static async insertAll(ids, elements) {
    if (elements === undefined) {
      return;
    }

    let objects = [];
    for (let element of elements) {
      let productImages = undefined;
      let hashedUrl = undefined;
      let hashedName = undefined;

      if (element?.product_images) {
        if (this.isImagesCollection) {
          productImages = element["product_images"];
        } else {
          productImages = element["product_images"].flat();
        }
        delete element["product_images"];
      }
      if (element?.productImages) {
        if (this.isImagesCollection) {
          productImages = element["productImages"];
        } else {
          productImages = element["productImages"].flat();
        }
        delete element["productImages"];
      }
      if (element?.hashed_url) {
        hashedUrl = element["hashed_url"];
        delete element["hashed_url"];
      }
      if (element?.hashedUrl) {
        hashedUrl = element["hashedUrl"];
        delete element["hashedUrl"];
      }
      if (element?.hashed_name) {
        hashedName = element["hashed_name"];
        delete element["hashed_name"];
      }
      if (element?.hashedName) {
        hashedName = element["hashedName"];
        delete element["hashedName"];
      }

      delete element._highlightResult;
      delete element._id;
      delete element._rankingInfo;
      delete element._snippetResult;
      delete element.Availability;
      delete element.availableInStoreIconType;
      delete element.availableInStoreStatus;
      delete element.availableInStoreText;
      delete element.availableOnlineIconType;
      delete element.availableOnlineStatus;
      delete element.availableOnlineText;
      delete element.categoryStockLimit;
      delete element.currentlyDownloading;
      delete element.currentStock;
      delete element.daysSinceLastCampaignSale;
      delete element.daysSinceLastSale;
      delete element.downloading_image;
      delete element.epoch_updated_at;
      delete element.f_stock_availability;
      delete element.Favorite;
      delete element.forceDisplay;
      delete element.forceHidden;
      delete element.format_name;
      delete element.hash;
      delete element.hasSold;
      delete element.haveBeenProcessed;
      delete element.in_stock_stores_count;
      delete element.inStock;
      delete element.inStockStore;
      delete element.isFavoriteProduct;
      delete element.isInStock;
      delete element.language;
      delete element.last_syncronized;
      delete element.latestStockUpdate;
      delete element.outStockStore;
      delete element.popularity;
      delete element.Score;
      delete element.soldCount;
      delete element.stock_count_online;
      delete element.stock_count_status_online;
      delete element.StockInStoreLastUpdatedDate;
      delete element.StockOnlineLastUpdatedDate;
      delete element.timeSinceLastCampaignSale;
      delete element.timeSinceLastSale;

      switch (this.dbName) {
        case "spar":
        case "dagrofa":
        case "meny":
        case "minkobmand":
          delete element.id;
          delete element.assortmentNumber;
          delete element.categoryId;
          delete element.forSale;
          delete element.adverr;
          delete element.skyId;
          delete element.discountMaxty;
          delete element.isTobprice;
          delete element.assortmentNumbeount;
          delete element.ageRestribacco;
          delete element.discounroduct;
          delete element.summMaxQuantity;
          delete element.hnt;
          delete element.pickingRouteNumber;
          delete element.sumId;
          delete element.cageRestricted;

          if (element?.discountPrice === 0) {
            delete element["discountPrice"];
          }
          if (element?.discountAmount === 0) {
            delete element["discountAmount"];
          }
          if (element?.discountMaxQuantity === 0) {
            delete element["discountMaxQuantity"];
          }
          if (element?.alcoholContent === 0) {
            delete element["alcoholContent"];
          }
          if (element?.advertisementProduct === false) {
            delete element["advertisementProduct"];
          }
          if (element?.isTobacco === false) {
            delete element["isTobacco"];
          }
          if (element?.ageRestricted === false) {
            delete element["ageRestricted"];
          }
          if (element?.summary === "  / ") {
            delete element["summary"];
          }
          if (element?.productStockLimit === 0) {
            delete element["productStockLimit"];
          }
          if (element?.isproductDisplayName) {
            element["productDisplayName"] = element["isproductDisplayName"];
            delete element["isproductDisplayName"];
          }
          if (element?.productDisplayproductDisplayName) {
            element["productDisplayName"] =
              element["productDisplayproductDisplayName"];
            delete element["productDisplayproductDisplayName"];
          }
          if (element?.dprice) {
            element["discountPrice"] = element["dprice"];
            delete element["dprice"];
          }
          if (element?.discountAhighResImg) {
            element["highResImg"] = element["discountAhighResImg"];
            delete element["discountAhighResImg"];
          }
          if (element?.categorhighResImg) {
            element["highResImg"] = element["categorhighResImg"];
            delete element["categorhighResImg"];
          }
          if (element?.agmedResImg) {
            element["medResImg"] = element["agmedResImg"];
            delete element["agmedResImg"];
          }
          if (element?.Amount === 0) {
            delete element["Amount"];
          }
          if (element?.discountAmou) {
            element["discountAmount"] = element["discountAmou"];
            delete element["discountAmou"];
          }
          if (element?.is) {
            element["productDisplayName"] = element["is"];
            delete element["is"];
          }
          break;
        case "rema1000":
          delete element.formValue;
          delete element.referer;
          delete element.modified_at;
          delete element.sorting;
          delete element.department_id;
          delete element.assortment_code;
          delete element.have_image;
          delete element.created_at;
          delete element.category_id;
          delete element._highlightResult;
          delete element.entering_date;
          if (element?.gpsr) {
            delete element.gpsr.name;
            delete element.gpsr.street;
            delete element.gpsr.postal_code;
            delete element.gpsr.city;
            delete element.gpsr.country_code;
            delete element.gpsr.state_code;
            delete element.gpsr.website;
            delete element.gpsr.email;
            if (element.gpsr?.security_alert) {
              element["security_alert"] = element.gpsr.security_alert;
              delete element.gpsr.security_alert;
            }
            if (Object.keys(element.gpsr).length === 0) {
              delete element.gpsr;
            }
          }
          if (element["barcodes"]) {
            element["bar_codes"] = element["barcodes"];
            delete element["barcodes"];
          }
          if (element["id"] && element["objectID"] === undefined) {
            element["objectID"] = element["id"];
          }
          if (element["objectID"] && element["id"] === undefined) {
            element["id"] = element["objectID"];
          }
          if (element["page_id"]) {
            element["id"] = element["page_id"];
            element["objectID"] = element["page_id"];
            delete element["page_id"];
          }
          if (element?.price_over_max === 0) {
            delete element.price_over_max;
          }
          if (element?.max_quantity === 0) {
            delete element.max_quantity;
          }
          if (element?.is_on_discount === 0) {
            delete element.is_on_discount;
          }
          if (element?.environmental_hazard === 0) {
            delete element.environmental_hazard;
          }
          if (element?.explosive === 0) {
            delete element.explosive;
          }
          if (element?.flammable === 0) {
            delete element.flammable;
          }
          if (element?.harmful === 0) {
            delete element.harmful;
          }
          if (element?.health_hazard === 0) {
            delete element.health_hazard;
          }
          if (element?.oxidizing === 0) {
            delete element.oxidizing;
          }
          if (element?.toxic === 0) {
            delete element.toxic;
          }
          if (element?.compressed_gas === 0) {
            delete element.compressed_gas;
          }
          if (element?.corrosive === 0) {
            delete element.corrosive;
          }
          if (element?.is_self_scale_item === 0) {
            delete element.is_self_scale_item;
          }
          if (element?.is_on_discount === 1) {
            element.is_on_discount = true;
          }
          if (element?.is_weight_item === 0) {
            delete element.is_weight_item;
          }
          if (element?.pricing) {
            if (element?.pricing?.max_quantity === 0) {
              delete element.pricing.max_quantity;
            }
            if (element?.pricing?.price_over_max === 0) {
              delete element.pricing.price_over_max;
            }
            if (element?.pricing?.is_on_discount === false) {
              delete element.pricing.is_on_discount;
            }
            if (element?.pricing?.is_advertised === false) {
              delete element.pricing.is_advertised;
            }
            if (element?.pricing?.deposit === 0) {
              delete element.pricing.deposit;
            }
          }
          if (element?.have_image === false) {
            delete element.have_image;
          }
          if (element?.is_weight_item === false) {
            delete element.is_weight_item;
          }
          if (element?.median_weight === 0) {
            delete element.median_weight;
          }
          if (element?.is_self_scale_item === false) {
            delete element.is_self_scale_item;
          }
          if (element?.have_image === false) {
            delete element.have_image;
          }
          break;
        case "salling":
        case "bilkatogo":
        case "foetexplus":
        case "netto":
        case "bilka":
        case "foetex":
        case "br":
        case "fillop":
        case "koeboghent":
          delete element.ageCode;
          delete element.apple_id;
          delete element.article_hierarchy_node;
          delete element.at;
          delete element.bilka;
          delete element.bilka_active_offer_offer_id;
          delete element.bilka_delivery_max_days;
          delete element.bilka_delivery_min_days;
          delete element.bilka_delivery_price;
          delete element.bilka_dos_last_modified;
          delete element.bilka_in_stock_stores_count;
          delete element.bilka_is_exposed;
          delete element.bilka_is_reservable;
          delete element.bilka_is_sold_online;
          delete element.bilka_pricerunner_delivery_price;
          delete element.bilka_send_and_hent_price;
          delete element.bilka_show_discount_message;
          delete element.bilka_stock_count_online;
          delete element.bilka_stock_count_status_online;
          delete element.bilka_stock_type;
          delete element.br;
          delete element.br_delivery_max_days;
          delete element.br_delivery_min_days;
          delete element.br_delivery_price;
          delete element.br_dos_last_modified;
          delete element.br_in_stock_stores_count;
          delete element.br_is_exposed;
          delete element.br_is_reservable;
          delete element.br_is_sold_online;
          delete element.br_pricerunner_delivery_price;
          delete element.br_send_and_hent_price;
          delete element.br_show_discount_message;
          delete element.br_stock_count_online;
          delete element.br_stock_count_status_online;
          delete element.br_stock_type;
          delete element.brand_page;
          delete element.campaigntags;
          delete element.categoriesPIM;
          delete element.categoriesURL;
          delete element.category_id;
          delete element.cc_discount_text;
          delete element.cfh_nodes;
          delete element.count;
          delete element.coupon_offer_id;
          delete element.CreatedOn;
          delete element.deepestCategoryPath;
          delete element.display_cc_fee;
          delete element.eid;
          delete element.enablesFreeFreight;
          delete element.event_block_tag;
          delete element.eventBlockTag;
          delete element.expected_available_from;
          delete element.fav;
          delete element.foetex;
          delete element.foetex_delivery_max_days;
          delete element.foetex_delivery_min_days;
          delete element.foetex_delivery_price;
          delete element.foetex_dos_last_modified;
          delete element.foetex_in_stock_stores_count;
          delete element.foetex_is_exposed;
          delete element.foetex_is_reservable;
          delete element.foetex_is_sold_online;
          delete element.foetex_pricerunner_delivery_price;
          delete element.foetex_send_and_hent_price;
          delete element.foetex_show_discount_message;
          delete element.foetex_stock_count_online;
          delete element.foetex_stock_count_status_online;
          delete element.foetex_stock_type;
          delete element.has_image;
          delete element.hasImage;
          delete element.hierarchy_node;
          delete element.high_level_promotion;
          delete element.is_approved_for_sale;
          delete element.is_click_and_collectible;
          delete element.is_exposed;
          delete element.is_gift_wrapping_supported;
          delete element.is_in_stock_online;
          delete element.is_in_stock_stores;
          delete element.is_reservable;
          delete element.isInAssortmentIn;
          delete element.isInStock;
          delete element.isOnOfferIn;
          delete element.isUnlimitedStock;
          delete element.last_updated_at;
          delete element.locked;
          delete element.nameURL;
          delete element.nonsearchable;
          delete element.not_reservable_from;
          delete element.not_reservable_to;
          delete element.notifyMeEnabled;
          delete element.online_to;
          delete element.oos;
          delete element.outOfStock;
          delete element.page_id;
          delete element.pathPIM;
          delete element.pathURL;
          delete element.product_url;
          delete element.promotion_end_date;
          delete element.promotion_id;
          delete element.promotion_start_date;
          delete element.PublishedOn;
          delete element.show_discount_message;
          delete element.showColor;
          delete element.showSize;
          delete element.sold_in_stores;
          delete element.sold_online;
          delete element.stock_type;
          delete element.uid;
          delete element.UpdatedOn;
          delete element.UrlSegment;
          delete element.viking_offer_id;
          delete element.web_category;
          delete element.y_commercial_cat;
          delete element.targetGBB;
          delete element.hasImage;
          delete element.cpOfferId;
          delete element.hierarchyNode;
          delete element.blockbit;

          if (element.objectID && element?.id === undefined) {
            element.id = element.objectID;
            delete element.objectID;
          }

          if (element.objectID && element.objectID === element.id) {
            delete element.objectID;
          }

          if (this.dbName === "netto" && this.currentName === "barcode") {
            element = cleanNettoBarcode(element);
          }

          if (this.dbName === "netto" && this.currentName === "gtin") {
            element = cleanNettoGtin(element);
          }

          break;
        case "beepr":
          delete element.lastmod;
          delete element.Mapped;
          delete element.UT;
          delete element["hierarchicalCategories.lvl0"];
          delete element["hierarchicalCategories.lvl1"];
          delete element["hierarchicalCategories.lvl2"];
          delete element["hierarchicalCategories.lvl3"];
          delete element["hierarchicalCategories.lvl4"];

          if (element?.AlcoholPercentage === 0) {
            delete element.AlcoholPercentage;
          }
          if (element?.IsWine === false) {
            delete element.IsWine;
          }
          if (element?.IsFood === false) {
            delete element.IsFood;
          }
          if (element?.offer === false) {
            delete element.offer;
          }
          if (element?.Status === "done") {
            delete element.Status;
          }
          if (element?.LowestPrice === 0) {
            delete element?.LowestPrice;
          }
          if (element?.ImageURL === "products/empty.png") {
            delete element?.ImageURL;
          }
          if (element?.pant === false) {
            delete element.pant;
          }
          if (element?.swan_label === false) {
            delete element.swan_label;
          }
          if (element?.keyhole_label === false) {
            delete element.keyhole_label;
          }
          break;
        case "nemlig":
          delete element.TemplateName;
          if (
            element?.Declarations &&
            element?.Declarations?.ShowDeclarations
          ) {
            delete element.Declarations.ShowDeclarations;
          }
          if (element?.DiscountSavings === 0) {
            delete element.DiscountSavings;
          }
          if (element?.DiscountItem === false) {
            delete element.DiscountItem;
          }
          if (element?.Campaign) {
            if (element?.Campaign?.MaxQuantity === 0) {
              delete element.Campaign.MaxQuantity;
            }
            if (element?.Campaign?.VariousPriceProductsCampaign) {
              delete element.Campaign.VariousPriceProductsCampaign;
            }
            if (element?.Campaign?.Code) {
              delete element.Campaign.Code;
            }
            if (element?.Campaign?.ShowCampaignInterval) {
              delete element.Campaign.ShowCampaignInterval;
            }
          }
          break;
        case "flyingtiger":
          delete element.available;
          delete element.tag;
          delete element.klevu_category;
          delete element.created_at;
          delete element.handle;
          delete element.published_at;
          delete element.published_scope;
          delete element.updated_at;
          delete element.requires_selling_plan;

          if (element?.compare_at_price_min === 0) {
            delete element.compare_at_price_min;
          }
          if (element?.compare_at_price_max === 0) {
            delete element.compare_at_price_max;
          }
          if (element?.compare_at_price_varies === false) {
            delete element.compare_at_price_varies;
          }
          if (element?.totalVariants === 0) {
            delete element.totalVariants;
          }
          if (element?.discount === 0) {
            delete element.discount;
          }
          if (element?.label === "LBL_NEW_IN") {
            delete element.label;
          }
          if (element?.Label === "LBL_NEW_IN") {
            delete element.Label;
          }
          if (element?.image) {
            delete element.image.created_at;
            delete element.image.updated_at;
          }
          if (element?.images && Array.isArray(element.images)) {
            element.images.forEach((imgObj) => {
              delete imgObj.created_at;
              delete imgObj.updated_at;
            });
          }
          if (element?.variants && Array.isArray(element.variants)) {
            element.variants.forEach((variant) => {
              delete variant.fulfillment_service;
              delete variant.inventory_management;
              delete variant.created_at;
              delete variant.updated_at;
              delete variant.tax_code;
              delete variant.taxable;
              delete variant.requires_shipping;
            });
          }

          break;
        case "hjemmelevering":
          delete element.lateArrival;
          delete element.promoSplashStyle;
          delete element.promoType;
          delete element.counterATS;
          delete element.categoriesPIM;
          delete element.categoriesURL;
          delete element.nameURL;
          delete element.nameSEO;
          if (element?.salesPrice === 0) {
            delete element.salesPrice;
          }
          if (element?.maxPromoQty === 0) {
            delete element.maxPromoQty;
          }
          if (element?.plusDeposit === false) {
            delete element.plusDeposit;
          }
          if (element?.bulky === false) {
            delete element.bulky;
          }
          if (element?.isOnOffer === false) {
            delete element.isOnOffer;
          }

          break;
        case "coop":
        case "irma":
          delete element.splash;
          delete element.available;
          delete element.onlyPurchaseableFromProductDetailsPage;
          delete element.isAvailableToAddInLimitedDeliveryPeriod;
          delete element.isInAssortment;
          delete element.isFavorited;
          delete element.productType;
          delete element.updated;
          delete element.outsideDeliveryPeriodMessage;

          for (let k in element?.reviews) {
            if (element.reviews[k]?.MaxRating !== undefined) {
              element.reviews[k].maxRating = element.reviews[k].MaxRating;
              delete element.reviews[k].MaxRating;
            }
            if (element.reviews[k]?.Rating !== undefined) {
              element.reviews[k].rating = element.reviews[k].Rating;
              delete element.reviews[k].Rating;
            }
            if (element.reviews[k]?.TenthsRating !== undefined) {
              element.reviews[k].tenthsRating = element.reviews[k].TenthsRating;
              delete element.reviews[k].TenthsRating;
            }
            if (element.reviews[k]?.Text !== undefined) {
              element.reviews[k].text = element.reviews[k].Text;
              delete element.reviews[k].Text;
            }
            if (element.reviews[k]?.Priority !== undefined) {
              element.reviews[k].priority = element.reviews[k].Priority;
              delete element.reviews[k].Priority;
            }
            if (element.reviews[k]?.ReviewMediaName !== undefined) {
              element.reviews[k].reviewMediaName =
                element.reviews[k].ReviewMediaName;
              delete element.reviews[k].ReviewMediaName;
            }
            if (element.reviews[k]?.RatingType !== undefined) {
              element.reviews[k].ratingType = element.reviews[k].RatingType;
              delete element.reviews[k].RatingType;
            }
          }

          for (let k in element?.labels) {
            if (element.labels[k]?.Id !== undefined) {
              element.labels[k].id = element.labels[k].Id;
              delete element.labels[k].Id;
            }
            if (element.labels[k]?.DisplayName !== undefined) {
              element.labels[k].displayName = element.labels[k].DisplayName;
              delete element.labels[k].DisplayName;
            }
            if (element.labels[k]?.ParentId !== undefined) {
              element.labels[k].parentId = element.labels[k].ParentId;
              delete element.labels[k].ParentId;
            }
            if (
              element.labels[k]?.Priority !== undefined ||
              element.labels[k]?.priority !== undefined
            ) {
              delete element.labels[k]?.Priority;
              delete element.labels[k]?.priority;
            }
          }

          if (element?.wineOverview) {
            if (element?.wineOverview?.Producer !== undefined) {
              element.wineOverview.producer = element.wineOverview.Producer;
              delete element.wineOverview.Producer;
            }
            if (element?.wineOverview?.Country !== undefined) {
              element.wineOverview.country = element.wineOverview.Country;
              delete element.wineOverview.Country;
            }
            if (element?.wineOverview?.BottleSize !== undefined) {
              element.wineOverview.bottleSize = element.wineOverview.BottleSize;
              delete element.wineOverview.BottleSize;
            }
            if (element?.wineOverview?.Year !== undefined) {
              element.wineOverview.year = element.wineOverview.Year;
              delete element.wineOverview.Year;
            }
            if (element?.wineOverview?.Region !== undefined) {
              element.wineOverview.region = element.wineOverview.Region;
              delete element.wineOverview.Region;
            }

            if (element?.wineOverview?.Grapes) {
              if (element?.wineOverview?.grapes === undefined) {
                element.wineOverview.grapes = element.wineOverview.Grapes;
                delete element.wineOverview.Grapes;
              }
              for (let k in element?.wineOverview?.grapes) {
                if (element?.wineOverview?.grapes[k]?.Name !== undefined) {
                  element.wineOverview.grapes[k].name =
                    element.wineOverview.grapes[k].Name;
                  delete element.wineOverview.grapes[k].Name;
                }
                if (element?.wineOverview?.grapes[k]?.Volume !== undefined) {
                  element.wineOverview.grapes[k].volume =
                    element.wineOverview.grapes[k].Volume;
                  delete element.wineOverview.grapes[k].Volume;
                }
                if (element?.wineOverview?.grapes[k]?.volume === 0) {
                  delete element.wineOverview.grapes[k].volume;
                }
              }
            }
          }

          for (let k in element?.labels) {
            if (element.labels[k]?.Id !== undefined) {
              element.labels[k].id = element.labels[k].Id;
              delete element.labels[k].Id;
            }
            if (element.labels[k]?.DisplayName !== undefined) {
              element.labels[k].displayName = element.labels[k].DisplayName;
              delete element.labels[k].DisplayName;
            }
            if (element.labels[k]?.Priority !== undefined) {
              element.labels[k].priority = element.labels[k].Priority;
              delete element.labels[k].Priority;
            }
            if (element.labels[k]?.ParentId !== undefined) {
              element.labels[k].parentId = element.labels[k].ParentId;
              delete element.labels[k].ParentId;
            }
          }

          if (element?.defaultQuantityPriceTotal) {
            delete element.defaultQuantityPriceTotal.separator;
            delete element.defaultQuantityPriceTotal.formattedAmount;
            delete element.defaultQuantityPriceTotal.formattedAmountLong;
            delete element.defaultQuantityPriceTotal.minor;
            delete element.defaultQuantityPriceTotal.major;
            delete element.defaultQuantityPriceTotal.Separator;
            delete element.defaultQuantityPriceTotal.FormattedAmount;
            delete element.defaultQuantityPriceTotal.FormattedAmountLong;
            delete element.defaultQuantityPriceTotal.Minor;
            delete element.defaultQuantityPriceTotal.Major;

            if (element?.defaultQuantityPriceTotal?.Amount) {
              element.defaultQuantityPriceTotal.amount =
                element.defaultQuantityPriceTotal.Amount;
              delete element.defaultQuantityPriceTotal.Amount;
            }
          }

          if (element?.defaultQuantityPricePerUnit) {
            delete element.defaultQuantityPricePerUnit.separator;
            delete element.defaultQuantityPricePerUnit.formattedAmount;
            delete element.defaultQuantityPricePerUnit.formattedAmountLong;
            delete element.defaultQuantityPricePerUnit.minor;
            delete element.defaultQuantityPricePerUnit.major;
            delete element.defaultQuantityPricePerUnit.Separator;
            delete element.defaultQuantityPricePerUnit.FormattedAmount;
            delete element.defaultQuantityPricePerUnit.FormattedAmountLong;
            delete element.defaultQuantityPricePerUnit.Minor;
            delete element.defaultQuantityPricePerUnit.Major;

            if (element?.defaultQuantityPricePerUnit?.Amount) {
              element.defaultQuantityPricePerUnit.amount =
                element.defaultQuantityPricePerUnit.Amount;
              delete element.defaultQuantityPricePerUnit.Amount;
            }
          }

          if (element?.salesPrice) {
            delete element.salesPrice.separator;
            delete element.salesPrice.formattedAmount;
            delete element.salesPrice.formattedAmountLong;
            delete element.salesPrice.minor;
            delete element.salesPrice.major;
            delete element.salesPrice.Separator;
            delete element.salesPrice.FormattedAmount;
            delete element.salesPrice.FormattedAmountLong;
            delete element.salesPrice.Minor;
            delete element.salesPrice.Major;

            if (
              element?.salesPrice?.Amount &&
              element.salesPrice?.amount === undefined
            ) {
              element.salesPrice.amount = element.salesPrice.Amount;
              delete element.salesPrice.Amount;
            }
          }

          if (element?.discountLabel) {
            if (element.discountLabel?.Price) {
              delete element.discountLabel.Price.Separator;
              delete element.discountLabel.Price.FormattedAmount;
              delete element.discountLabel.Price.FormattedAmountLong;
              delete element.discountLabel.Price.Minor;
              delete element.discountLabel.Price.Major;

              if (element?.discountLabel?.price === undefined) {
                element.discountLabel.price = element.discountLabel.Price;
                delete element.discountLabel.Price;
              }
            }

            if (element?.discountLabel?.price) {
              delete element.discountLabel.price.separator;
              delete element.discountLabel.price.formattedAmount;
              delete element.discountLabel.price.formattedAmountLong;
              delete element.discountLabel.price.minor;
              delete element.discountLabel.price.major;

              if (element.discountLabel.price?.Amount) {
                element.discountLabel.price.amount =
                  element.discountLabel.price.Amount;
                delete element.discountLabel.price.Amount;
              }

              if (element.discountLabel.price?.amount !== undefined) {
                element.discountLabel.price =
                  element.discountLabel.price.amount;
              }
            }

            if (element?.discountLabel?.Saved) {
              delete element.discountLabel.Saved.Separator;
              delete element.discountLabel.Saved.FormattedAmount;
              delete element.discountLabel.Saved.FormattedAmountLong;
              delete element.discountLabel.Saved.Minor;
              delete element.discountLabel.Saved.Major;

              if (element?.discountLabel?.saved === undefined) {
                element.discountLabel.saved = element.discountLabel.Saved;
                delete element.discountLabel.Saved;
              }
            }

            if (element?.discountLabel?.saved) {
              delete element.discountLabel.saved.separator;
              delete element.discountLabel.saved.formattedAmount;
              delete element.discountLabel.saved.formattedAmountLong;
              delete element.discountLabel.saved.minor;
              delete element.discountLabel.saved.major;

              if (
                element.discountLabel.saved?.Amount &&
                element.discountLabel.saved?.amount === undefined
              ) {
                element.discountLabel.saved.amount =
                  element.discountLabel.saved.Amount;
                delete element.discountLabel.saved.Amount;
              }

              if (element.discountLabel.saved?.amount !== undefined) {
                element.discountLabel.saved =
                  element.discountLabel.saved.amount;
              }
            }

            if (element?.discountLabel?.SavedPercentage) {
              delete element.discountLabel.SavedPercentage.Separator;
              delete element.discountLabel.SavedPercentage.FormattedAmount;
              delete element.discountLabel.SavedPercentage.FormattedAmountLong;
              delete element.discountLabel.SavedPercentage.Minor;
              delete element.discountLabel.SavedPercentage.Major;

              if (element?.discountLabel?.savedPercentage === undefined) {
                element.discountLabel.savedPercentage =
                  element.discountLabel.SavedPercentage;
                delete element.discountLabel.SavedPercentage;
              }
            }

            if (element?.discountLabel?.savedPercentage) {
              delete element.discountLabel.savedPercentage.separator;
              delete element.discountLabel.savedPercentage.formattedAmount;
              delete element.discountLabel.savedPercentage.formattedAmountLong;
              delete element.discountLabel.savedPercentage.minor;
              delete element.discountLabel.savedPercentage.major;

              if (
                element.discountLabel.savedPercentage?.Amount &&
                element.discountLabel.savedPercentage?.amount === undefined
              ) {
                element.discountLabel.savedPercentage.amount =
                  element.discountLabel.savedPercentage.Amount;
                delete element.discountLabel.savedPercentage.Amount;
              }

              if (element.discountLabel.savedPercentage?.amount !== undefined) {
                element.discountLabel.savedPercentage =
                  element.discountLabel.savedPercentage.amount;
              }
            }

            if (element?.discountLabel?.DiscountPrice) {
              delete element.discountLabel.DiscountPrice.Separator;
              delete element.discountLabel.DiscountPrice.FormattedAmount;
              delete element.discountLabel.DiscountPrice.FormattedAmountLong;
              delete element.discountLabel.DiscountPrice.Minor;
              delete element.discountLabel.DiscountPrice.Major;

              if (element?.discountLabel?.discountPrice === undefined) {
                element.discountLabel.discountPrice =
                  element.discountLabel.DiscountPrice;
                delete element.discountLabel.DiscountPrice;
              }
            }

            if (element?.discountLabel?.discountPrice) {
              delete element.discountLabel.discountPrice.separator;
              delete element.discountLabel.discountPrice.formattedAmount;
              delete element.discountLabel.discountPrice.formattedAmountLong;
              delete element.discountLabel.discountPrice.minor;
              delete element.discountLabel.discountPrice.major;

              if (
                element.discountLabel.discountPrice?.Amount &&
                element.discountLabel.discountPrice?.amount === undefined
              ) {
                element.discountLabel.discountPrice.amount =
                  element.discountLabel.discountPrice.Amount;
                delete element.discountLabel.discountPrice.Amount;
              }

              if (element.discountLabel.discountPrice?.amount !== undefined) {
                element.discountLabel.discountPrice =
                  element.discountLabel.discountPrice.amount;
              }
            }

            if (element?.discountLabel?.SavedPerItem) {
              delete element.discountLabel.SavedPerItem.Separator;
              delete element.discountLabel.SavedPerItem.FormattedAmount;
              delete element.discountLabel.SavedPerItem.FormattedAmountLong;
              delete element.discountLabel.SavedPerItem.Minor;
              delete element.discountLabel.SavedPerItem.Major;

              if (element?.discountLabel?.savedPerItem === undefined) {
                element.discountLabel.savedPerItem =
                  element.discountLabel.SavedPerItem;
                delete element.discountLabel.SavedPerItem;
              }
            }

            if (element?.discountLabel?.savedPerItem) {
              delete element.discountLabel.savedPerItem.separator;
              delete element.discountLabel.savedPerItem.formattedAmount;
              delete element.discountLabel.savedPerItem.formattedAmountLong;
              delete element.discountLabel.savedPerItem.minor;
              delete element.discountLabel.savedPerItem.major;

              if (
                element.discountLabel.savedPerItem?.Amount &&
                element.discountLabel.savedPerItem?.amount === undefined
              ) {
                element.discountLabel.savedPerItem.amount =
                  element.discountLabel.savedPerItem.Amount;
                delete element.discountLabel.savedPerItem.Amount;
              }

              if (element.discountLabel.savedPerItem?.amount !== undefined) {
                element.discountLabel.savedPerItem =
                  element.discountLabel.savedPerItem.amount;
              }
            }

            if (
              element?.discountLabel?.UsageLimitPerOrder &&
              element.discountLabel?.usageLimitPerOrder === undefined
            ) {
              element.discountLabel.usageLimitPerOrder =
                element.discountLabel.UsageLimitPerOrder;
              delete element.discountLabel.UsageLimitPerOrder;
            }

            if (
              element?.discountLabel?.IsMix !== undefined &&
              element.discountLabel?.isMix === undefined
            ) {
              element.discountLabel.isMix = element.discountLabel.IsMix;
              delete element.discountLabel.IsMix;
            }

            if (
              element?.discountLabel?.MinQuantity !== undefined &&
              element.discountLabel?.minQuantity === undefined
            ) {
              element.discountLabel.minQuantity =
                element.discountLabel.MinQuantity;
              delete element.discountLabel.MinQuantity;
            }

            if (element.discountLabel?.isMix === false) {
              delete element.discountLabel.isMix;
            }

            delete element.discountLabel.discountLabelType;
            delete element.discountLabel.showSavings;
            delete element.discountLabel.name;
            delete element.discountLabel.hasNewSalesPrice;
            delete element.discountLabel.showDiscountLabel;
            delete element.discountLabel.DiscountLabelType;
            delete element.discountLabel.ShowSavings;
            delete element.discountLabel.Name;
            delete element.discountLabel.HasNewSalesPrice;
            delete element.discountLabel.ShowDiscountLabel;
          }

          if (element?.isWine === false) {
            delete element.isWine;
          }
          if (element?.showAgeRequirement === false) {
            delete element.showAgeRequirement;
          }
          if (element?.hasOffer === false) {
            delete element.hasOffer;
          }
          if (element?.alcoholPercentage === 0) {
            delete element.alcoholPercentage;
          }
          if (element?.maxQuantity === 999) {
            delete element.maxQuantity;
          }

          if (element?.id !== undefined) {
            element.barcode = element.id;
            delete element.id;
          }
          if (element?.displayName !== undefined) {
            element.name = element.displayName;
            delete element.displayName;
          }
          if (element?.category !== undefined) {
            element.categories = [element.category];
            delete element.category;
          }
          if (element?.spotText !== undefined) {
            element.description = element.spotText;
            delete element.spotText;
          }
          if (element?.defaultQuantity !== undefined) {
            element.quantity = element.defaultQuantity;
            delete element.defaultQuantity;
          }
          if (element?.salesPrice?.amount !== undefined) {
            element.salesPrice = element.salesPrice.amount;
            delete element.salesPrice.amount;

            if (Object.keys(element.salesPrice).length === 0) {
              delete element.salesPrice;
            }
          }

          if (element?.defaultQuantityPriceTotal?.amount !== undefined) {
            element.quantityPriceTotal =
              element.defaultQuantityPriceTotal.amount;
            delete element.defaultQuantityPriceTotal.amount;

            if (Object.keys(element.defaultQuantityPriceTotal).length === 0) {
              delete element.defaultQuantityPriceTotal;
            }
          }

          if (element?.defaultQuantityPricePerUnit?.amount !== undefined) {
            element.quantityPricePerUnit =
              element.defaultQuantityPricePerUnit.amount;
            delete element.defaultQuantityPricePerUnit.amount;

            if (Object.keys(element.defaultQuantityPricePerUnit).length === 0) {
              delete element.defaultQuantityPricePerUnit;
            }
          }

          if (element?.url !== undefined) {
            element.urls = [element.url];
            delete element.url;
          }

          if (element?.alternativeUrls !== undefined) {
            if (element.urls === undefined) {
              element.urls = [];
            }

            for (let k in element.alternativeUrls) {
              element.urls.push(element.alternativeUrls[k]);
            }

            delete element.alternativeUrls;
          }
          if (element?.discountLabel !== undefined) {
            element.discount = element.discountLabel;
            delete element.discountLabel;
          }
          if (element?.showAgeRequirement !== undefined) {
            element.ageRequirement = element.showAgeRequirement;
            delete element.showAgeRequirement;
          }
          if (element?.wineOverview !== undefined) {
            element.wineInfo = element.wineOverview;
            delete element.wineOverview;
          }
          if (element?.image) {
            element.images = [element.image];
            delete element.image;
          }
          break;
        case "elgiganten":
          delete element.sellability;
          delete element.score;
          delete element.tracking;
          delete element.rating;
          delete element.campaignId;
          delete element.pt;
          delete element.cgm;
          delete element.paymentPlan;
          if (element?.isOutletProduct === false) {
            delete element.isOutletProduct;
          }
          if (element?.hasGamingBenchmarks === false) {
            delete element.hasGamingBenchmarks;
          }
          if (element?.hasLevelScores === false) {
            delete element.hasLevelScores;
          }
          break;
        case "haraldnyborg":
          delete element.shoppingTermsAndConditionsUrl;
          delete element.deliveryConditionsUrl;
          delete element.shoppingTermsAndConditionsUrl;

          if (element?.hasDeposit === false) {
            delete element.hasDeposit;
          }

          if (element?.selectedVariant) {
            delete element.selectedVariant.deliveryTime;
            delete element.selectedVariant.financialProposal;
            delete element.selectedVariant.showInStockSubscription;
            delete element.selectedVariant.deliveryOnlyToMainlandByBridge;
            delete element.selectedVariant.showAddToBasket;

            if (element?.selectedVariant?.stock) {
              delete element.selectedVariant.stock.webshopStockColor;
              delete element.selectedVariant.stock.webshopStockText;
              delete element.selectedVariant.stock.shopStockColor;
              delete element.selectedVariant.stock.shopStockText;
              delete element.selectedVariant.stock.latestStockUpdate;
              delete element.selectedVariant.stock.haveSpecialReturnConditions;
              delete element.selectedVariant.stock.showConditionsLink;
              delete element.selectedVariant.stock.showPhysicalShopsLink;
              delete element.selectedVariant.stock.showFreightAddedLink;
              delete element.selectedVariant.stock.showFindShopLink;
              delete element.selectedVariant.stock.hasFreeFreight;
              delete element.selectedVariant.stock.quickBuy;
            }
            if (
              element?.selectedVariant?.priceInfo &&
              element?.selectedVariant?.priceInfo?.onsale === false
            ) {
              delete element.selectedVariant.priceInfo.onsale;
            }
          }
          break;
        case "sostrenegrene":
          delete element.displayIcon;
          delete element.onlineOnly;
          delete element.shippingLabel;
          delete element.shippingRules;
          delete element.onlineOnly;

          if (element?.tracking) {
            delete element.tracking.categoryIds;
            delete element.tracking.shortDescriptionLength;
            delete element.tracking.descriptionLength;
          }
          if (element?.pimId === 0) {
            delete element.pimId;
          }
          if (element?.news === false) {
            delete element.news;
          }
          if (element.availability?.status === 0) {
            delete element.availability.status;
            if (Object.keys(element.availability).length === 0) {
              delete element.availability;
            }
          }
          if (element.variants && Array.isArray(element.variants)) {
            element.variants = element.variants.map((variant) => {
              if (
                variant.availability &&
                variant.availability.status !== undefined
              ) {
                delete variant.availability.status;
                if (Object.keys(variant.availability).length === 0) {
                  delete variant.availability;
                }
              }
              if (variant.inventory) {
                delete variant.inventory.inStock;
                delete variant.inventory.state;
                delete variant.inventory.inStores;
              }

              return variant;
            });
          }
          break;
        case "silvan":
          delete element.SubscribeToStockUpdatesEnabled;
          delete element.PreferredStoreId;
          delete element.AllowDropShipment;
          delete element.deliveryMessage;
          delete element.deliveryMessageRuleNumber;
          delete element.clickAndCollectMessage;
          delete element.clickAndCollectMessageRuleNumber;
          delete element.IconOverlay;
          delete element.IdWithSpace;
          delete element.BookButtonText;
          delete element.iconOverlay;
          delete element.FreightInclVat;
          delete element.rentalText;
          delete element.FulfillmentType;

          if (element?.IsFromPrice === false) {
            delete element.IsFromPrice;
          }
          if (element?.CanBeTinted === false) {
            delete element.CanBeTinted;
          }
          if (element?.MustBeTinted === false) {
            delete element.MustBeTinted;
          }
          if (element?.IsTintablePaint === false) {
            delete element.IsTintablePaint;
          }
          if (element?.isRental === false) {
            delete element.isRental;
          }
          if (element?.showDatasheetLink === false) {
            delete element.showDatasheetLink;
          }
          if (element?.hasEnergyImage === false) {
            delete element.hasEnergyImage;
          }
          if (element?.isPaint === false) {
            delete element.isPaint;
          }
          if (element?.isMultiQuantity === false) {
            delete element.isMultiQuantity;
          }
          if (element?.showEnergyLabel === false) {
            delete element.showEnergyLabel;
          }
          if (element?.campaign) {
            if (element.campaign?.isActive === false) {
              delete element.campaign.isActive;
            }
            if (Object.keys(element.campaign).length === 0) {
              delete element.campaign;
            }
          }
          if (element?.IsCampaignActive === false) {
            delete element.IsCampaignActive;
          }
          if (element?.IsFreeProduct === false) {
            delete element.IsFreeProduct;
          }
          if (element?.HasEnergyAsset === false) {
            delete element.HasEnergyAsset;
          }
          if (element?.HasPalletFee === false) {
            delete element.HasPalletFee;
          }
          if (element?.IsRentalVariant === false) {
            delete element.IsRentalVariant;
          }
          break;
        case "jemogfix":
          delete element.useRealtimeStock;
          delete element.deliveryTime;
          delete element.deliveryType;
          delete element.enableDeliveryCostIndicator;
          delete element.isAllowedInBasket;
          if (element?.stocks) {
            for (const stockKey in element.stocks) {
              if (element.stocks.hasOwnProperty(stockKey)) {
                const stock = element.stocks[stockKey];
                delete stock.statusCode;
                delete stock.amount;
                delete stock.useRealtimeStock;
                delete stock.lastUpdatedDateUtc;
              }
            }
          }
          if (element?.freeFreightType === 0) {
            delete element.freeFreightType;
          }
          if (element?.isVoucher === false) {
            delete element.isVoucher;
          }
          if (element?.isAllowedInBasket === false) {
            delete element.isAllowedInBasket;
          }
          if (element?.hideStockNumberInUI === false) {
            delete element.hideStockNumberInUI;
          }
          if (element?.energyHasDataSheet === false) {
            delete element.energyHasDataSheet;
          }
          if (element?.energyHasIcon === false) {
            delete element.energyHasIcon;
          }
          if (element?.price) {
            delete element?.alternativePriceShow;
            delete element?.freeFreightType;
            delete element?.alternativePriceFontSize;
            if (element?.multiPricesShow === false) {
              delete element.multiPricesShow;
            }
            if (element?.enableDeliveryCostIndicator === false) {
              delete element.enableDeliveryCostIndicator;
            }
          }
          if (element.documents && Array.isArray(element.documents)) {
            element.documents.forEach((doc) => {
              if (doc.product) {
                delete doc.product.language;
                delete doc.product.useRealtimeStock;
                delete doc.product.deliveryType;
                delete doc.product.deliveryTime;
                delete doc.product.enableDeliveryCostIndicator;
                delete doc.product.freeFreightType;
                if (doc.product.isVoucher === false) {
                  delete doc.product.isVoucher;
                }
                delete doc.product.isAllowedInBasket;
                delete doc.product.hideStockNumberInUI;
                if (doc.product.energyHasDataSheet === false) {
                  delete doc.product.energyHasDataSheet;
                }
                if (doc.product.energyHasIcon === false) {
                  delete doc.product.energyHasIcon;
                }
                if (doc.product?.price) {
                  delete doc.product.price.alternativePriceShow;
                  delete doc.product.price.freeFreightType;
                  delete doc.product.price.alternativePriceFontSize;
                  if (doc.product.price?.multiPricesShow === false) {
                    delete doc.product.price.multiPricesShow;
                  }
                  if (
                    doc.product.price?.enableDeliveryCostIndicator === false
                  ) {
                    delete doc.product.price.enableDeliveryCostIndicator;
                  }
                }
              }
            });
          }
          break;
        case "valdemarsro":
          delete element.created_at;
          delete element.updated_at;
          delete element.priority;
          delete element.premium;
          delete element.print_url;
          break;
        case "barcodes":
          if (element?.fotex) {
            element["foetex"] = element.fotex;
            delete element.fotex;
          }
          break;
      }

      let prod = this.parseStringifiedJSON(element);
      prod = this.processElementVariants(prod);
      prod = await cleaner.clean(prod, this.cleanerOptions);

      if (!this.isImagesCollection) {
        const result = await this.getHashValueOfObject(prod);
        prod["hash"] = result;
      }

      if (productImages !== undefined) {
        if (this.isImagesCollection) {
          prod["productImages"] = productImages;
        } else {
          prod["productImages"] = productImages.flat();
        }
      }
      if (hashedUrl !== undefined) {
        prod["hashedUrl"] = hashedUrl;
      }
      if (hashedName !== undefined) {
        prod["hashedName"] = hashedName;
      }
      objects.push(prod);
    }

    const insertions = await this.collection2
      .insertMany(objects, { ordered: false })
      .catch((error) => {
        return error;
      });

    if (insertions !== undefined && insertions.insertedCount !== undefined) {
      console.log("Insertions:", insertions.insertedCount);
      this.totalInserted += insertions.insertedCount;
    }

    await this.collection.deleteMany({ _id: { $in: ids } });
  }