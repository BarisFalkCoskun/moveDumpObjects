export function processLabels(element) {
  // Ensure labels object exists without overwriting
  if (!element.labels) {
    element.labels = {};
  }

  // Unified mapping for both attributes and properties
  const labelMapping = {
    oekologisk_eu: "organicEU",
    glutenfri: "glutenFree",
    oekologisk_dk: "organicDK",
    laktosefri: "lactoseFree",
    fairtrade: "fairtrade",
    fuldkorn: "wholemeal",
    noglehuller: "noglehul",
    frost: "frost",
    svanemaerket: "svanemaerket",
    msc: "msc",
    asc: "asc",
    utz: "utz",
    rainforest_alliance: "rainforestAlliance",
    vegan: "vegan",
    dyrevelfaerd: "animalWelfare",
    astma_allergi: "asthmaAllergy",
    fsc: "fsc",
    oeko_tex: "oekoTex",
    rspo: "rspo",
    dyrenes_beskyttelse: "dyrenesBeskyttelse",
    csr: "csr",
    dansk: "danish",
    dansk_flag: "danish",
    sukkerfri: "sugarFree",
    fsc_forest: "fscForest",
    recycled: "recycled",
    ecocert: "ecocert",
    dansk_maelk: "danishMilk",
    vegetar: "vegetarian",
    eco_natural_detergent: "ecocertNaturalDetergent",
    eco_cosmos_natural: "ecocertCosmosNatural",
    eco_cosmos_organic: "ecocertCosmosOrganic",
    allergy_certified: "allergyCertified",
    organic_cotton: "organicCotton",
    karakteristika: "karakteristika",
    pefc: "pefc",
    other_organic: "otherOrganicLabels",
    recycled_material: "recycledMaterial",
    gmo_free: "gmoFree",
    no_added_sugar: "noAddedSugar",
    eu_ecolabel: "euEcolabel",
    biodegradable: "biodegradable",
    halal: "halal",
    maerkning: "maerkning",
    natural_organic: "naturalOrganic",
    additives: "additives",
    test_approvals: "testApprovals",
    state_organic: "stateOrganic",
    allergi_venlig: "allergyFriendly",
    "allergi venlig": "allergyFriendly",
    "Allergi Venlig": "allergyFriendly",
    fairtrade: "fairtrade",
    Fairtrade: "fairtrade",
    fuldkorn: "wholemeal",
    Fuldkorn: "wholemeal",
    Fuldkornsmærket: "wholemeal",
    fuldkornsmaerket: "wholemeal",
    glutenfri: "glutenFree",
    Glutenfri: "glutenFree",
    lactosefri: "lactoseFree",
    Lactosefri: "lactoseFree",
    Laktosefri: "lactoseFree",
    økologi: "organicDK",
    Økologisk: "organicDK",
    "Økomærket DK": "organicDK",
    nøglehul: "noglehul",
    Nøglehul: "noglehul",
    Nøglehulsmærket: "noglehul",
    noeglehulsmaerket: "noglehul",
    Frost: "frost",
    Svanemærket: "svanemaerket",
    "Økomærket EU": "organicEU",
    "Bæredygtig vildtfangede fisk og skaldyr - MSC mærket": "msc",
    "Bæredygtig opdrættede fisk - ASC mærket": "asc",
    UTZ: "utz",
    "Rainforest Alliance": "rainforestAlliance",
    Rainforest_Alliance: "rainforestAlliance",
    Vegan: "vegan",
    Vegansk: "vegan",
    "Bedre Dyrevelfærd": "animalWelfare",
    "Astma- og allergimærket": "asthmaAllergy",
    astma_og_allergimaerket: "asthmaAllergy",
    "Uden farvestoffer": "noColorants",
    FSC: "fsc",
    "FSC-certificeret": "fsc",
    "FSC®-certificeret": "fsc",
    "OEKO-TEX": "oekoTex",
    RSPO: "rspo",
    Oliefri: "oilFree",
    "Anbefalet af Dyrenes Beskyttelse": "dyrenesBeskyttelse",
    "CSR Mærker": "csr",
    Dansk: "danish",
    Sukkerfri: "sugarFree",
    "Forest For All Forever - FSC mærket": "fscForest",
    Recycled: "recycled",
    "ECO-certificeret": "ecocert",
    Ecocert: "ecocert",
    "Dansk mælk": "danishMilk",
    "Uden kamfer": "noCamphor",
    Vegetar: "vegetarian",
    Vegetarisk: "vegetarian",
    "Ecocert Natural Detergent": "ecocertNaturalDetergent",
    "Ecocert Cosmos Natural": "ecocertCosmosNatural",
    "ecocert_cosmos_organic": "ecocertCosmosOrganic",
    "Ecocert Cosmos Organic": "ecocertCosmosOrganic",
    "Allergy Certified": "allergyCertified",
    "Organic cotton": "organicCotton",
    "Økologisk bomuld": "organicCotton",
    Karakteristika: "karakteristika",
    "Uden toluen": "noToluene",
    PEFC: "pefc",
    "Andre økologimærker": "otherOrganicLabels",
    "Indeholder genanvendt materiale": "recycledMaterial",
    "GMO free": "gmoFree",
    "Uden tilsat sukker": "noAddedSugar",
    "EU Ecolabel": "euEcolabel",
    Biodegradable: "biodegradable",
    Halal: "halal",
    Mærkning: "maerkning",
    "Naturlig og økologisk": "naturalOrganic",
    Tilsætningsstoffer: "additives",
    "Test og godkendelser": "testApprovals",
    "Statskontrolleret økologisk": "stateOrganic",
    CORROSION: "corrosion",
    EXCLAMATION_MARK: "healthRisk",
    FLAME: "inflammable",
    HEALTH_HAZARD: "healthHazard",
    ENVIRONMENT: "environmentallyHazardous",
    FLAME_OVER_CIRCLE: "hazardousOxidizing",
    SKULL_AND_CROSSBONES: "acutePoisoning",
    EXPLODING_BOMB: "explosive",
    GAS_CYLINDER: "gasCylinder",
    dyrevelfaerd_2: "dyrevelfaerd2",
    "Bedre dyrevelfærd - hjerte2": "dyrevelfaerd2",
    "HEARTS-2": "dyrevelfaerd2",
    "dyrevelfaerd_1": "dyrevelfaerd1",
    "GMO fri": "gmoFree",
    Alkoholfri: "alcoholFree",
    "Astma Allergi Danmark": "asthmaAllergy",
    dyrevelfaerd_3: "dyrevelfaerd3",
    vegansk: "vegan",
    anbefalet_af_dyrenes_beskyttelse: "dyrenesBeskyttelse",
    Solbeskyttelse: "sunProtection",
    Parfumefri: "perfumeFree",
    "Dermatologisk testet": "dermatologicallyTested",
    "Ikke testet på dyr": "notTestedOnAnimals",
  };

  // Process attributes array if it exists
  if (
    element?.attributes &&
    Array.isArray(element.attributes) &&
    element.attributes.length > 0
  ) {
    const remainingAttributes = element.attributes.filter((attr) => {
      const iconId = attr.attributeIconID;
      if (iconId && labelMapping[iconId]) {
        // Set the corresponding label to true
        element.labels[labelMapping[iconId]] = true;
        return false; // Remove this attribute from the array
      }
      return true; // Keep this attribute in the array
    });

    // Update or delete the attributes array
    if (remainingAttributes.length > 0) {
      element.attributes = remainingAttributes;
    } else {
      delete element.attributes;
    }
  }

  // Process properties array if it exists
  if (
    element?.properties &&
    Array.isArray(element.properties) &&
    element.properties.length > 0
  ) {
    const remainingProperties = element.properties.filter((prop) => {
      if (labelMapping[prop]) {
        // Set the corresponding label to true
        element.labels[labelMapping[prop]] = true;
        return false; // Remove this property from the array
      }
      return true; // Keep this property in the array
    });

    // Update or delete the properties array
    if (remainingProperties.length > 0) {
      element.properties = remainingProperties;
    } else {
      delete element.properties;
    }
  }

  if (
    element?.safetyIcons &&
    Array.isArray(element.safetyIcons) &&
    element.safetyIcons.length > 0
  ) {
    // Check if there's only a NO_PICTOGRAM entry - if so, just delete the entire array
    if (
      element.safetyIcons.length === 1 &&
      element.safetyIcons[0].attributeIconID === "NO_PICTOGRAM"
    ) {
      delete element.safetyIcons;
    } else {
      // Ensure safety object exists if we have safety icons
      if (!element.safety) {
        element.safety = {};
      }

      const remainingSafetyIcons = element.safetyIcons.filter((icon) => {
        const iconId = icon.attributeIconID;

        // Always remove NO_PICTOGRAM entries
        if (iconId === "NO_PICTOGRAM") {
          return false;
        }

        if (iconId && labelMapping[iconId]) {
          // Set the corresponding safety label to true
          element.safety[labelMapping[iconId]] = true;
          return false; // Remove this safety icon from the array
        }
        return true; // Keep this safety icon in the array
      });

      // Update or delete the safetyIcons array
      if (remainingSafetyIcons.length > 0) {
        element.safetyIcons = remainingSafetyIcons;
      } else {
        delete element.safetyIcons;
      }

      // Process safetyText if it exists
      if (
        element.safetyTexts &&
        Array.isArray(element.safetyTexts) &&
        element.safetyTexts.length > 0
      ) {
        // Move warnings to element.warnings if it doesn't already exist
        if (element.warnings === undefined) {
          element.warnings = element.safetyTexts.map((item) => ({
            title: item.title || "",
            text: item.text || "",
          }));
        }

        // Remove the original safetyText array
        delete element.safetyTexts;
      }
    }
  }

  if (element?.safety && typeof element.safety === "object") {
    // Get all safety properties except 'warnings'
    const safetyProperties = Object.keys(element.safety).filter(
      (key) => key !== "warnings"
    );

    // Process each safety property
    safetyProperties.forEach((key) => {
      if (element.safety[key] === true) {
        // Move the flag to labels object
        element.labels[key] = true;
      }
    });

    // Move warnings to its own field if it exists and the target field doesn't
    if (
      element.safety.warnings &&
      Array.isArray(element.safety.warnings) &&
      element.safety.warnings.length > 0
    ) {
      if (element.warnings === undefined) {
        element.warnings = element.safety.warnings;
      }
    }

    // Delete the safety object as we've moved everything
    delete element.safety;
  }

  // Remove labels if empty
  if (Object.keys(element.labels).length === 0) {
    delete element.labels;
  }

  // Process awards array if it exists
  if (
    element?.awards &&
    Array.isArray(element.awards) &&
    element.awards.length > 0
  ) {
    element.awards = element.awards.map((award) => {
      // Create a new object with the desired structure
      const newAward = {
        name: award.long || award.short || "", // Rename 'long' to 'name', fallback to 'short' if 'long' is missing
      };

      // Optionally include 'short' if it's different from 'long' and not empty
      if (award.short && award.short !== award.long) {
        newAward.shortName = award.short;
      }

      return newAward;
    });
  }

  return element;
}