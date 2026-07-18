import { useEffect, useState } from "react";

export function clearAuthQuery() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("auth")) return;
  url.searchParams.delete("auth");
  url.searchParams.delete("steamId");
  window.history.replaceState({}, "", url.pathname + url.search + url.hash);
}

export function parseAuthQuery() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");

  if (auth === "forbidden") {
    return { view: "bye", error: null };
  }

  if (auth === "error") {
    return {
      view: "welcome",
      error: { message: "Steam sign-in failed. Please try again.", showLogin: true },
    };
  }

  return { view: "welcome", error: null };
}

export function useAuthQueryParams() {
  const [state, setState] = useState({ ready: false, view: "welcome", error: null });

  useEffect(() => {
    const parsed = parseAuthQuery();
    setState({ ready: true, ...parsed });
    clearAuthQuery();
  }, []);

  return state;
}
