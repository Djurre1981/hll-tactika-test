import { useCallback, useState } from "react";

const KEY = "tactika:text-favorite-colors";

function readFavorites() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((c) => typeof c === "string").slice(0, 24) : [];
  } catch {
    return [];
  }
}

export function useFavoriteColors() {
  const [favorites, setFavorites] = useState(readFavorites);

  const addFavorite = useCallback((color) => {
    const hex = String(color || "").trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
    setFavorites((prev) => {
      const next = [hex, ...prev.filter((c) => c.toLowerCase() !== hex.toLowerCase())].slice(0, 24);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { favorites, addFavorite };
}
