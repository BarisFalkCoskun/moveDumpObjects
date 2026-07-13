import { processLabels } from "./processLabels.js";

export function cleanFoetexPlus(element) {
  delete element.blockedByHoliday;
  delete element.pant;
  delete element.cpOffer;
  delete element.targetCSR;
  delete element.targetEnvironmental;
  delete element.targetOrganic;

  if (element?.gtin !== undefined && element?.barcode === undefined) {
    element.barcode = element.gtin;
    delete element.gtin;
  }

  if (element?.searchHierachy !== undefined && element?.searchHierarchy.length > 0) {
    delete element.consumerFacingHierarchy;
    delete element.categories;
  }

  if (
    element?.productType !== undefined &&
    element?.productType === element?.targetProductType
  ) {
    delete element.targetProductType;
  }

  if (element?.multibuy_offer_description !== undefined && element.multibuy_offer_description.trim() === "Se Her") {
    delete element.multibuy_offer_description;
  }

  if (
    element?.manufacturer !== undefined &&
    element?.manufacturer === element?.targetManufacturer
  ) {
    delete element.targetManufacturer;
  }

  if (
    element?.id !== undefined &&
    element?.objectID !== undefined &&
    element.id === element.objectID
  ) {
    delete element.objectID;
  }

  if (
    element?.productName !== undefined &&
    String(element.productName).toLowerCase() ===
    String(element.name).toLowerCase()
  ) {
    delete element.productName;
  }

  let leaflet = {};
  if (element?.leafletTitle !== undefined) {
    leaflet.title = element.leafletTitle;
    delete element.leafletTitle;
  }

  if (element?.isInCurrentLeaflet !== undefined) {
    leaflet.inCurrent = element.isInCurrentLeaflet;
    delete element.isInCurrentLeaflet;
  }

  if (Object.keys(leaflet).length !== 0) {
    element.leaflet = leaflet;
  }

  if (element?.membership === undefined) {
    let membership = {};
    if (element?.cpOfferTitle !== undefined) {
      membership.title = element.cpOfferTitle;
      delete element.cpOfferTitle;
    }

    if (element?.cpOriginalPrice !== undefined) {
      membership.originalPrice = element.cpOriginalPrice;
      delete element.cpOriginalPrice;
    }

    if (element?.cpOfferPrice !== undefined) {
      membership.membershipPrice = element.cpOfferPrice;
      delete element.cpOfferPrice;
    }

    if (element?.cpOfferAmount !== undefined) {
      membership.quantity = element.cpOfferAmount;
      delete element.cpOfferAmount;
    }

    if (element?.cpDiscount !== undefined) {
      membership.discount = element.cpDiscount;
      delete element.cpDiscount;
    }

    if (element?.cpPercentDiscount !== undefined) {
      membership.discountInPercentage = element.cpPercentDiscount;
      delete element.cpPercentDiscount;
    }

    if (element?.cpOfferFromDate !== undefined) {
      membership.fromDate = element.cpOfferFromDate;
      delete element.cpOfferFromDate;
    }

    if (element?.cpOfferToDate !== undefined) {
      membership.toDate = element.cpOfferToDate;
      delete element.cpOfferToDate;
    }

    if (Object.keys(membership).length !== 0) {
      element.membership = membership;
    }
  }

  if (element?.storeData && typeof element.storeData === "object") {
    // Iterate through each store in storeData
    Object.keys(element.storeData).forEach((storeKey) => {
      const storeData = element.storeData[storeKey];

      // Remove offermax if it's 0
      if (storeData.offermax === 0) {
        delete storeData.offermax;
      }

      // Remove unitsOfMeasureShowPrice if it equals unitsOfMeasurePrice
      if (
        storeData.unitsOfMeasureShowPrice !== undefined &&
        storeData.unitsOfMeasurePrice !== undefined &&
        storeData.unitsOfMeasureShowPrice === storeData.unitsOfMeasurePrice
      ) {
        delete storeData.unitsOfMeasureShowPrice;
      }

      // Remove unitsOfMeasureShowPrice if it equals unitsOfMeasureOfferPrice
      if (
        storeData.unitsOfMeasureShowPrice !== undefined &&
        storeData.unitsOfMeasureOfferPrice !== undefined &&
        storeData.unitsOfMeasureShowPrice === storeData.unitsOfMeasureOfferPrice
      ) {
        delete storeData.unitsOfMeasureShowPrice;
      }
    });
  }

  if (element?.storeData) {
    const storeKeys = Object.keys(element.storeData);
    if (storeKeys.length > 1) {
      const firstStoreData = element.storeData[storeKeys[0]];
      const firstStoreKeys = Object.keys(firstStoreData).sort();

      // Check if all objects have identical structure and values
      const allIdentical = storeKeys.every((storeKey) => {
        const currentStore = element.storeData[storeKey];
        const currentKeys = Object.keys(currentStore).sort();

        // First check if they have the same keys
        if (currentKeys.length !== firstStoreKeys.length) return false;
        if (!currentKeys.every((key, idx) => key === firstStoreKeys[idx]))
          return false;

        // Then check if all values are identical
        return currentKeys.every(
          (key) =>
            JSON.stringify(currentStore[key]) ===
            JSON.stringify(firstStoreData[key])
        );
      });

      // If all objects are identical, keep only the first one
      if (allIdentical) {
        element.storeData = {
          [storeKeys[0]]: firstStoreData,
        };
      }
    }
  }

  if (element?.infos) {
    const originListObj = element.infos.find(
      (info) => info.code === "originlist"
    );
    if (originListObj && Array.isArray(originListObj.items)) {
      const uniqueValues = new Set();
      originListObj.items.forEach((item) => {
        if (item.value) {
          uniqueValues.add(item.value);
        }
      });

      if (uniqueValues.size > 0) {
        element.originList = Array.from(uniqueValues);
        // Remove the originlist object from infos since we've processed it
        element.infos = element.infos.filter(
          (info) => info.code !== "originlist"
        );
      }
    }

    const pantObj = element.infos.find((info) => info.code === "pant");
    if (pantObj && Array.isArray(pantObj.items)) {
      const pantItems = pantObj.items
        .filter(
          (item) =>
            item.title &&
            (item.title.startsWith("Pant") ||
              item.title.startsWith("PANT") ||
              /^Pant:.*\(\*\d+\)$/.test(item.title)) &&
            item.value
        )
        .map((item) => {
          let name;
          let quantity;

          // Extract quantity if present
          const quantityMatch = item.title.match(/\(\*(\d+)\)/);
          if (quantityMatch) {
            quantity = parseInt(quantityMatch[1], 10);
          }

          // Determine pant type
          if (
            item.title.includes("Pant A") ||
            item.title.includes("PANT") ||
            item.title.includes("Pant:")
          ) {
            name = item.title.includes("Spiritus pant")
              ? "Spiritus pant"
              : "Pant A";
          } else if (item.title.includes("Pant B")) {
            name = "Pant B";
          } else if (item.title.includes("Pant C")) {
            name = "Pant C";
          } else {
            return null;
          }

          const result = {
            name,
            price: item.value,
          };

          if (quantity) {
            result.quantity = quantity;
          }

          return result;
        })
        .filter(Boolean);

      if (pantItems.length > 0) {
        element.deposits = pantItems;
        // Remove the pant object from infos only if we successfully processed it
        element.infos = element.infos.filter((info) => info.code !== "pant");
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
        const value = rest.value || "";
        processedValues.push(value);
        return value;
      });
      // Always remove since all items are processed
      element.infos = element.infos.filter(
        (info) => info.code !== "description"
      );
    }

    // Find and process ingredients objects
    const ingredientsObj = element.infos.find(
      (info) => info.code === "ingredients"
    );
    if (ingredientsObj && Array.isArray(ingredientsObj.items)) {
      const processedValues = [];
      element.ingredients = ingredientsObj.items.map((item) => {
        const { type, ...rest } = item;
        const value = rest.value || "";
        processedValues.push(value);
        return value;
      });
      // Always remove since all items are processed
      element.infos = element.infos.filter(
        (info) => info.code !== "ingredients"
      );
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
            const { type, title = "", value } = item;

            // Process the value
            let processedValue = value;
            if (processedValue === 0) {
              processedValue = "0";
            }
            if (typeof processedValue === "number") {
              processedValue = processedValue.toString();
            }

            processedItems.push(item);
            return {
              title: title || "",
              value: processedValue || "0", // Default to "0" for empty/null values
            };
          })
          .filter((item) => item.title); // Only keep items with a title

        if (validNutritionalItems.length > 0) {
          element.nutritional = validNutritionalItems;
          // Always remove since all items were processed
          element.infos = element.infos.filter(
            (info) => info.code !== "nutritional_100"
          );
        }
      }
    }

    // Find and process storage objects
    const storageObj = element.infos.find((info) => info.code === "storage");
    if (storageObj && Array.isArray(storageObj.items)) {
      const processedValues = [];
      element.storage = storageObj.items.map((item) => {
        const { type, ...rest } = item;
        const value = rest.value || "";
        processedValues.push(value);
        return value;
      });
      // Always remove since all items are processed
      element.infos = element.infos.filter((info) => info.code !== "storage");
    }

    // Find and process product_details objects
    const productDetailsObj = element.infos.find(
      (info) => info.code === "product_details"
    );
    if (productDetailsObj && Array.isArray(productDetailsObj.items)) {
      const processedTitles = new Set();
      const processedIndexes = new Set();
      const informationalTexts = [];

      // First pass: Process structured items with titles
      productDetailsObj.items.forEach((item, index) => {
        const { title, value } = item;

        if (title && value) {
          let processed = false;

          switch (title) {
            case "Artikel":
            case "Article":
              if (!element.articleId) {
                element.articleId = value;
                processed = true;
              }
              break;
            case "EAN":
              if (
                element?.barcode === undefined ||
                element?.barcode === value
              ) {
                element.barcode = value;
                processed = true;
              }
              break;
            case "PID":
              if (element?.id === undefined) {
                element.id = value;
                processed = true;
              } else if (element?.id !== value) {
                element.productId = value;
                processed = true;
              }
              break;
            case "Netto mængde":
              if (!element.netQuantity) {
                element.netQuantity = value;
                processed = true;
              }
              break;
            case "Produkt type":
              if (!element.productType) {
                element.productType = value;
                processed = true;
              } else if (!element.productType2) {
                element.productType2 = value;
                processed = true;
              }
              break;
            case "Varebetegnelse":
              if (!element.productDesignation) {
                element.productDesignation = value;
                processed = true;
              }
              break;
          }

          if (processed) {
            processedTitles.add(title);
            processedIndexes.add(index);
          }
        }
      });

      // Second pass: Process informational text (items without titles)
      productDetailsObj.items.forEach((item, index) => {
        if (processedIndexes.has(index)) return;

        const { title, value } = item;

        // If it has no title but has a value, treat as informational text
        if (!title && value && typeof value === "string") {
          // Check if it's a key:value pair
          if (value.includes(": ")) {
            const [fieldTitle, fieldValue] = value
              .split(": ")
              .map((s) => s.trim());

            let processed = false;
            switch (fieldTitle.toLowerCase()) {
              case "pid":
                if (element?.id === undefined) {
                  element.id = fieldValue;
                  processed = true;
                } else if (element?.id !== fieldValue) {
                  element.productId = fieldValue;
                  processed = true;
                }
                break;
              case "article":
                if (!element.articleId) {
                  element.articleId = fieldValue;
                  processed = true;
                }
                break;
              case "ean":
                if (
                  element?.barcode === undefined ||
                  element?.barcode === fieldValue
                ) {
                  element.barcode = fieldValue;
                  processed = true;
                }
                break;
            }

            if (processed) {
              processedTitles.add(fieldTitle.toLowerCase());
              processedIndexes.add(index);
            } else {
              // If not a recognized key:value pair, treat as informational text
              informationalTexts.push(value);
              processedIndexes.add(index);
            }
          } else {
            // Pure informational text
            informationalTexts.push(value);
            processedIndexes.add(index);
          }
        }
      });

      // Add informational texts to productInformation
      if (informationalTexts.length > 0) {
        // Create a Set of existing texts to avoid duplicates
        const existingTexts = new Set(element.productInformation || []);
        const uniqueNewTexts = informationalTexts.filter(
          (text) => !existingTexts.has(text)
        );

        if (uniqueNewTexts.length > 0) {
          if (!element.productInformation) {
            element.productInformation = uniqueNewTexts;
          } else {
            element.productInformation = [
              ...element.productInformation,
              ...uniqueNewTexts,
            ];
          }
        }
      }

      // Remove product_details from infos if all items were processed
      if (processedIndexes.size === productDetailsObj.items.length) {
        element.infos = element.infos.filter(
          (info) => info.code !== "product_details"
        );
      } else {
        // Otherwise, keep only unprocessed items
        productDetailsObj.items = productDetailsObj.items.filter(
          (_, index) => !processedIndexes.has(index)
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
      element.specifications = specificationsObj.items.map((item) => {
        const { type, ...rest } = item;
        processedItems.push(item);
        return {
          title: rest.title || "",
          value: rest.value || "",
        };
      });

      // Now we can safely remove the specifications object as all items are processed
      element.infos = element.infos.filter(
        (info) =>
          info.code !== "productsspecifications" &&
          info.code !== "productspecification"
      );
    }

    // Find and process safetyinformation objects
    const safetyObj = element.infos.find(
      (info) => info.code === "safetyinformation"
    );
    if (safetyObj && Array.isArray(safetyObj.items)) {
      const processedValues = [];
      element.safety = safetyObj.items.map((item) => {
        const { type, ...rest } = item;
        const value = rest.value || "";
        processedValues.push(value);
        return value;
      });
      // Always remove since all items are processed
      element.infos = element.infos.filter(
        (info) => info.code !== "safetyinformation"
      );
    }

    // Find and process info objects
    const infoObj = element.infos.find((info) => info.code === "info");
    if (infoObj && Array.isArray(infoObj.items)) {
      const processedValues = [];
      element.productInfo = infoObj.items.map((item) => {
        const { type, ...rest } = item;
        const value = rest.value || "";
        processedValues.push(value);
        return value;
      });
      // Always remove since all items are processed
      element.infos = element.infos.filter((info) => info.code !== "info");
    }

    // Find and process brand objects
    const brandObj = element.infos.find((info) => info.code === "brand");
    if (brandObj && Array.isArray(brandObj.items)) {
      // Some brand items have different formats, so handle all possibilities
      const brandValue = brandObj.items.find((item) => item.value)?.value;

      if (brandValue && !element.brand) {
        element.brand = brandValue;
        // Remove the brand object from infos
        element.infos = element.infos.filter((info) => info.code !== "brand");
      } else if (brandValue && element.brand && brandValue !== element.brand) {
        // If brand exists but different from infos value, preserve the alternative
        element.brandAlternative = brandValue;
        // Remove the brand object from infos
        element.infos = element.infos.filter((info) => info.code !== "brand");
      } else if (brandValue && element.brand && brandValue === element.brand) {
        // If brands match, simply remove the redundant info
        element.infos = element.infos.filter((info) => info.code !== "brand");
      }
    }

    // Add this to the infos processing section:
    const assetsObj = element.infos.find((info) => info.code === "assets");
    if (assetsObj && Array.isArray(assetsObj.items)) {
      const originVarieties = [];

      assetsObj.items.forEach((item) => {
        const { type, value } = item;
        if (value && typeof value === "string") {
          // Extract country and variety from format like "Italien (Golden Delicious)"
          const match = value.match(/^(.+?)\s*\((.+?)\)$/);
          if (match) {
            const [_, country, variety] = match;
            originVarieties.push({
              country: country.trim(),
              variety: variety.trim(),
            });
          } else {
            // If it doesn't match the expected format, store the whole value
            originVarieties.push({
              value: value.trim(),
            });
          }
        }
      });

      if (originVarieties.length > 0) {
        element.originVarieties = originVarieties;
        // Remove the assets object since we've processed it
        element.infos = element.infos.filter((info) => info.code !== "assets");
      }
    }

    const petfoodIngredientsObj = element.infos.find(
      (info) => info.code === "petfoodingredients"
    );
    if (petfoodIngredientsObj && Array.isArray(petfoodIngredientsObj.items)) {
      const processedValues = [];
      element.petfoodIngredients = petfoodIngredientsObj.items
        .map((item) => {
          const { type, ...rest } = item;
          const value = rest.value || "";
          processedValues.push(value);
          return value;
        })
        .filter(Boolean);

      // Only remove petfoodingredients object if all values were processed successfully
      if (
        processedValues.length === petfoodIngredientsObj.items.length &&
        processedValues.every(Boolean)
      ) {
        element.infos = element.infos.filter(
          (info) => info.code !== "petfoodingredients"
        );
      }
    }

    // Remove infos if empty
    if (element.infos.length === 0) {
      delete element.infos;
    }
  }

  if (element?.netcontent !== undefined) {
    element.netContent = element.netcontent;
    delete element.netcontent;
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
    const iposeninfraImages = [];

    // Filter out and process matching URLs
    element.images = element.images.filter((url) => {
      // Check for iposeninfra URLs first
      if (typeof url === "string" && url.includes("iposeninfra")) {
        iposeninfraImages.push(url);
        return false; // Remove from array
      }
      // Then check for baseUrl + suffix pattern
      else if (url.startsWith(baseUrl) && url.endsWith(suffix)) {
        const guid = url.substring(baseUrl.length, url.length - suffix.length);
        guidsSet.add(guid);
        return false; // Remove from array
      }
      return true; // Keep non-matching URLs
    });

    // Move iposeninfra images to oldImages if any found and oldImages doesn't exist
    if (iposeninfraImages.length > 0 && !element.oldImages) {
      element.oldImages = iposeninfraImages;
    }

    // Delete images array if empty
    if (element.images.length === 0) {
      delete element.images;
    }
  }

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

  if (guidsSet.size > 0) {
    // If images exists, we need to merge with the guids, otherwise create new array
    if (element.images && Array.isArray(element.images)) {
      const newImages = Array.from(guidsSet)
        .sort()
        .map(
          (guid) =>
            `https://digitalassets.sallinggroup.com/image/upload/${guid}`
        );

      element.images = [...element.images, ...newImages];
    } else {
      element.images = Array.from(guidsSet)
        .sort()
        .map(
          (guid) =>
            `https://digitalassets.sallinggroup.com/image/upload/${guid}`
        );
    }
  }

  if (anglesSet.size > 0) {
    const angleImages = Array.from(anglesSet)
      .sort((a, b) => a - b)
      .map(
        (angle) =>
          `https://image.prod.iposeninfra.com/bilkaimg.php?pid=${element.id}&imgType=jpeg&imgSize=default&angle=${angle}`
      );

    // If oldImages exists, we need to merge, otherwise create new array
    if (element.oldImages && Array.isArray(element.oldImages)) {
      element.oldImages = [...element.oldImages, ...angleImages];
    } else {
      element.oldImages = angleImages;
    }
  }

  if (
    element?.images &&
    Array.isArray(element.images) &&
    element.images.length > 0
  ) {
    const processedGuids = new Set();
    const newImages = [];

    // First pass - collect GUIDs and process e_trim:2 URLs
    element.images.forEach((url) => {
      if (typeof url === "string") {
        // Check for e_trim:2 URLs
        if (
          url.includes("digitalassets.sallinggroup.com/image/upload/e_trim:2")
        ) {
          const parts = url.split("/");
          const guid = parts[parts.length - 1];

          if (guid && guid.includes("-")) {
            processedGuids.add(guid);
            newImages.push(
              `https://digitalassets.sallinggroup.com/image/upload/${guid}`
            );
          }
        } else if (
          url.includes("digitalassets.sallinggroup.com/image/upload/")
        ) {
          // Extract GUID from regular URL to avoid duplicates
          const parts = url.split("/");
          const guid = parts[parts.length - 1];

          if (guid && guid.includes("-")) {
            processedGuids.add(guid);
            newImages.push(url);
          }
        } else {
          // Keep other URLs
          newImages.push(url);
        }
      }
    });

    // Remove duplicates by using Set of GUIDs
    element.images = newImages.filter(
      (url, index, self) => self.indexOf(url) === index
    );
  }

  if (element?.infos) {
    // Clean up infos array
    element.infos = element.infos.map((info) => {
      // Handle case where items is an array
      if (Array.isArray(info.items)) {
        // Remove type from each item
        info.items = info.items.map(({ type, ...rest }) => rest);

        // Remove items that have empty values after type removal
        info.items = info.items.filter((item) => Object.keys(item).length > 0);

        // Special handling for product_details items
        if (info.code === "product_details") {
          info.items = info.items.filter((item) => {
            // Remove if article value matches articleId
            if (item.title === "Article" || item.title === "Artikel") {
              return element.articleId !== item.value;
            }
            // Keep other items
            return true;
          });
        }
      }
      // Handle case where items is an object
      else if (typeof info.items === "object" && info.items !== null) {
        const { type, ...rest } = info.items;
        info.items = Object.keys(rest).length > 0 ? rest : [];
      }

      return info;
    });

    // Remove info objects with empty items arrays
    element.infos = element.infos.filter((info) => {
      return Array.isArray(info.items)
        ? info.items.length > 0
        : Object.keys(info.items || {}).length > 0;
    });

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
          case "Varebetegnelse":
            if (!element.productDesignation) {
              element.productDesignation = rest.value;
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

    // Find and process manufacturer_info objects
    const manufacturerInfoObj = element.infos.find(
      (info) => info.code === "manufacturer_info"
    );
    if (manufacturerInfoObj && Array.isArray(manufacturerInfoObj.items)) {
      // Create manufacturerInfo object if it doesn't exist
      if (!element.manufacturerInfo) {
        element.manufacturerInfo = {};
      }

      const processedItems = [];

      manufacturerInfoObj.items.forEach((item) => {
        const { type, title, value } = item;

        if (title && value) {
          switch (title) {
            case "Fabrikantens navn":
              element.manufacturerInfo.name = value;
              processedItems.push(item);
              break;
            case "Fabrikantens adresse":
              element.manufacturerInfo.address = value;
              processedItems.push(item);
              break;
            case "Fabrikantens webadresse":
              // Check if it's an email address rather than a website
              if (value.includes("@") && !value.includes("://")) {
                element.manufacturerInfo.email = value;
              } else {
                element.manufacturerInfo.website = value;
              }
              processedItems.push(item);
              break;
            case "Importørens navn":
              if (!element.importerInfo) element.importerInfo = {};
              element.importerInfo.name = value;
              processedItems.push(item);
              break;
            case "Importørens adresse":
              if (!element.importerInfo) element.importerInfo = {};
              element.importerInfo.address = value;
              processedItems.push(item);
              break;
            case "Importørens webadresse":
              if (!element.importerInfo) element.importerInfo = {};
              // Check if it's an email address rather than a website
              if (value.includes("@") && !value.includes("://")) {
                element.importerInfo.email = value;
              } else {
                element.importerInfo.website = value;
              }
              processedItems.push(item);
              break;
          }
        }
      });

      // Only remove the manufacturer_info object if all items were processed
      if (processedItems.length === manufacturerInfoObj.items.length) {
        element.infos = element.infos.filter(
          (info) => info.code !== "manufacturer_info"
        );
      }

      // Remove empty objects
      if (Object.keys(element.manufacturerInfo).length === 0) {
        delete element.manufacturerInfo;
      }

      if (
        element.importerInfo &&
        Object.keys(element.importerInfo).length === 0
      ) {
        delete element.importerInfo;
      }
    }

    // Find and process vitaminsandminerals objects
    const vitaminsAndMineralsObj = element.infos.find(
      (info) => info.code === "vitaminsandminerals"
    );
    if (vitaminsAndMineralsObj && Array.isArray(vitaminsAndMineralsObj.items)) {
      // Create nutritional facts array if it doesn't exist
      if (!element.nutritionalFacts) {
        element.nutritionalFacts = [];
      }

      // Track which items have been processed
      const processedItems = [];
      let headerItem = null;
      let footerItem = null;

      // First pass - identify header and footer items
      vitaminsAndMineralsObj.items.forEach((item) => {
        if (item.title === "Indhold pr." && item.value && item.value2) {
          headerItem = {
            type: "header",
            per: item.value,
            percentageLabel: item.value2,
          };
          processedItems.push(item);
        } else if (!item.title && item.value && item.value.includes("*")) {
          footerItem = {
            type: "footer",
            note: item.value,
          };
          processedItems.push(item);
        }
      });

      // If we found a header, add it first
      if (headerItem) {
        element.nutritionalFacts.push(headerItem);
      }

      // Second pass - process vitamin/mineral entries
      vitaminsAndMineralsObj.items.forEach((item) => {
        // Skip already processed header/footer items
        if (processedItems.includes(item)) return;

        if (item.title && (item.value || item.value2)) {
          const nutrientInfo = {
            nutrient: item.title,
            amount: item.value || "",
            percentOfRI: typeof item.value2 === "number" ? item.value2 : null,
          };

          element.nutritionalFacts.push(nutrientInfo);
          processedItems.push(item);
        }
      });

      // If we found a footer, add it last
      if (footerItem) {
        element.nutritionalFacts.push(footerItem);
      }

      // Only remove the original info if all items were processed
      if (processedItems.length === vitaminsAndMineralsObj.items.length) {
        element.infos = element.infos.filter(
          (info) => info.code !== "vitaminsandminerals"
        );
      }
    }

    // Find and process documents objects
    const documentsObj = element.infos.find(
      (info) => info.code === "documents"
    );
    if (documentsObj && Array.isArray(documentsObj.items)) {
      // Create documents object if it doesn't exist
      if (!element.documents) {
        element.documents = {};
      }

      const processedTitles = new Set();

      documentsObj.items.forEach((item) => {
        const { type, title, value } = item;

        if (title && value) {
          // Extract URL from HTML link if present
          let cleanValue = value;
          if (
            typeof value === "string" &&
            value.includes('<a href="') &&
            value.includes("</a>")
          ) {
            const urlMatch = value.match(/<a href="([^"]+)"/);
            if (urlMatch && urlMatch[1]) {
              cleanValue = urlMatch[1];
            }
          }

          // Map document types to appropriate fields
          switch (title) {
            case "PrimaryDocumentProductManual":
              element.documents.manual = cleanValue;
              processedTitles.add(title);
              break;
            case "PrimaryDocumentSafetyDataSheet":
              element.documents.safetyDataSheet = cleanValue;
              processedTitles.add(title);
              break;
            // Add other document types as needed
            default:
              // For unknown document types, use the title as the key
              const keyName = title.charAt(0).toLowerCase() + title.slice(1);
              element.documents[keyName] = cleanValue;
              processedTitles.add(title);
              break;
          }
        }
      });

      // Only remove documents object if all items were processed
      const allItemsProcessed = documentsObj.items.every(
        (item) => item.title && processedTitles.has(item.title)
      );

      // If we don't have enough information, remove the empty object
      if (Object.keys(element.documents).length === 0) {
        delete element.documents;
      }

      if (allItemsProcessed) {
        element.infos = element.infos.filter(
          (info) => info.code !== "documents"
        );
      }
    }

    // Remove infos if empty
    if (element.infos.length === 0) {
      delete element.infos;
    }
  }

  element = processLabels(element);

  if (
    element?.article !== undefined &&
    element?.articleId !== undefined &&
    element.article === element.articleId
  ) {
    delete element.article;
  }

  if (element?.article !== undefined && element?.articleId === undefined) {
    element.articleId = element.article;
    delete element.article;
  }

  if (
    element?.productType !== undefined &&
    element?.productType2 !== undefined &&
    element.productType === element.productType2
  ) {
    delete element.productType2;
  }

  // Process safety-related fields
  if (
    (element?.safetyText && Array.isArray(element.safetyText)) ||
    (element?.safetyTexts && Array.isArray(element.safetyTexts))
  ) {
    // Step 1: Initialize warnings array if needed
    if (!element.warnings) {
      element.warnings = [];
    }

    // Step 2: Clean up existing safetyTexts (remove 'type' property)
    if (element.safetyTexts && Array.isArray(element.safetyTexts)) {
      element.safetyTexts = element.safetyTexts.map((safetyItem) => {
        // Process items array if it exists
        if (safetyItem.items && Array.isArray(safetyItem.items)) {
          safetyItem.items = safetyItem.items.map((item) => {
            const { type, ...cleanItem } = item;
            return cleanItem;
          });
        }
        return safetyItem;
      });
    } else {
      // Initialize safetyTexts if it doesn't exist
      element.safetyTexts = [];
    }

    // Step 3: Process safetyText and merge into safetyTexts
    if (
      element.safetyText &&
      Array.isArray(element.safetyText) &&
      element.safetyText.length > 0
    ) {
      // Track existing safetyTexts titles to avoid duplicates
      const existingSafetyTextsTitles = new Set(
        element.safetyTexts.map((item) => item.title)
      );

      // Track existing warning titles
      const existingWarningTitles = new Set(
        element.warnings.map((item) => item.title)
      );

      // Process each safetyText item
      element.safetyText.forEach((item) => {
        // Add to warnings if not already present
        if (!existingWarningTitles.has(item.title)) {
          element.warnings.push({
            title: item.title || "",
            text: item.text || "",
          });
          existingWarningTitles.add(item.title);
        }

        // Add to safetyTexts if not already present
        if (!existingSafetyTextsTitles.has(item.title)) {
          element.safetyTexts.push({
            title: item.title || "",
            code:
              item.title?.toLowerCase().replace(/\s+/g, "_") || "safety_text",
            items: [
              {
                title: item.title || "",
                value: item.text || "",
              },
            ],
          });
          existingSafetyTextsTitles.add(item.title);
        }
      });

      // Remove the original safetyText array
      delete element.safetyText;
    }

    // Step 4: Process safetyTexts for warnings extraction
    const existingWarningTitles = new Set(
      element.warnings.map((item) => item.title)
    );

    element.safetyTexts.forEach((safetyItem) => {
      // If this is a warning/hazard statement, also add to warnings
      if (
        safetyItem.code === "hazardStatementCode" ||
        safetyItem.code === "warningCode" ||
        safetyItem.title.toLowerCase().includes("fare") ||
        safetyItem.title.toLowerCase().includes("advarsel")
      ) {
        // Only add if not already present
        if (!existingWarningTitles.has(safetyItem.title) && safetyItem.items) {
          const warningText = safetyItem.items
            .map((item) => item.value)
            .filter(Boolean)
            .join(", ");

          if (warningText) {
            element.warnings.push({
              title: safetyItem.title,
              text: warningText,
            });
            existingWarningTitles.add(safetyItem.title);
          }
        }
      }
    });

    // Remove empty arrays
    if (element.warnings.length === 0) {
      delete element.warnings;
    }

    if (element.safetyTexts.length === 0) {
      delete element.safetyTexts;
    }
  }

  return element;
}