export async function patchViewerPreferences(preferences) {
  const response = await fetch("/api/auth/preferences", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });
  if (!response.ok) {
    throw new Error("Failed to save viewer preferences");
  }
  return response.json();
}
