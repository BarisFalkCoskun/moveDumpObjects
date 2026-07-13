function cleanNetto(element) {
  delete element.multipromos;

  if (element?.alternativeSearchWords !== undefined) {
    element.ids = element.alternativeSearchWords;
    delete element.alternativeSearchWords;
  }

  if (element?.article !== undefined && element?.articleId === undefined) {
    element.articleId = element.article;
    delete element.article;
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
        (guid) => `https://digitalassets.sallinggroup.com/image/upload/${guid}`,
      );
  }

  if (anglesSet.size > 0) {
    element.oldImages = Array.from(anglesSet)
      .sort((a, b) => a - b)
      .map(
        (angle) =>
          `https://image.prod.iposeninfra.com/bilkaimg.php?pid=${element.id}&imgType=jpeg&imgSize=default&angle=${angle}`,
      );
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
      (info) => info.code === "description",
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
          (info) => info.code !== "description",
        );
      }
    }

    // Find and process ingredients objects
    const ingredientsObj = element.infos.find(
      (info) => info.code === "ingredients",
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
          (info) => info.code !== "ingredients",
        );
      }
    }

    // Find and process nutritional_100 objects
    const nutritionalObj = element.infos.find(
      (info) => info.code === "nutritional_100",
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
              (info) => info.code !== "nutritional_100",
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
      (info) => info.code === "product_details",
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
        }
      });

      // Remove only the processed items
      productDetailsObj.items = productDetailsObj.items.filter(
        (item) => !processedTitles.has(item.title),
      );

      // Only remove the entire object if all items were processed
      if (productDetailsObj.items.length === 0) {
        element.infos = element.infos.filter(
          (info) => info.code !== "product_details",
        );
      }
    }

    // Find and process productsspecifications/productspecification objects
    const specificationsObj = element.infos.find(
      (info) =>
        info.code === "productsspecifications" ||
        info.code === "productspecification",
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
            info.code !== "productspecification",
        );
      }
    }

    // Find and process safetyinformation objects
    const safetyObj = element.infos.find(
      (info) => info.code === "safetyinformation",
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
          (info) => info.code !== "safetyinformation",
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