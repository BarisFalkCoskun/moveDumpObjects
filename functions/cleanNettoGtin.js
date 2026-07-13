export function cleanNettoGtin(element) {
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
  delete element.cpOffer;
  delete element.hasimage;

  if (element?.gtin !== undefined) {
    element.barcode = element.gtin;
    delete element.gtin;
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

  if (element?.Brand !== undefined && element?.brand === undefined) {
    element.brand = element.Brand;
    delete element.Brand;
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

  if (element?.properties && Array.isArray(element.properties)) {
    // Create labels object if it doesn't exist
    if (!element.labels) {
      element.labels = {};
    }

    // Process properties and update labels
    const propertiesToKeep = element.properties.filter((prop) => {
      switch (prop) {
        case "allergi venlig":
        case "Allergi Venlig":
          element.labels.allergyFriendly = true;
          return false;
        case "fairtrade":
        case "Fairtrade":
          element.labels.fairtrade = true;
          return false;
        case "fuldkorn":
        case "Fuldkorn":
        case "Fuldkornsmærket":
          element.labels.wholemeal = true;
          return false;
        case "glutenfri":
        case "Glutenfri":
          element.labels.glutenFree = true;
          return false;
        case "lactosefri":
        case "Lactosefri":
        case "Laktosefri":
          element.labels.lactoseFree = true;
          return false;
        case "økologi":
        case "Økologisk":
        case "Økomærket DK":
          element.labels.organicDK = true;
          return false;
        case "nøglehul":
        case "Nøglehul":
        case "Nøglehulsmærket":
          element.labels.noglehul = true;
          return false;
        case "Frost":
          element.labels.frost = true;
          return false;
        case "Svanemærket":
          element.labels.svanemaerket = true;
          return false;
        case "Økomærket EU":
          element.labels.organicEU = true;
          return false;
        case "Bæredygtig vildtfangede fisk og skaldyr - MSC mærket":
          element.labels.msc = true;
          return false;
        case "Bæredygtig opdrættede fisk - ASC mærket":
          element.labels.asc = true;
          return false;
        case "UTZ":
          element.labels.utz = true;
          return false;
        case "Rainforest Alliance":
          element.labels.rainforestAlliance = true;
          return false;
        case "Vegan":
        case "Vegansk":
          element.labels.vegan = true;
          return false;
        case "Bedre Dyrevelfærd":
          element.labels.animalWelfare = true;
          return false;
        case "Astma- og allergimærket":
          element.labels.asthmaAllergy = true;
          return false;
        case "FSC-certificeret":
        case "FSC®-certificeret":
          element.labels.fsc = true;
          return false;
        case "OEKO-TEX":
          element.labels.oekoTex = true;
          return false;
        case "RSPO":
          element.labels.rspo = true;
          return false;
        case "Anbefalet af Dyrenes Beskyttelse":
          element.labels.dyrenesBeskyttelse = true;
          return false;
        case "CSR Mærker":
          element.labels.csr = true;
          return false;
        case "Dansk":
          element.labels.danish = true;
          return false;
        case "Sukkerfri":
          element.labels.sugarFree = true;
          return false;
        case "Forest For All Forever - FSC mærket":
          element.labels.fscForest = true;
          return false;
        case "Recycled":
          element.labels.recycled = true;
          return false;
        case "Ecocert":
          element.labels.ecocert = true;
          return false;
        case "Dansk mælk":
          element.labels.danishMilk = true;
          return false;
        case "Vegetar":
        case "Vegetarisk":
          element.labels.vegetarian = true;
          return false;
        case "Ecocert Natural Detergent":
          element.labels.ecocertNaturalDetergent = true;
          return false;
        case "Ecocert Cosmos Natural":
          element.labels.ecocertCosmosNatural = true;
          return false;
        case "Ecocert Cosmos Organic":
          element.labels.ecocertCosmosOrganic = true;
          return false;
        case "Allergy Certified":
          element.labels.allergyCertified = true;
          return false;
        case "Organic cotton":
        case "Økologisk bomuld":
          element.labels.organicCotton = true;
          return false;
        case "Karakteristika":
          element.labels.karakteristika = true;
          return false;
        case "PEFC":
          element.labels.pefc = true;
          return false;
        case "Andre økologimærker":
          element.labels.otherOrganicLabels = true;
          return false;
        case "Indeholder genanvendt materiale":
          element.labels.recycledMaterial = true;
          return false;
        case "GMO free":
          element.labels.gmoFree = true;
          return false;
        case "Uden tilsat sukker":
          element.labels.noAddedSugar = true;
          return false;
        case "EU Ecolabel":
          element.labels.euEcolabel = true;
          return false;
        case "Biodegradable":
          element.labels.biodegradable = true;
          return false;
        case "Halal":
          element.labels.halal = true;
          return false;
        case "Mærkning":
          element.labels.maerkning = true;
          return false;
        case "Naturlig og økologisk":
          element.labels.naturalOrganic = true;
          return false;
        case "Tilsætningsstoffer":
          element.labels.additives = true;
          return false;
        case "Test og godkendelser":
          element.labels.testApprovals = true;
          return false;
        case "Statskontrolleret økologisk":
          element.labels.stateOrganic = true;
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

  if (element?.units !== undefined && element?.units === 0) {
    delete element.units;
  }

  if (
    element?.articleId !== undefined &&
    typeof element.articleId === "string" &&
    element.articleId.includes(";")
  ) {
    element.articleId = element.articleId.split(";").map((id) => id.trim());
  }

  if (element?.article !== undefined && element?.articleId !== undefined) {
    if (Array.isArray(element.articleId)) {
      // If articleId is already an array, check if article is in the array
      if (element.articleId.includes(element.article)) {
        delete element.article;
      }
    } else if (element.article === element.articleId) {
      // Direct comparison if articleId is a single value
      delete element.article;
    }
  }

  if (element?.searchHierachy && Array.isArray(element.searchHierachy)) {
    element.searchHierachy = element.searchHierachy.filter(
      (item) =>
        item !== "Not Categorized" &&
        item !== "Consumer Faced Hierarchy Generic" &&
        item !== "Classification 1 root"
    );

    if (element.searchHierachy.length === 0) {
      delete element.searchHierachy;
    }
  }

  if (element?.objectID !== undefined && element?.articleId !== undefined) {
    if (Array.isArray(element.articleId)) {
      // If articleId is an array, check if objectID exists in it
      if (element.articleId.includes(element.objectID)) {
        delete element.objectID;
      }
    } else if (element.objectID === element.articleId) {
      // Direct comparison if articleId is a single value
      delete element.objectID;
    }
  }

  if (
    element?.article !== undefined &&
    element?.articleId !== undefined &&
    element.article === element.articleId
  ) {
    delete element.article;
  }

  const guidsSet = new Set();

  // Process images array
  if (
    element?.images !== undefined &&
    Array.isArray(element.images) &&
    element.images.length > 0 &&
    element.images.some((url) => url.includes("imgix"))
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

  if (guidsSet.size > 0) {
    element.images = Array.from(guidsSet)
      .sort()
      .map(
        (guid) => `https://digitalassets.sallinggroup.com/image/upload/${guid}`
      );
  }

  return element;
}