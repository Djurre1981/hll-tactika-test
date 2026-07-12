export async function loadSpawnData() {
  try {
    const response = await fetch("data/map-spawns.json");
    if (!response.ok) throw new Error("Failed to load map spawn data");
    return response.json();
  } catch (error) {
    console.warn(error);
    return { maps: [] };
  }
}
