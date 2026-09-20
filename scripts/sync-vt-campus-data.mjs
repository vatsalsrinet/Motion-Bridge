import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = path.join(ROOT, "server", "data", "seed-campus-locations.json");
const GIS_ROOT = "https://arcgis-central.gis.vt.edu/arcgis/rest/services/vtcampusmap";

const queryLayer = async (url, outFields) => {
  const params = new URLSearchParams({
    where: "1=1",
    outFields,
    returnGeometry: "false",
    resultRecordCount: "2000",
    f: "json"
  });
  const response = await fetch(`${url}/query?${params}`);
  if (!response.ok) throw new Error(`VT GIS request failed (${response.status})`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? "VT GIS returned an error");
  return payload.features.map((feature) => feature.attributes);
};

const clean = (value) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed === "<Null>" ? "" : trimmed;
};

const slugify = (value) => value
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)/g, "");

const categoryFor = (name, use) => {
  const normalized = `${name} ${use}`.toLowerCase();
  if (/library|student center|graduate life|torgersen/.test(normalized)) return "study";
  if (/dietrick|owens|cochrane|lavery|dining|food|market|restaurant|cafe|grill/.test(normalized)) return "dining";
  if (/athletic|gym|stadium|coliseum|field house|recreation/.test(normalized)) return "recreation";
  if (/residential|residence|house|hall east|hall west/.test(normalized) || /residential/.test(use.toLowerCase())) return "residential";
  if (/academic|classroom|institute|laboratory|research/.test(normalized)) return "academic";
  if (/crc|corporate research/.test(normalized)) return "research";
  return "campus service";
};

const hoursFor = (name, category) => {
  if (name === "Pamplin Hall") {
    return {
      weekdays: "7:00 AM – 11:00 PM",
      weekends: "7:00 AM – 11:00 PM",
      status: "published",
      note: "Published building hours; holidays and university closures may differ.",
      sourceUrl: "https://pamplin.vt.edu/about/facilities/pamplin-hall.html"
    };
  }

  const typical = {
    study: ["7:30 AM – 10:00 PM", "9:00 AM – 8:00 PM"],
    academic: ["7:30 AM – 10:00 PM", "9:00 AM – 6:00 PM"],
    dining: ["7:00 AM – 9:00 PM", "8:00 AM – 8:00 PM"],
    recreation: ["6:00 AM – 11:00 PM", "8:00 AM – 10:00 PM"],
    residential: ["Resident access: 24 hours", "Resident access: 24 hours"],
    research: ["8:00 AM – 6:00 PM", "Closed"],
    "campus service": ["8:00 AM – 5:00 PM", "Closed"]
  };
  const [weekdays, weekends] = typical[category] ?? typical["campus service"];
  return {
    weekdays,
    weekends,
    status: "typical",
    note: "Typical planning hours based on location type, not a live building schedule. Verify before visiting.",
    sourceUrl: "https://www.vt.edu/status.html"
  };
};

const addressFor = (building) => {
  const parts = [building.stnum, clean(building.stpredir), clean(building.stname), clean(building.stsuffix)]
    .filter((part) => part !== null && part !== undefined && String(part).trim());
  return parts.length ? parts.join(" ") : undefined;
};

const main = async () => {
  const [buildings, entrances, elevators] = await Promise.all([
    queryLayer(`${GIS_ROOT}/Buildings/FeatureServer/0`, "name,bldg_num,bldg_use,status,latitude,longitude,community,stnum,stpredir,stname,stsuffix,url"),
    queryLayer(`${GIS_ROOT}/Accessibility/MapServer/3`, "bldg_id,type"),
    queryLayer(`${GIS_ROOT}/Accessibility/MapServer/5`, "building,building_number,ada_compliant,current_status")
  ]);

  const entrancesByBuilding = Map.groupBy(
    entrances.filter((item) => clean(item.bldg_id)),
    (item) => clean(item.bldg_id).padStart(4, "0")
  );
  const elevatorsByBuilding = Map.groupBy(
    elevators.filter((item) => clean(item.building_number)),
    (item) => clean(item.building_number).padStart(4, "0")
  );

  const seen = new Set();
  const locations = buildings
    .filter((building) => {
      const name = clean(building.name);
      const buildingId = clean(building.bldg_num);
      const community = clean(building.community).toUpperCase();
      return name && buildingId && building.status === "Existing Conditions" &&
        (community === "VIRGINIA TECH" || community === "BLACKSBURG");
    })
    .filter((building) => {
      const key = clean(building.bldg_num);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((building) => {
      const buildingId = clean(building.bldg_num);
      const buildingEntrances = entrancesByBuilding.get(buildingId) ?? [];
      const buildingElevators = elevatorsByBuilding.get(buildingId) ?? [];
      const accessibleEntrance = buildingEntrances.some((entry) => /^Accessible Entrance/i.test(clean(entry.type)));
      const automaticDoor = buildingEntrances.some((entry) => /^Accessible Entrance with Automatic Door$/i.test(clean(entry.type)));
      const elevatorAvailable = buildingElevators.some((entry) =>
        clean(entry.current_status) !== "Closed for repairs" && clean(entry.ada_compliant).toUpperCase() !== "N"
      );
      const facts = [];
      if (accessibleEntrance) facts.push("an accessible entrance");
      if (automaticDoor) facts.push("an automatic door");
      if (elevatorAvailable) facts.push("an elevator");
      const category = categoryFor(clean(building.name), clean(building.bldg_use));
      const operatingHours = hoursFor(clean(building.name), category);

      return {
        id: `${slugify(clean(building.name))}-${buildingId.toLowerCase()}`,
        buildingId,
        name: clean(building.name),
        category,
        operatingHours,
        ...(Number.isFinite(building.latitude) ? { latitude: building.latitude } : {}),
        ...(Number.isFinite(building.longitude) ? { longitude: building.longitude } : {}),
        ...(addressFor(building) ? { address: addressFor(building) } : {}),
        ...(clean(building.url) ? { sourceUrl: clean(building.url) } : {}),
        accessibility: {
          accessibleEntrance,
          automaticDoor,
          elevatorAvailable,
          accessibleRoute: accessibleEntrance,
          notes: facts.length
            ? `Virginia Tech's accessibility map lists ${facts.join(", ")} for this building.`
            : "No entrance or elevator feature is listed for this building in the Virginia Tech accessibility map snapshot."
        },
        activeImpacts: []
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  await writeFile(OUTPUT, `${JSON.stringify(locations, null, 2)}\n`, "utf8");
  console.log(`Saved ${locations.length} official VT campus locations to ${OUTPUT}`);
};

await main();
