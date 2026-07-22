import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { STRAT_MAP_IDS } from "../strats/editor/mapIds.js";
import { FACTIONS, ROUTE_COLORS } from "./constants.js";
import { RouteMapCanvas } from "./RouteMapCanvas.jsx";
import { RouteOverlay } from "./RouteOverlay.jsx";
import { ObstacleOverlay } from "./ObstacleOverlay.jsx";
import { ObstacleToolbar } from "./ObstacleToolbar.jsx";
import { MapDimOverlay } from "./MapDimOverlay.jsx";
import { RoutesPanel } from "./RoutesPanel.jsx";
import { loadAccessibilityGrid } from "./path/accessibility-grid.js";
import {
  loadAccessibilityVectors,
  mergeAccessibilityObstacles,
  needsObstacleVectorUpgrade,
  clearAccessibilityVectorsCache,
} from "./obstacles/load-accessibility-vectors.js";
import { extractObstaclesFromGrid } from "./obstacles/extract-obstacles-from-grid.js";
import {
  planRoute,
  replanThroughWaypoints,
  getRouteWaypoints,
  insertWaypointOnPath,
  removeWaypoint,
} from "./path/plan-route.js";
import { travelTimeSec } from "./timing/travel-time.js";
import { clearEffectiveGridCache } from "./obstacles/obstacle-grid.js";
import {
  applyObstacleAnchorDrag,
  applyObstacleHandleDrag,
  clampPoint,
  createPolygonObstacle,
  insertPolygonVertex,
  isNearPoint,
  nudgeObstaclePoints,
  obstacleToPolygonPoints,
  PEN_CLOSE_THRESHOLD,
  removePolygonVertex,
  resolvePenTarget,
} from "./obstacles/obstacle-shapes.js";
import { getDefaultTransportSpeedKmh } from "./timing/vehicle-speeds.js";

const TRANSPORT_SPEED_KMH = getDefaultTransportSpeedKmh();
const PANEL_WIDTH = 280;
const OBSTACLE_PANEL_WIDTH = "min(320px, calc(100vw - 3rem))";
const PANEL_GAP = 16;

function nextRouteColor(index) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

export function RouteplannerEditor({
  plan,
  onSave,
  saving = false,
  dirty = false,
  backTo = "/home",
}) {
  const kernelRef = useRef(null);
  const dragRef = useRef(null);
  const routesRef = useRef(plan?.routes || []);
  const replanSeqRef = useRef(0);
  const obstacleInteractionRef = useRef(null);
  const shellRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);

  const [mapId, setMapId] = useState(plan?.mapId || "Carentan");
  const [factionId, setFactionId] = useState(plan?.factionId || "us");
  const [hqIndex, setHqIndex] = useState(plan?.hqIndex ?? 0);
  const [routes, setRoutes] = useState(plan?.routes || []);
  const [obstacles, setObstacles] = useState(plan?.obstacles || []);
  routesRef.current = routes;
  const obstaclesRef = useRef(obstacles);
  obstaclesRef.current = obstacles;
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [hoveredRouteId, setHoveredRouteId] = useState(null);
  const [plottingRouteId, setPlottingRouteId] = useState(null);
  const [hqData, setHqData] = useState(null);
  const [status, setStatus] = useState("");
  const [kernelReady, setKernelReady] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [showObstacles, setShowObstacles] = useState(false);
  const [obstacleEditMode, setObstacleEditMode] = useState(false);
  const [obstacleTool, setObstacleTool] = useState("select");
  const [obstaclePenEffect, setObstaclePenEffect] = useState("block");
  const [selectedObstacleId, setSelectedObstacleId] = useState(null);
  const [penDrawPreview, setPenDrawPreview] = useState(null);
  const [penHoverTarget, setPenHoverTarget] = useState(null);
  const penSessionRef = useRef(null);
  const [panelInsets, setPanelInsets] = useState({
    left: 0,
    right: 0,
    top: 72,
    bottom: 16,
  });

  useEffect(() => {
    fetch("/data/hq-spawns.json")
      .then((r) => r.json())
      .then(setHqData)
      .catch(() => setStatus("Could not load HQ spawn data."));
  }, []);

  useEffect(() => {
    const measure = () => {
      const shell = shellRef.current;
      const left = leftRef.current;
      const right = rightRef.current;
      if (!shell) return;
      const shellRect = shell.getBoundingClientRect();
      const leftRect = left?.getBoundingClientRect();
      const rightRect = right?.getBoundingClientRect();
      setPanelInsets({
        left: leftRect ? Math.max(0, leftRect.right - shellRect.left + PANEL_GAP) : 0,
        right: rightRect ? Math.max(0, shellRect.right - rightRect.left + PANEL_GAP) : 0,
        top: 72,
        bottom: 16,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (shellRef.current) ro.observe(shellRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [showObstacles]);

  const hqSpawns = useMemo(() => {
    return hqData?.maps?.[mapId]?.factions?.[factionId]?.hqSpawns || [];
  }, [hqData, mapId, factionId]);

  const selectedHq = hqSpawns[hqIndex] || null;

  const persistPatch = useCallback(
    (patch) => {
      onSave?.({
        mapId,
        factionId,
        hqIndex,
        routes,
        obstacles,
        ...patch,
      });
    },
    [onSave, mapId, factionId, hqIndex, routes, obstacles]
  );

  const applyObstacles = useCallback(
    (nextObstacles) => {
      setObstacles(nextObstacles);
      persistPatch({ obstacles: nextObstacles });
      clearEffectiveGridCache();
    },
    [persistPatch]
  );

  const applyRoutes = useCallback(
    (nextRoutes) => {
      setRoutes(nextRoutes);
      persistPatch({ routes: nextRoutes });
    },
    [persistPatch]
  );

  const updateRoute = useCallback(
    (routeId, updater) => {
      applyRoutes(
        routes.map((route) => (route.id === routeId ? updater(route) : route))
      );
    },
    [routes, applyRoutes]
  );

  const replanRoute = useCallback(
    async (routeId, waypoints, obs = obstaclesRef.current) => {
      const seq = ++replanSeqRef.current;
      setStatus("Recalculating route…");
      const result = await replanThroughWaypoints(mapId, waypoints, obs);
      if (seq !== replanSeqRef.current) return { ok: false, cancelled: true };
      if (!result.ok) {
        setStatus(result.error);
        return result;
      }
      updateRoute(routeId, (r) => ({
        ...r,
        waypoints: result.waypoints,
        anchors: result.waypoints,
        points: result.points,
        travelTimeSec: travelTimeSec(result.points, TRANSPORT_SPEED_KMH),
      }));
      setStatus("");
      return result;
    },
    [mapId, updateRoute]
  );

  const replanAllRoutes = useCallback(
    async (obs = obstaclesRef.current) => {
      const list = routesRef.current.filter((r) => getRouteWaypoints(r).length >= 2);
      for (const route of list) {
        await replanRoute(route.id, getRouteWaypoints(route), obs);
      }
    },
    [replanRoute]
  );

  const commitObstacles = useCallback(
    async (nextObstacles) => {
      applyObstacles(nextObstacles);
      await replanAllRoutes(nextObstacles);
    },
    [applyObstacles, replanAllRoutes]
  );

  const enterObstacleMode = useCallback(() => {
    setShowObstacles(true);
    setObstacleEditMode(true);
    setObstacleTool("select");
    setSelectedObstacleId(null);
  }, []);

  const exitObstacleMode = useCallback(() => {
    setShowObstacles(false);
    setObstacleEditMode(false);
    setSelectedObstacleId(null);
    setObstacleTool("select");
    penSessionRef.current = null;
    setPenDrawPreview(null);
    setPenHoverTarget(null);
  }, []);

  const cancelPenDraw = useCallback(() => {
    penSessionRef.current = null;
    setPenDrawPreview(null);
    setPenHoverTarget(null);
  }, []);

  const finishPenDraw = useCallback(
    async (points, effect = penSessionRef.current?.effect || obstaclePenEffect) => {
      const created = createPolygonObstacle(effect, points);
      if (!created) return false;
      penSessionRef.current = null;
      setPenDrawPreview(null);
      const next = [...obstaclesRef.current, created];
      setSelectedObstacleId(created.id);
      await commitObstacles(next);
      return true;
    },
    [commitObstacles, obstaclePenEffect]
  );

  const handleObstacleToolChange = useCallback(
    (tool) => {
      cancelPenDraw();
      setObstacleTool(tool);
    },
    [cancelPenDraw]
  );

  const applyPenEditToObstacle = useCallback((obstacle, target) => {
    const polyPoints = obstacleToPolygonPoints(obstacle);
    if (target.mode === "add") {
      return {
        ...obstacle,
        type: "polygon",
        points: insertPolygonVertex(polyPoints, target.segmentIndex, target.point),
      };
    }
    if (target.mode === "delete") {
      const nextPoints = removePolygonVertex(polyPoints, target.vertexIndex);
      if (!nextPoints) return obstacle;
      return { ...obstacle, type: "polygon", points: nextPoints };
    }
    return obstacle;
  }, []);

  const commitPenEdit = useCallback(
    async (obstacleId, target) => {
      const obstacle = obstaclesRef.current.find((o) => o.id === obstacleId);
      if (!obstacle) return;
      const updated = applyPenEditToObstacle(obstacle, target);
      if (updated === obstacle) return;
      const next = obstaclesRef.current.map((o) => (o.id === obstacleId ? updated : o));
      setPenHoverTarget(null);
      await commitObstacles(next);
    },
    [applyPenEditToObstacle, commitObstacles]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = obstaclesRef.current;
      const vectors = await loadAccessibilityVectors(mapId);
      if (cancelled) return;

      const shouldUpgrade = needsObstacleVectorUpgrade(saved);
      if (!shouldUpgrade && saved.length > 0) return;

      setStatus("Loading traced obstacle vectors…");
      try {
        let nextObstacles;
        if (vectors?.obstacles?.length) {
          nextObstacles = mergeAccessibilityObstacles(vectors, saved);
        } else {
          const grid = await loadAccessibilityGrid(mapId);
          if (cancelled) return;
          nextObstacles = extractObstaclesFromGrid(grid);
        }

        applyObstacles(nextObstacles);
        await replanAllRoutes(nextObstacles);
        if (!cancelled) setStatus("");
      } catch {
        if (!cancelled) setStatus("Could not load accessibility obstacles.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapId, applyObstacles, replanAllRoutes]);

  const handleRoutePathClick = useCallback(
    async (routeId, pt) => {
      if (showObstacles || dragRef.current || plottingRouteId) return;
      const route = routesRef.current.find((r) => r.id === routeId);
      const waypoints = getRouteWaypoints(route);
      if (!route?.points?.length || waypoints.length < 2) return;

      const inserted = insertWaypointOnPath(waypoints, route.points, pt);
      if (!inserted) return;

      setSelectedRouteId(routeId);
      setSelectedWaypoint({ routeId, index: inserted.insertIndex });
      await replanRoute(routeId, inserted.waypoints);
    },
    [showObstacles, plottingRouteId, replanRoute]
  );

  const handleMapClick = useCallback(
    async (pt, event) => {
      if (dragRef.current || obstacleInteractionRef.current) return;

      if (obstacleEditMode && obstacleTool === "pen") {
        if (event?.detail >= 2) return;

        const shift = Boolean(event?.shiftKey);
        const session = penSessionRef.current;
        const points = session?.points || [];

        if (!points.length && selectedObstacleId && !shift) {
          const obstacle = obstaclesRef.current.find((o) => o.id === selectedObstacleId);
          const target = resolvePenTarget(obstacle, pt, { shift });
          if (target.mode === "add" || target.mode === "delete") {
            await commitPenEdit(selectedObstacleId, target);
            return;
          }
        }

        if (points.length >= 3 && isNearPoint(pt, points[0], PEN_CLOSE_THRESHOLD)) {
          await finishPenDraw(points);
          return;
        }

        const nextPoint = clampPoint(pt);
        const nextPoints = points.length ? [...points, nextPoint] : [nextPoint];
        penSessionRef.current = {
          effect: obstaclePenEffect,
          points: nextPoints,
        };
        setPenHoverTarget(null);
        setPenDrawPreview({
          effect: obstaclePenEffect,
          points: nextPoints,
          cursor: nextPoint,
        });
        return;
      }

      if (showObstacles) return;
      if (obstacleEditMode && obstacleTool !== "select") return;

      setSelectedWaypoint(null);
      if (!plottingRouteId || !selectedHq) return;
      setStatus("Calculating route…");
      const result = await planRoute(mapId, selectedHq, pt, obstaclesRef.current);
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      const waypoints = [{ ...selectedHq }, { x: pt.x, y: pt.y }];
      const time = travelTimeSec(result.points, TRANSPORT_SPEED_KMH);
      updateRoute(plottingRouteId, (route) => ({
        ...route,
        waypoints,
        anchors: waypoints,
        points: result.points,
        travelTimeSec: time,
        hqIndex,
      }));
      setPlottingRouteId(null);
      setStatus("");
    },
    [
      showObstacles,
      plottingRouteId,
      selectedHq,
      mapId,
      hqIndex,
      updateRoute,
      obstacleEditMode,
      obstacleTool,
      obstaclePenEffect,
      finishPenDraw,
      selectedObstacleId,
      commitPenEdit,
    ]
  );

  const handleMapDoubleClick = useCallback(
    async (pt) => {
      if (!obstacleEditMode || obstacleTool !== "pen") return;
      const session = penSessionRef.current;
      if (!session?.points || session.points.length < 3) return;
      if (isNearPoint(pt, session.points[0], PEN_CLOSE_THRESHOLD)) return;
      await finishPenDraw(session.points);
    },
    [obstacleEditMode, obstacleTool, finishPenDraw]
  );

  const handleMapPointerMove = useCallback(
    (pt, event) => {
      if (!obstacleEditMode || obstacleTool !== "pen") return;

      const shift = Boolean(event?.shiftKey);
      const session = penSessionRef.current;

      if (session?.points?.length) {
        setPenHoverTarget(null);
        setPenDrawPreview({
          effect: session.effect,
          points: session.points,
          cursor: pt,
        });
        return;
      }

      if (selectedObstacleId && !shift) {
        const obstacle = obstaclesRef.current.find((o) => o.id === selectedObstacleId);
        const target = resolvePenTarget(obstacle, pt, { shift });
        if (target.mode === "add" || target.mode === "delete") {
          setPenHoverTarget({ obstacleId: selectedObstacleId, ...target });
          setPenDrawPreview(null);
          return;
        }
      }

      setPenHoverTarget(null);
      setPenDrawPreview(null);
    },
    [obstacleEditMode, obstacleTool, selectedObstacleId]
  );

  const handleAddRoute = () => {
    if (!selectedHq) {
      setStatus("Pick a map faction with HQ spawns first.");
      return;
    }
    const id = `route-${crypto.randomUUID()}`;
    const route = {
      id,
      name: `Route ${routes.length + 1}`,
      color: nextRouteColor(routes.length),
      hqIndex,
      points: [],
      waypoints: [],
      anchors: [],
      travelTimeSec: 0,
    };
    applyRoutes([...routes, route]);
    setSelectedRouteId(id);
    setPlottingRouteId(id);
    setStatus("Click the map to set destination.");
  };

  const handleWaypointPointerDown = (routeId, waypointIndex, event) => {
    event.preventDefault();
    event.stopPropagation();
    const route = routes.find((r) => r.id === routeId);
    const waypoints = getRouteWaypoints(route);
    if (waypoints.length < 2 || waypointIndex <= 0) return;

    setSelectedRouteId(routeId);
    setSelectedWaypoint({ routeId, index: waypointIndex });
    dragRef.current = {
      routeId,
      waypointIndex,
      pointerId: event.pointerId,
      moved: false,
      preview: null,
      captureTarget: event.currentTarget,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    kernelRef.current?.setBlockPan(true);
  };

  const handleRemoveSelectedWaypoint = useCallback(async () => {
    if (!selectedWaypoint) return;
    const route = routesRef.current.find((r) => r.id === selectedWaypoint.routeId);
    const waypoints = getRouteWaypoints(route);
    const next = removeWaypoint(waypoints, selectedWaypoint.index);
    if (!next) return;
    setSelectedWaypoint(null);
    await replanRoute(selectedWaypoint.routeId, next);
  }, [selectedWaypoint, replanRoute]);

  const handleMapPointerDown = useCallback(
    (pt, event) => {
      if (dragRef.current || !obstacleEditMode || obstacleTool === "pen") return;
    },
    [obstacleEditMode, obstacleTool]
  );

  const handleObstaclePointerDown = useCallback(
    (obstacleId, event) => {
      if (!obstacleEditMode || obstacleTool !== "select") return;
      event.preventDefault();
      event.stopPropagation();
      const obstacle = obstaclesRef.current.find((o) => o.id === obstacleId);
      if (!obstacle) return;

      setSelectedObstacleId(obstacleId);
      obstacleInteractionRef.current = {
        kind: "body",
        obstacleId,
        pointerId: event.pointerId,
        moved: false,
        start: kernelRef.current?.screenToMapPercent(event.clientX, event.clientY),
        originalPoints: obstacle.points.map((p) => ({ ...p })),
        captureTarget: event.currentTarget,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      kernelRef.current?.setBlockPan(true);
    },
    [obstacleEditMode, obstacleTool]
  );

  const handleObstacleAnchorPointerDown = useCallback(
    (obstacleId, anchor, event) => {
      if (!obstacleEditMode) return;
      event.preventDefault();
      event.stopPropagation();
      const obstacle = obstaclesRef.current.find((o) => o.id === obstacleId);
      if (!obstacle) return;

      setSelectedObstacleId(obstacleId);
      obstacleInteractionRef.current = {
        kind: anchor.kind === "vertex" ? "anchor" : "handle",
        obstacleId,
        handleId: anchor.id,
        anchorIndex: anchor.index,
        pointerId: event.pointerId,
        moved: false,
        originalPoints: obstacle.points.map((p) => ({ ...p })),
        captureTarget: event.currentTarget,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      kernelRef.current?.setBlockPan(true);
    },
    [obstacleEditMode]
  );

  const handleRemoveSelectedObstacle = useCallback(async () => {
    if (!selectedObstacleId) return;
    const next = obstaclesRef.current.filter((o) => o.id !== selectedObstacleId);
    setSelectedObstacleId(null);
    await commitObstacles(next);
  }, [selectedObstacleId, commitObstacles]);

  useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const kernel = kernelRef.current;
      const pt = kernel?.screenToMapPercent(event.clientX, event.clientY);
      if (!pt) return;
      drag.moved = true;
      drag.preview = { x: pt.x, y: pt.y };
      setDragPreview({
        routeId: drag.routeId,
        index: drag.waypointIndex,
        x: pt.x,
        y: pt.y,
      });
    };

    const onUp = async (event) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;

      drag.captureTarget?.releasePointerCapture?.(event.pointerId);
      kernelRef.current?.setBlockPan(false);

      if (drag.moved && drag.preview) {
        const route = routesRef.current.find((r) => r.id === drag.routeId);
        const waypoints = getRouteWaypoints(route);
        if (route && waypoints.length >= 2) {
          const next = waypoints.map((p, i) =>
            i === drag.waypointIndex ? { x: drag.preview.x, y: drag.preview.y } : p
          );
          await replanRoute(drag.routeId, next);
          setSelectedWaypoint({ routeId: drag.routeId, index: drag.waypointIndex });
        }
      }

      dragRef.current = null;
      setDragPreview(null);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      kernelRef.current?.setBlockPan(false);
    };
  }, [replanRoute]);

  useEffect(() => {
    const onMove = (event) => {
      const obsDrag = obstacleInteractionRef.current;
      if (!obsDrag || obsDrag.pointerId !== event.pointerId) return;
      const kernel = kernelRef.current;
      const pt = kernel?.screenToMapPercent(event.clientX, event.clientY);
      if (!pt) return;

      if (obsDrag.kind === "anchor") {
        obsDrag.moved = true;
        const obstacle = obstaclesRef.current.find((o) => o.id === obsDrag.obstacleId);
        if (!obstacle) return;

        const nextPoints = applyObstacleAnchorDrag(obsDrag.originalPoints, obsDrag.anchorIndex, pt);
        const next = obstaclesRef.current.map((o) =>
          o.id === obsDrag.obstacleId ? { ...o, points: nextPoints } : o
        );
        setObstacles(next);
        obstaclesRef.current = next;
        return;
      }

      obsDrag.moved = true;
      const obstacle = obstaclesRef.current.find((o) => o.id === obsDrag.obstacleId);
      if (!obstacle) return;

      let nextPoints = obstacle.points;
      if (obsDrag.kind === "handle") {
        nextPoints = applyObstacleHandleDrag(
          obstacle,
          obsDrag.handleId,
          pt,
          obsDrag.originalPoints,
          { shift: event.shiftKey }
        );
      } else if (obsDrag.kind === "body" && obsDrag.start) {
        nextPoints = nudgeObstaclePoints(
          obsDrag.originalPoints,
          pt.x - obsDrag.start.x,
          pt.y - obsDrag.start.y
        );
      }

      const next = obstaclesRef.current.map((o) =>
        o.id === obsDrag.obstacleId ? { ...o, points: nextPoints } : o
      );
      setObstacles(next);
      obstaclesRef.current = next;
    };

    const onUp = async (event) => {
      const obsDrag = obstacleInteractionRef.current;
      if (!obsDrag || obsDrag.pointerId !== event.pointerId) return;

      obsDrag.captureTarget?.releasePointerCapture?.(event.pointerId);
      kernelRef.current?.setBlockPan(false);

      if (obsDrag.moved) {
        await commitObstacles(obstaclesRef.current);
      }

      obstacleInteractionRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [commitObstacles]);

  useEffect(() => {
    const viewport = kernelRef.current?.getViewport?.();
    if (!viewport) return undefined;

    if (!obstacleEditMode || obstacleTool !== "pen") {
      viewport.style.cursor = "";
      return undefined;
    }

    if (penHoverTarget?.mode === "add") viewport.style.cursor = "copy";
    else if (penHoverTarget?.mode === "delete") viewport.style.cursor = "not-allowed";
    else viewport.style.cursor = "crosshair";

    return () => {
      viewport.style.cursor = "";
    };
  }, [obstacleEditMode, obstacleTool, penHoverTarget]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && obstacleEditMode && obstacleTool === "pen" && penSessionRef.current) {
        event.preventDefault();
        cancelPenDraw();
        return;
      }
      if (event.key === "Enter" && obstacleEditMode && obstacleTool === "pen") {
        const points = penSessionRef.current?.points;
        if (points?.length >= 3) {
          event.preventDefault();
          finishPenDraw(points);
        }
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (
        obstacleEditMode &&
        obstacleTool === "pen" &&
        penHoverTarget?.mode === "delete" &&
        penHoverTarget.obstacleId
      ) {
        event.preventDefault();
        commitPenEdit(penHoverTarget.obstacleId, penHoverTarget);
        return;
      }
      if (obstacleEditMode && selectedObstacleId && obstacleTool === "select") {
        event.preventDefault();
        handleRemoveSelectedObstacle();
        return;
      }
      if (!selectedWaypoint || selectedWaypoint.index <= 0) return;
      const route = routesRef.current.find((r) => r.id === selectedWaypoint.routeId);
      const waypoints = getRouteWaypoints(route);
      if (selectedWaypoint.index >= waypoints.length - 1) return;
      event.preventDefault();
      handleRemoveSelectedWaypoint();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    obstacleEditMode,
    obstacleTool,
    selectedObstacleId,
    selectedWaypoint,
    penHoverTarget,
    cancelPenDraw,
    finishPenDraw,
    commitPenEdit,
    handleRemoveSelectedObstacle,
    handleRemoveSelectedWaypoint,
  ]);

  return (
    <div ref={shellRef} className="routeplanner-map-shell relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[#0f0f0f]" />
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96' fill='none'%3E%3Cg stroke='rgba(255,235,200,0.1)' stroke-width='0.55' shape-rendering='crispEdges'%3E%3Cpath d='M15 .5H81'/%3E%3Cpath d='M.5 15V81'/%3E%3C/g%3E%3C/svg%3E\")",
            backgroundSize: "96px 96px",
            WebkitMaskImage:
              "linear-gradient(20deg, transparent 0%, rgba(0,0,0,0.15) 18%, #000 44%, #000 56%, rgba(0,0,0,0.15) 82%, transparent 100%)",
            maskImage:
              "linear-gradient(20deg, transparent 0%, rgba(0,0,0,0.15) 18%, #000 44%, #000 56%, rgba(0,0,0,0.15) 82%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(62, 36, 15, 0.76) 0%, rgba(62, 36, 15, 0.28) 24%, transparent 42%)",
          }}
        />
      </div>

      <div className="absolute inset-0 z-[1]">
        <RouteMapCanvas
          kernelRef={kernelRef}
          mapId={mapId}
          panelInsets={panelInsets}
          onKernelReady={() => setKernelReady(true)}
          onMapClick={handleMapClick}
          onMapPointerDown={handleMapPointerDown}
          onMapPointerMove={handleMapPointerMove}
          onMapDoubleClick={handleMapDoubleClick}
        />
      </div>

      <MapDimOverlay
        kernelRef={kernelRef}
        kernelReady={kernelReady}
        visible={showObstacles}
        dim={0.5}
      />

      <ObstacleOverlay
        kernelRef={kernelRef}
        kernelReady={kernelReady}
        obstacles={obstacles}
        visible={obstacles.length > 0 || Boolean(penDrawPreview)}
        editMode={obstacleEditMode}
        obstacleTool={obstacleTool}
        selectedObstacleId={selectedObstacleId}
        penPreview={penDrawPreview}
        penHoverTarget={penHoverTarget}
        onObstaclePointerDown={handleObstaclePointerDown}
        onAnchorPointerDown={handleObstacleAnchorPointerDown}
      />

      <RouteOverlay
        kernelRef={kernelRef}
        kernelReady={kernelReady}
        routes={routes}
        hqSpawns={hqSpawns}
        selectedHqIndex={hqIndex}
        hoveredRouteId={hoveredRouteId}
        selectedRouteId={selectedRouteId}
        selectedWaypoint={selectedWaypoint}
        dragPreview={dragPreview}
        onWaypointPointerDown={handleWaypointPointerDown}
        onRoutePathClick={handleRoutePathClick}
      />

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-black/45 px-3 py-2 backdrop-blur-md">
          <Link to={backTo} className="text-[0.78rem] text-white/60 hover:text-white">
            ← Hub
          </Link>
          <span className="text-white/25">|</span>
          <span className="text-[0.85rem] font-medium text-white">
            {plan?.title || "Route plan"}
          </span>
          {dirty && <span className="text-[0.72rem] text-amber-300/80">Unsaved</span>}
          {saving && <span className="text-[0.72rem] text-white/45">Saving…</span>}
        </div>
      </header>

      <div
        ref={leftRef}
        className="pointer-events-none absolute bottom-4 left-4 top-20 z-20"
        style={{ width: showObstacles ? OBSTACLE_PANEL_WIDTH : PANEL_WIDTH }}
      >
        {showObstacles ? (
          <div className="pointer-events-auto h-full">
            <ObstacleToolbar
              backTo={backTo}
              obstacleTool={obstacleTool}
              onToolChange={handleObstacleToolChange}
              penEffect={obstaclePenEffect}
              onPenEffectChange={(effect) => {
                setObstaclePenEffect(effect);
                if (penSessionRef.current) {
                  penSessionRef.current = { ...penSessionRef.current, effect };
                  setPenDrawPreview((preview) => (preview ? { ...preview, effect } : preview));
                }
              }}
              obstacleCount={obstacles.length}
              selectedObstacleId={selectedObstacleId}
              onDeleteSelected={handleRemoveSelectedObstacle}
              onExit={exitObstacleMode}
              status={status}
            />
          </div>
        ) : (
        <div className="pointer-events-auto space-y-3 rounded-[1.375rem] border border-white/10 bg-black/45 p-4 backdrop-blur-md">
          <label className="block text-[0.68rem] uppercase tracking-[0.14em] text-white/45">
            Map
            <select
              value={mapId}
              onChange={(e) => {
                const nextMap = e.target.value;
                setMapId(nextMap);
                setObstacles([]);
                obstaclesRef.current = [];
                clearEffectiveGridCache();
                clearAccessibilityVectorsCache();
                persistPatch({ mapId: nextMap, obstacles: [] });
                replanAllRoutes([]);
              }}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[0.85rem] text-white"
            >
              {STRAT_MAP_IDS.map((id) => (
                <option key={id} value={id} className="bg-[#1a1a1a]">
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-[0.68rem] uppercase tracking-[0.14em] text-white/45">
            Faction
            <select
              value={factionId}
              onChange={(e) => {
                setFactionId(e.target.value);
                persistPatch({ factionId: e.target.value });
              }}
              className="mt-1 w-full rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[0.85rem] text-white"
            >
              {FACTIONS.map((f) => (
                <option key={f.id} value={f.id} className="bg-[#1a1a1a]">
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-white/45">
              HQ spawn
            </p>
            <div className="mt-1 flex gap-1">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  type="button"
                  disabled={!hqSpawns[index]}
                  onClick={() => {
                    setHqIndex(index);
                    persistPatch({ hqIndex: index });
                  }}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[0.78rem] transition ${
                    hqIndex === index
                      ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                      : "border-white/12 bg-white/5 text-white/70 hover:border-white/20"
                  } disabled:opacity-35`}
                >
                  HQ {index + 1}
                </button>
              ))}
            </div>
          </div>

          <p className="m-0 text-[0.72rem] leading-snug text-white/45">
            Transport truck · {TRANSPORT_SPEED_KMH} km/h (from game data)
          </p>
          {obstacles.length > 0 && (
            <p className="m-0 text-[0.68rem] leading-snug text-white/40">
              {obstacles.length} vector obstacle{obstacles.length === 1 ? "" : "s"} affect routing
              · Open Obstacles to edit
            </p>
          )}
          {selectedRouteId &&
            getRouteWaypoints(routes.find((r) => r.id === selectedRouteId)).length >= 2 && (
              <p className="m-0 border-t border-white/10 pt-3 text-[0.68rem] leading-snug text-white/40">
                Click the route line to add a waypoint · Drag handles to move · Delete
                removes selected via-point
              </p>
            )}
          {status && <p className="m-0 text-[0.72rem] text-amber-200/90">{status}</p>}
        </div>
        )}
      </div>

      <div
        ref={rightRef}
        className="pointer-events-none absolute bottom-4 right-4 top-20 z-20"
        style={{ width: PANEL_WIDTH }}
      >
        <div className="pointer-events-auto h-full">
          <RoutesPanel
            routes={routes}
            selectedRouteId={selectedRouteId}
            hoveredRouteId={hoveredRouteId}
            onSelectRoute={(id) => {
              setSelectedRouteId(id);
              setSelectedWaypoint(null);
            }}
            onHoverRoute={setHoveredRouteId}
            onAddRoute={handleAddRoute}
            onRemoveRoute={(id) => {
              applyRoutes(routes.filter((r) => r.id !== id));
              if (selectedRouteId === id) setSelectedRouteId(null);
              if (plottingRouteId === id) setPlottingRouteId(null);
            }}
            canAddRoute={Boolean(selectedHq)}
          />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="rounded-full border border-white/15 bg-black/50 px-4 py-2 text-[0.78rem] text-white/80 backdrop-blur-md hover:bg-black/65"
            onClick={() => kernelRef.current?.fitToView()}
          >
            Fit map
          </button>
          <button
            type="button"
            className={`rounded-full border px-4 py-2 text-[0.78rem] backdrop-blur-md transition ${
              showObstacles
                ? "border-red-400/50 bg-red-500/20 text-red-100"
                : "border-white/15 bg-black/50 text-white/80 hover:bg-black/65"
            }`}
            onClick={() => {
              if (showObstacles) exitObstacleMode();
              else enterObstacleMode();
            }}
          >
            {showObstacles ? "Exit obstacles" : "Obstacles"}
          </button>
        </div>
      </div>
    </div>
  );
}
