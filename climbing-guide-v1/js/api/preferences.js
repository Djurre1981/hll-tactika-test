export async function patchViewerPreferences(preferences) {
  const response = await fetch("/api/auth/preferences", {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Failed to save viewer preferences");
  }
  return data;
}
