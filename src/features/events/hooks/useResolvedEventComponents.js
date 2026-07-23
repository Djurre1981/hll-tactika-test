import { useQueries } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../lib/api-client.js";
import {
  COMPONENT_KINDS,
  listEventComponentSlots,
  resolveComponentStatus,
} from "../event-brief-utils.js";

async function fetchComponentSlot({ kind, id }) {
  const def = COMPONENT_KINDS[kind];
  if (!def) {
    throw new ApiError("Unknown component kind", { status: 400 });
  }

  try {
    const body = await apiClient(def.fetchPath(id));
    const title = def.pickTitle(body) || def.fallbackTitle;
    return {
      kind,
      id,
      status: "ok",
      title: String(title).trim() || def.fallbackTitle,
      href: def.href(id),
      label: def.label,
    };
  } catch (error) {
    const status = resolveComponentStatus(error instanceof ApiError ? error : null);
    return {
      kind,
      id,
      status,
      title: def.fallbackTitle,
      href: status === "ok" ? def.href(id) : null,
      label: def.label,
      message: error instanceof ApiError ? error.message : "Request failed",
    };
  }
}

export function useResolvedEventComponents(components) {
  const slots = listEventComponentSlots(components);

  const queries = useQueries({
    queries: slots.map((slot) => ({
      queryKey: ["event-brief-component", slot.kind, slot.id],
      queryFn: () => fetchComponentSlot(slot),
      staleTime: 60_000,
      retry: false,
    })),
  });

  const resolved = queries.map((query, index) => {
    const slot = slots[index];
    if (query.isLoading) {
      return {
        ...slot,
        status: "loading",
        title: COMPONENT_KINDS[slot.kind]?.fallbackTitle || slot.kind,
        href: COMPONENT_KINDS[slot.kind]?.href(slot.id),
        label: COMPONENT_KINDS[slot.kind]?.label || slot.kind,
      };
    }
    if (query.isError && !query.data) {
      return {
        ...slot,
        status: resolveComponentStatus(query.error instanceof ApiError ? query.error : null),
        title: COMPONENT_KINDS[slot.kind]?.fallbackTitle || slot.kind,
        href: null,
        label: COMPONENT_KINDS[slot.kind]?.label || slot.kind,
      };
    }
    return query.data || {
      ...slot,
      status: "error",
      title: COMPONENT_KINDS[slot.kind]?.fallbackTitle || slot.kind,
      href: null,
      label: COMPONENT_KINDS[slot.kind]?.label || slot.kind,
    };
  });

  return {
    slots,
    resolved,
    isLoading: queries.some((query) => query.isLoading),
  };
}
