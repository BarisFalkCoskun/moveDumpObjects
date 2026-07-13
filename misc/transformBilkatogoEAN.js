function transformBilkatogoEAN(element) {
  delete element.isInOffer;

  if (element?.categories !== undefined) {
    delete element.consumerFacingHierarchy;
  }

  if (element?.properties && Array.isArray(element.properties)) {
    const labels = element.labels || {};
    const remainingProperties = element.properties.filter((prop) => {
      switch (prop) {
        case "økologi":
        case "Økologisk":
          labels.organic = true;
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

  if (element?.safetyIcons && Array.isArray(element.safetyIcons)) {
    const labels = element.labels || {};
    const remainingSafetyIcons = element.safetyIcons.filter((icon) => {
      switch (icon.attributeName) {
        case "Brandfarligt":
          labels.flammable = true;
          return false;
        case "Akut forgiftning":
          labels.acutePoisoning = true;
          return false;
        case "Sundhedsfare":
          labels.healthWarning = true;
          return false;
        default:
          return true;
      }
    });

    // Update or remove safetyIcons array
    if (remainingSafetyIcons.length > 0) {
      element.safetyIcons = remainingSafetyIcons;
    } else {
      delete element.safetyIcons;
    }

    // Update labels if we found any matches
    if (Object.keys(labels).length > 0) {
      element.labels = labels;
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
            (item.title === "PANT (*1)" ||
              item.title === "Pant A (*1)" ||
              item.title === "Pant B (*1)" ||
              item.title === "Pant C (*1)" ||
              /^Pant [ABC] \(\*\d+\)$/.test(item.title)) &&
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
          if (item.title.startsWith("Pant A") || item.title === "PANT (*1)") {
            name = "Pant A";
          } else if (item.title.startsWith("Pant B")) {
            name = "Pant B";
          } else if (item.title.startsWith("Pant C")) {
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
    const nutritionalObj = element.infos.find((info) => info.code === "nutritional_100");
    if (nutritionalObj && nutritionalObj.items) {
      if (Array.isArray(nutritionalObj.items)) {
        const processedItems = [];
        const validNutritionalItems = nutritionalObj.items.map((item) => {
          const { type, title = "", value } = item;
          
          // Process the value
          let processedValue = value;
          if (processedValue === 0) {
            processedValue = "0";
          }
          if (typeof processedValue === 'number') {
            processedValue = processedValue.toString();
          }
          
          processedItems.push(item);
          return {
            title: title || "",
            value: processedValue || "0" // Default to "0" for empty/null values
          };
        }).filter(item => item.title); // Only keep items with a title
        
        if (validNutritionalItems.length > 0) {
          element.nutritional = validNutritionalItems;
          // Always remove since all items were processed
          element.infos = element.infos.filter((info) => info.code !== "nutritional_100");
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
const productDetailsObj = element.infos.find((info) => info.code === "product_details");
if (productDetailsObj && Array.isArray(productDetailsObj.items)) {
  const processedTitles = new Set();
  const informationalTexts = [];
  
  productDetailsObj.items.forEach((item) => {
    const { type, title, value } = item;
    
    // Handle combined format (e.g. "Pid: 41133")
    if (!title && value && typeof value === 'string') {
      // Check if it's a key:value pair
      if (value.includes(': ')) {
        const [fieldTitle, fieldValue] = value.split(': ').map(s => s.trim());
        
        switch(fieldTitle.toLowerCase()) {
          case 'pid':
            if (element?.id === undefined) {
              element.id = fieldValue || "";
            } else if (element?.id !== fieldValue) {
              element.productId = fieldValue || "";
            }
            processedTitles.add(fieldTitle);
            break;
            
          case 'article':
            if (!element.articleNumber) {
              element.articleNumber = fieldValue || "";
              processedTitles.add(fieldTitle);
            }
            break;
            
          case 'ean':
            if (element?.barcode === fieldValue) {
              element.barcode = fieldValue || "";
              processedTitles.add(fieldTitle);
            }
            if (element?.barcode === undefined) {
              element.barcode = fieldValue || "";
              processedTitles.add(fieldTitle);
            }
            break;
        }
      } else {
        // It's an informational text
        informationalTexts.push(value.trim());
      }
    } 
    // Handle separate title/value format
    else {
      switch (title) {
        case "Artikel":
        case "Article":
          if (!element.articleNumber) {
            element.articleNumber = value || "";
            processedTitles.add(title);
          }
          break;
        case "EAN":
          if (element?.barcode === value) {
            element.barcode = value || "";
            processedTitles.add(title);
          }
          if (element?.barcode === undefined) {
            element.barcode = value || "";
            processedTitles.add(title);
          }
          break;
        case "PID":
          if (element?.id === undefined) {
            element.id = value || "";
          } else if (element?.id !== value) {
            element.productId = value || "";
          }
          processedTitles.add(title);
          break;
        case "Netto mængde":
          if (!element.netQuantity) {
            element.netQuantity = value || "";
            processedTitles.add(title);
          }
          break;
        case "Produkt type":
          if (!element.productType) {
            element.productType = value || "";
            processedTitles.add(title);
          } else if (!element.productType2) {
            element.productType2 = value || "";
            processedTitles.add(title);
          }
          break;
      }
    }
  });

  // Add informational texts if any were found
  if (informationalTexts.length > 0) {
    element.productInformation = informationalTexts;
  }

  // Remove only the processed items
  productDetailsObj.items = productDetailsObj.items.filter((item) => {
    if (item.title) {
      return !processedTitles.has(item.title);
    }
    if (item.value && typeof item.value === 'string') {
      if (item.value.includes(': ')) {
        const fieldTitle = item.value.split(':')[0].trim();
        return !processedTitles.has(fieldTitle);
      }
      return false; // Remove informational texts as they've been processed
    }
    return true;
  });

  // Only remove the entire object if all items were processed
  if (productDetailsObj.items.length === 0) {
    element.infos = element.infos.filter((info) => info.code !== "product_details");
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
      const processedValues = [];
      const brandValues = brandObj.items
        .map((item) => {
          const { type, ...rest } = item;
          const value = rest.value || "";
          processedValues.push(value);
          return value;
        })
        .filter(Boolean);

      if (brandValues.length > 0 && !element.brand) {
        element.brand = brandValues[0];
        // Always remove since all items are processed
        element.infos = element.infos.filter((info) => info.code !== "brand");
      }
    }

    // Add this to the infos processing section:
const assetsObj = element.infos.find((info) => info.code === "assets");
if (assetsObj && Array.isArray(assetsObj.items)) {
  const originVarieties = [];
  
  assetsObj.items.forEach((item) => {
    const { type, value } = item;
    if (value && typeof value === 'string') {
      // Extract country and variety from format like "Italien (Golden Delicious)"
      const match = value.match(/^(.+?)\s*\((.+?)\)$/);
      if (match) {
        const [_, country, variety] = match;
        originVarieties.push({
          country: country.trim(),
          variety: variety.trim()
        });
      } else {
        // If it doesn't match the expected format, store the whole value
        originVarieties.push({
          value: value.trim()
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

    // Remove infos if empty
    if (element.infos.length === 0) {
      delete element.infos;
    }
  }

  if (element?.netcontent !== undefined) {
    element.netContent = element.netcontent;
    delete element.netcontent;
  }


  return element;
}