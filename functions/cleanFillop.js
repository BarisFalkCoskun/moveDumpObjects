import { simplifyStoreKeyedObject } from "./simplifyStoreKeyedObject.js";

export function cleanFillop(element) {
  delete element.isInCurrentLeaflet;
  delete element.targetOrganic;
  delete element.targetEnvironmental;
  delete element.targetCSR;

  if (element.objectID && element?.id === undefined) {
    element.id = element.objectID;
    delete element.objectID;
  }

  if (element.objectID && element.objectID === element.id) {
    delete element.objectID;
  }

  if (element?.brand === undefined && element?.manufacturer !== undefined) {
    element.brand = element.manufacturer;
    delete element.manufacturer;
  }

    // Process productDetails.plural
if (element?.productDetails?.plural !== undefined && element?.details === undefined) {
  // Create details object if it doesn't exist and plural field exists
  element.details = element.productDetails.plural;

  // Delete the plural field from productDetails
  delete element.productDetails.plural;
  
  // If productDetails is now empty, delete it
  if (Object.keys(element.productDetails).length === 0) {
    delete element.productDetails;
  }
}

  if (element?.gtin !== undefined && element?.barcode === undefined) {
    element.barcode = element.gtin;
    delete element.gtin;
  }

  if (
    element?.articleNumber !== undefined &&
    element?.articleId === undefined
  ) {
    element.articleId = element.articleNumber;
    delete element.articleNumber;
  }

  if (
    element?.productType !== undefined &&
    element?.productType === element?.targetProductType
  ) {
    delete element.targetProductType;
  }

  if (
    element?.manufacturer !== undefined &&
    element?.manufacturer === element?.targetManufacturer
  ) {
    delete element.targetManufacturer;
  }

  if (
    element?.img !== undefined &&
    element.img.includes("iposeninfra.com") &&
    element.oldImages === undefined
  ) {
    element.oldImages = [element.img];
    delete element.img;
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

  // Process storeData when it has only one store
if (element?.storeData && typeof element.storeData === "object") {
  const storeKeys = Object.keys(element.storeData);
  if (storeKeys.length === 1) {
    // Delete multipromo if it exists when there's only one store
    delete element.multipromo;

    const storeKey = storeKeys[0];
    const storeData = element.storeData[storeKey];

    // Process price
    if (storeData.price !== undefined) {
      if (element.price === undefined) {
        element.price = storeData.price;
        delete storeData.price;
      } else if (element.price === storeData.price) {
        delete storeData.price;
      }
    }

    // Process unitsOfMeasurePrice
    if (storeData.unitsOfMeasurePrice !== undefined) {
      if (element.unitOfMeasurePrice === undefined) {
        element.unitOfMeasurePrice = storeData.unitsOfMeasurePrice;
        delete storeData.unitsOfMeasurePrice;
      } else if (element.unitOfMeasurePrice === storeData.unitsOfMeasurePrice) {
        delete storeData.unitsOfMeasurePrice;
      }
    }

    // Process unitsOfMeasurePriceUnit
    if (storeData.unitsOfMeasurePriceUnit !== undefined) {
      if (element.unitOfMeasurePriceUnits === undefined) {
        element.unitOfMeasurePriceUnits = storeData.unitsOfMeasurePriceUnit;
        delete storeData.unitsOfMeasurePriceUnit;
      } else if (element.unitOfMeasurePriceUnits === storeData.unitsOfMeasurePriceUnit) {
        delete storeData.unitsOfMeasurePriceUnit;
      }
    }

    // Process multiPromoPrice to priceMultiOffer
    if (storeData.multiPromoPrice !== undefined) {
      if (element.priceMultiOffer === undefined) {
        element.priceMultiOffer = storeData.multiPromoPrice;
        delete storeData.multiPromoPrice;
      } else if (element.priceMultiOffer === storeData.multiPromoPrice) {
        delete storeData.multiPromoPrice;
      }
    }

    // If storeData[storeKey] is empty after processing, delete it
    if (Object.keys(storeData).length === 0) {
      delete element.storeData[storeKey];
    }

    // If storeData is empty after processing, delete it
    if (Object.keys(element.storeData).length === 0) {
      delete element.storeData;
    }
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

  if (
    element?.img !== undefined &&
    element.img.includes("fillop.dk/80_80/no_product.jpg")
  ) {
    delete element.img;
  }

  if (element?.marks) {
    if (element.marks?.environment === 0) {
      delete element.marks.environment;
    }
    if (element.marks?.health === 0) {
      delete element.marks.health;
    }
    if (element.marks?.free === 0) {
      delete element.marks.free;
    }
    if (element.marks?.price === 0) {
      delete element.marks.price;
    }

    if (Object.keys(element.marks).length === 0) {
      delete element.marks;
    }
  }

  if (element?.units === 0) {
    delete element.units;
  }

  if (element?.promotion) {
    delete element.promotion.path;
    delete element.promotion.type;
  }

  if (element?.properties && Array.isArray(element.properties)) {
    const labels = element.labels || {};
    const remainingProperties = element.properties.filter((prop) => {
      switch (prop) {
        case "økologi":
        case "Økologisk":
          labels.organicDK = true;
          return false;
        case "nøglehul":
        case "Nøglehul":
          labels.noglehul = true;
          return false;
        case "Frost":
          labels.frost = true;
          return false;
        case "fairtrade":
        case "Fairtrade":
          labels.fairtrade = true;
          return false;
        case "fuldkorn":
        case "Fuldkorn":
          labels.wholemeal = true;
          return false;
        case "lactosefri":
        case "Lactosefri":
          labels.lactoseFree = true;
          return false;
        case "glutenfri":
        case "Glutenfri":
          labels.glutenFree = true;
          return false;
        case "allergi venlig":
        case "Allergi Venlig":
          labels.allergyFriendly = true;
          return false;
        case "Svanemærket":
          labels.svanemaerket = true;
          return false;
        case "Økomærket EU":
          labels.organicEU = true;
          return false;
        case "Sukkerfri":
        case "sukkerfri":
          labels.sugarFree = true;
          return false;
        default:
          return true;
      }
    });

    // Update or remove properties array
    if (remainingProperties.length > 0) {
      element.properties = remainingProperties;
    } else {
      delete element.properties;
    }

    // Update labels if we found any matches
    if (Object.keys(labels).length > 0) {
      element.labels = labels;
    }
  }

  if (element?.info) {
    // Store info array in infos if it doesn't exist
    if (element.infos === undefined) {
      element.infos = element.info;
      delete element.info;
    }
  }

  if (element?.infos) {
    const safetyInfoObj = element.infos.find(
      (info) => info.code === "safetyinformation"
    );
    if (safetyInfoObj && Array.isArray(safetyInfoObj.items)) {
      // Filter out items with specific values and process known safety icons
      const remainingItems = safetyInfoObj.items.filter((item) => {
        const value = item.value?.trim();

        // Process specific known values
        if (value === "Intet pictogram til rådighed") {
          return false; // Remove this item
        } else if (value === "Udråbstegn" || value === "Sundhedsfare") {
          // Create labels object if it doesn't exist
          if (!element.labels) {
            element.labels = {};
          }
          element.labels.healthRisk = true;
          return false; // Remove this item as we've processed it
        } else if (value === "Ætsende") {
          // Create labels object if it doesn't exist
          if (!element.labels) {
            element.labels = {};
          }
          element.labels.corrosive = true;
          return false; // Remove this item as we've processed it
        } else if (value === "Brandfarligt") {
          // Create labels object if it doesn't exist
          if (!element.labels) {
            element.labels = {};
          }
          element.labels.inflammable = true;
          return false; // Remove this item as we've processed it
        } else if (value === "Miljøfarligt") {
          // Create labels object if it doesn't exist
          if (!element.labels) {
            element.labels = {};
          }
          element.labels.environmentallyHazardous = true;
          return false; // Remove this item as we've processed it
        } else if (value === "Flamme over cirkel") {
          // Create labels object if it doesn't exist
          if (!element.labels) {
            element.labels = {};
          }
          element.labels.hazardousOxidizing = true;
          return false; // Remove this item as we've processed it
        }

        // Leave all other values untouched
        return true;
      });

      // Update or remove the safetyinformation object
      if (remainingItems.length > 0) {
        safetyInfoObj.items = remainingItems;
      } else {
        element.infos = element.infos.filter(
          (info) => info.code !== "safetyinformation"
        );
      }
    }

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

        // First check for direct value format (e.g., "Pid: 30791")
        if (rest.value) {
          const valueStr = String(rest.value); // Convert to string
          const pidMatch =
            typeof valueStr === "string"
              ? valueStr.match(/^Pid:\s*(\d+)$/)
              : null;
          if (pidMatch) {
            const pidValue = parseInt(pidMatch[1], 10);
            if (element?.id === undefined) {
              element.id = pidValue;
            } else if (element?.id !== pidValue) {
              element.productId = pidValue;
            }
            processedTitles.add(rest.title || valueStr);
            return;
          }

          const articleMatch =
            typeof valueStr === "string"
              ? valueStr.match(/^Article:\s*(\d+)$/)
              : null;
          if (articleMatch) {
            const articleValue = parseInt(articleMatch[1], 10);
            if (!element.articleId) {
              element.articleId = articleValue;
            }
            processedTitles.add(rest.title || valueStr);
            return;
          }
        }

        // Then handle the title-based format
        switch (rest.title) {
          case "Artikel":
          case "Article":
            if (!element.articleId) {
              element.articleId = rest.value;
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
        (item) => !processedTitles.has(item.title || String(item.value))
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

    // Find and process allergens object
    const allergensObj = element.infos.find(
      (info) => info.code === "allergens"
    );
    if (allergensObj && Array.isArray(allergensObj.items)) {
      const allergenLabels = {
        "Svovldioxid og sulfitter": "Sulfur dioxide and sulfites"
      };

      // Initialize or get existing allergens array
      if (!element.allergens) {
        element.allergens = [];
      }

      allergensObj.items.forEach((item) => {
        const { type, title, value } = item;

        if (title === "Indeholder" && value) {
          const trimmedValue = value.trim();
          const labelKey = allergenLabels[trimmedValue];

          if (labelKey) {
            // Check if this allergen is already in the array
            const allergenExists = element.allergens.some(
              (allergen) =>
                allergen.value === trimmedValue || allergen.value === labelKey
            );

            // Only add if it doesn't exist yet
            if (!allergenExists) {
              element.allergens.push({
                title: "Contains",
                value: trimmedValue,
              });
            }
          }
        }
      });

      // Remove the allergens object from infos
      element.infos = element.infos.filter((info) => info.code !== "allergens");
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

      if (brandValues.length > 0) {
        // If brand exists and matches the first value in brandValues, remove it from infos
        if (element.brand && element.brand === brandValues[0]) {
          element.infos = element.infos.filter((info) => info.code !== "brand");
        }
        // If brand doesn't exist yet, set it and remove from infos
        else if (!element.brand) {
          element.brand = brandValues[0];
          // Only remove if all values were processed
          if (processedValues.length === brandObj.items.length) {
            element.infos = element.infos.filter(
              (info) => info.code !== "brand"
            );
          }
        }
      }
    }

    // Remove infos if empty
    if (element.infos.length === 0) {
      delete element.infos;
    }
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

  if (
    element.categories &&
    typeof element.categories === "object" &&
    !Array.isArray(element.categories)
  ) {
    delete element.categories;
  }

  if (
    element?.articleId !== undefined &&
    element?.code !== undefined &&
    element.articleId === element.code
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

  if (element?.code !== undefined && element?.articleId === undefined) {
    element.articleId = element.code;
    delete element.code;
  }

  if (element?.code !== undefined && element?.code === element?.articleId) {
    delete element.code;
  }

  return element;
}
