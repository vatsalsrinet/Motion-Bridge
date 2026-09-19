import { SearchConstraints } from "../agent/SearchConstraints";

export const buildLocationQuery = (constraints: SearchConstraints): string => {
  const filters = ["1 = 1"];
  if (constraints.category) filters.push("p.category = :category");
  if (constraints.openAfter) filters.push("p.close_time >= :openAfter");
  if (constraints.needsAccessibleEntrance) filters.push("a.accessible_entrance = true");
  if (constraints.needsAutomaticDoor) filters.push("a.automatic_door = true");
  if (constraints.needsElevator) filters.push("e.elevator_available = true");
  if (constraints.avoidActiveImpacts) filters.push("i.id IS NULL");

  return `
    SELECT
      p.id, p.name, p.category, p.latitude, p.longitude,
      p.open_time AS openTime, p.close_time AS closeTime,
      p.building_id AS buildingId,
      a.accessible_entrance AS accessibleEntrance,
      a.automatic_door AS automaticDoor,
      a.accessible_route AS accessibleRoute,
      a.notes AS accessibilityNotes,
      e.elevator_available AS elevatorAvailable,
      i.id AS impactId, i.type AS impactType, i.description AS impactDescription
    FROM campus_places p
    LEFT JOIN accessible_entrances a ON a.building_id = p.building_id
    LEFT JOIN elevators e ON e.building_id = p.building_id
    LEFT JOIN campus_impacts i ON i.building_id = p.building_id
    WHERE ${filters.join(" AND ")}
    ORDER BY p.close_time DESC, p.name ASC
  `;
};
