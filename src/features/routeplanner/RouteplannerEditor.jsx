import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ROUTE_COLORS, getRouteFactionId } from "./constants.js";
import { RouteMapCanvas } from "./RouteMapCanvas.jsx";
import { RouteOverlay } from "./RouteOverlay.jsx";
import { ObstacleOverlay } from "./ObstacleOverlay.jsx";
import { ObstacleToolbar } from "./ObstacleToolbar.jsx";
import { MapDimOverlay } from "./MapDimOverlay.jsx";
import { RoutesPanel } from "./RoutesPanel.jsx";
import { RouteplannerSettingsPanel } from "./RouteplannerSettingsPanel.jsx";
import { RouteMapChrome } from "./RouteMapChrome.jsx";
import { FrontierWallOverlay } from "./FrontierWallOverlay.jsx";
import { MatchTimeline } from "./MatchTimeline.jsx";
import { RoutePlaybackOverlay } from "./RoutePlaybackOverlay.jsx";
import { EditorUserCluster } from "../strats/editor/EditorUserCluster.jsx";
import { STRAT_PANEL_GAP, STRAT_PANEL_WIDTH } from "../strats/editor/hooks/useStratEditor.js";
import { loadAccessibilityGrid } from "./path/accessibility-grid.js";
import {
  loadAccessibilityVectors,
  mergeAccessibilityObstacles,
  needsObstacleVectorUpgrade,
  normalizeLayerObstacles,
  clearAccessibilityVectorsCache,
  vectorBuildId,
} from "./obstacles/load-accessibility-vectors.js";
import { extractObstaclesFromGrid } from "./obstacles/extract-obstacles-from-grid.js";
import {
  planRoute,
  replanThroughWaypoints,
  getRouteWaypoints,
  insertWaypointOnPath,
  removeWaypoint,
} from "./path/plan-route.js";
import { getHqSideFromData } from "./timing/frontier-wall.js";
import { enrichRouteTiming, maxMatchArrivalSec } from "./timing/route-timing.js";
import { clearEffectiveGridCache } from "./obstacles/obstacle-grid.js";
import {
  applyObstacleAnchorDrag,
  applyObstacleHandleDrag,
  clampPoint,
  insertPolygonVertex,
  isNearPoint,
  nudgeObstaclePoints,
  obstacleToPolygonPoints,
  PEN_CLOSE_THRESHOLD,
  removePolygonVertex,
  resolveShapeEditTarget,
} from "./obstacles/obstacle-shapes.js";
import { applyPenAddUnion, applyPenSubtract } from "./obstacles/obstacle-boolean.mjs";
import {
  getDefaultRouteVehicleId,
  getRouteVehicleSpeedKmh,
  normalizeRouteVehicleId,
} from "./route-vehicles.js";

const PANEL_COLLAPSE_MS = 300;
const FREEHAND_MIN_PX = 6;
const FREEHAND_SAMPLE_PCT = 0.35;

function isPenTool(tool) {
  return tool === "pen-add" || tool === "pen-subtract";
}

function panelCollapseClass(collapsed) {
  return collapsed
    ? "pointer-events-none w-0 opacity-0"
    : "opacity-100";
}

function nextRouteColor(index) {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

function normalizeRoutesForFaction(routes, planFaction, hqData, mapId) {
  return (routes || []).map((route) => {
    const faction = getRouteFactionId(route, planFaction);
    const hqSide = getHqSideFromData(hqData, mapId, faction);
    const vehicleId = normalizeRouteVehicleId(route.vehicleId, faction);
    const speed = getRouteVehicleSpeedKmh(vehicleId, faction);
    const withFaction = { ...route, vehicleId, factionId: faction };
    if (route.points?.length >= 2) {
      return enrichRouteTiming(withFaction, speed, hqSide);
    }
    return {
      ...withFaction,
      travelTimeSec: route.travelTimeSec || 0,
      matchArrivalSec: route.matchArrivalSec || 0,
      wallWaitSec: route.wallWaitSec || 0,
    };
  });
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
  const [routes, setRoutes] = useState(() =>
    normalizeRoutesForFaction(plan?.routes || [], plan?.factionId || "us", null, plan?.mapId || "Carentan")
  );
  const [obstacles, setObstacles] = useState(plan?.obstacles || []);
  const [obstacleVectorBuildId, setObstacleVectorBuildId] = useState(plan?.obstacleVectorBuildId ?? null);
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
  const [showGrid, setShowGrid] = useState(true);
  const [showStrongpoints, setShowStrongpoints] = useState(false);
  const [obstacleEditMode, setObstacleEditMode] = useState(false);
  const [obstacleTool, setObstacleTool] = useState("select");
  const [selectedObstacleId, setSelectedObstacleId] = useState(null);
  const [selectedAnchorIndex, setSelectedAnchorIndex] = useState(null);
  const [penDrawPreview, setPenDrawPreview] = useState(null);
  const [penHoverTarget, setPenHoverTarget] = useState(null);
  const [matchTimeSec, setMatchTimeSec] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const penSessionRef = useRef(null);
  const penPointerRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const [panelInsets, setPanelInsets] = useState({
    left: 0,
    right: 0,
    top: 24,
    bottom: 24,
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
        left: leftRect ? Math.max(0, leftRect.right - shellRect.left + STRAT_PANEL_GAP) : 0,
        right: rightRect ? Math.max(0, shellRect.right - rightRect.left + STRAT_PANEL_GAP) : 0,
        top: leftRect ? Math.max(24, leftRect.top - shellRect.top + STRAT_PANEL_GAP) : 24,
        bottom: 24,
      });
    };
    measure();
    const t = window.setTimeout(measure, PANEL_COLLAPSE_MS);
    const ro = new ResizeObserver(measure);
    if (shellRef.current) ro.observe(shellRef.current);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [showObstacles]);

  useEffect(() => {
    if (!kernelReady) return;
    const t = window.setTimeout(() => kernelRef.current?.fitToView(), PANEL_COLLAPSE_MS);
    return () => window.clearTimeout(t);
  }, [showObstacles, kernelReady]);

  const hqSpawns = useMemo(() => {
    return hqData?.maps?.[mapId]?.factions?.[factionId]?.hqSpawns || [];
  }, [hqData, mapId, factionId]);

  const hqSide = useMemo(
    () => getHqSideFromData(hqData, mapId, factionId),
    [hqData, mapId, factionId]
  );

  const maxTimelineSec = useMemo(() => maxMatchArrivalSec(routes), [routes]);
  const timelineActive = matchTimeSec > 0 || timelinePlaying;

  useEffect(() => {
    if (!hqData) return;
    setRoutes((prev) => normalizeRoutesForFaction(prev, factionId, hqData, mapId));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute match timing when HQ data loads
  }, [hqData, mapId]);

  const selectedHq = hqSpawns[hqIndex] || null;

  const persistPatch = useCallback(
    (patch) => {
      onSave?.({
        mapId,
        factionId,
        hqIndex,
        routes,
        obstacles,
        obstacleVectorBuildId,
        ...patch,
      });
    },
    [onSave, mapId, factionId, hqIndex, routes, obstacles, obstacleVectorBuildId]
  );

  const applyObstacles = useCallback(
    (nextObstacles, { buildId } = {}) => {
      setObstacles(nextObstacles);
      const patch = { obstacles: nextObstacles };
      if (buildId !== undefined) {
        setObstacleVectorBuildId(buildId);
        patch.obstacleVectorBuildId = buildId;
      }
      persistPatch(patch);
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
      updateRoute(routeId, (r) => {
        const faction = getRouteFactionId(r, factionId);
        const side = getHqSideFromData(hqData, mapId, faction);
        return enrichRouteTiming(
          {
            ...r,
            waypoints: result.waypoints,
            anchors: result.waypoints,
            points: result.points,
          },
          getRouteVehicleSpeedKmh(r.vehicleId, faction),
          side
        );
      });
      setStatus("");
      return result;
    },
    [mapId, updateRoute, factionId, hqData]
  );

  const commitObstacles = useCallback(
    async (nextObstacles) => {
      const normalized = normalizeLayerObstacles(nextObstacles);
      applyObstacles(normalized);
    },
    [applyObstacles]
  );

  const enterObstacleMode = useCallback(() => {
    setShowObstacles(true);
    setObstacleEditMode(true);
    setObstacleTool("select");
    setSelectedObstacleId(null);
    setSelectedAnchorIndex(null);
  }, []);

  const exitObstacleMode = useCallback(() => {
    setShowObstacles(false);
    setObstacleEditMode(false);
    setSelectedObstacleId(null);
    setSelectedAnchorIndex(null);
    setObstacleTool("select");
    penSessionRef.current = null;
    penPointerRef.current = null;
    setPenDrawPreview(null);
    setPenHoverTarget(null);
  }, []);

  const cancelPenDraw = useCallback(() => {
    penSessionRef.current = null;
    penPointerRef.current = null;
    setPenDrawPreview(null);
    setPenHoverTarget(null);
  }, []);

  const finishPenDraw = useCallback(
    async (points, tool = penSessionRef.current?.tool || obstacleTool) => {
      if (!points || points.length < 3) return false;
      penSessionRef.current = null;
      penPointerRef.current = null;
      setPenDrawPreview(null);
      setPenHoverTarget(null);

      let next;
      if (tool === "pen-subtract") {
        next = applyPenSubtract(obstaclesRef.current, points);
        setSelectedObstacleId(null);
        setSelectedAnchorIndex(null);
      } else {
        const beforeIds = new Set(obstaclesRef.current.map((o) => o.id));
        next = applyPenAddUnion(obstaclesRef.current, points);
        const created = next.find((o) => !beforeIds.has(o.id));
        setSelectedObstacleId(created?.id ?? null);
        setSelectedAnchorIndex(null);
      }

      await commitObstacles(next);
      return true;
    },
    [commitObstacles, obstacleTool]
  );

  const handleObstacleToolChange = useCallback(
    (tool) => {
      cancelPenDraw();
      setSelectedAnchorIndex(null);
      setObstacleTool(tool);
    },
    [cancelPenDraw]
  );

  const applyPenEditToObstacle = useCallback((obstacle, target) => {
    const polyPoints = obstacleToPolygonPoints(obstacle);
    if (target.mode === "add-anchor") {
      return {
        ...obstacle,
        type: "polygon",
        points: insertPolygonVertex(polyPoints, target.segmentIndex, target.point),
      };
    }
    if (target.mode === "remove-anchor") {
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
      if (target.mode === "remove-anchor") setSelectedAnchorIndex(null);
      await commitObstacles(next);
    },
    [applyPenEditToObstacle, commitObstacles]
  );

  const handleRemoveSelectedAnchor = useCallback(async () => {
    if (!selectedObstacleId || selectedAnchorIndex == null) return;
    await commitPenEdit(selectedObstacleId, {
      mode: "remove-anchor",
      vertexIndex: selectedAnchorIndex,
    });
  }, [selectedObstacleId, selectedAnchorIndex, commitPenEdit]);

  const tryShapeEditAtPoint = useCallback(
    async (pt, obstacleId = selectedObstacleId) => {
      if (!obstacleId) return false;
      const obstacle = obstaclesRef.current.find((o) => o.id === obstacleId);
      if (!obstacle) return false;

      const target = resolveShapeEditTarget(obstacle, pt);
      if (target.mode === "add-anchor") {
        await commitPenEdit(obstacleId, target);
        return true;
      }
      if (target.mode === "select-anchor") {
        setSelectedObstacleId(obstacleId);
        setSelectedAnchorIndex(target.vertexIndex);
        return true;
      }
      return false;
    },
    [selectedObstacleId, commitPenEdit]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      clearAccessibilityVectorsCache();
      const saved = obstaclesRef.current;
      const vectors = await loadAccessibilityVectors(mapId, { bustCache: true });
      if (cancelled) return;

      if (!needsObstacleVectorUpgrade(saved, vectors, obstacleVectorBuildId)) {
        if (!cancelled) setStatus("");
        return;
      }

      setStatus("Loading traced obstacle vectors…");
      try {
        let nextObstacles;
        if (vectors?.obstacles?.length) {
          nextObstacles = mergeAccessibilityObstacles(vectors, saved, obstacleVectorBuildId);
        } else {
          const grid = await loadAccessibilityGrid(mapId);
          if (cancelled) return;
          nextObstacles = extractObstaclesFromGrid(grid);
        }

        applyObstacles(nextObstacles, { buildId: vectorBuildId(vectors) });
        if (!cancelled) setStatus("");
      } catch {
        if (!cancelled) setStatus("Could not load accessibility obstacles.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapId, obstacleVectorBuildId, applyObstacles]);

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

      if (obstacleEditMode && isPenTool(obstacleTool)) {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        if (event?.detail >= 2) return;

        const session = penSessionRef.current;
        const points = session?.points || [];

        if (!points.length) {
          if (await tryShapeEditAtPoint(pt)) return;
        }

        if (points.length >= 3 && isNearPoint(pt, points[0], PEN_CLOSE_THRESHOLD)) {
          await finishPenDraw(points, obstacleTool);
          return;
        }

        const nextPoint = clampPoint(pt);
        const nextPoints = points.length ? [...points, nextPoint] : [nextPoint];
        penSessionRef.current = {
          tool: obstacleTool,
          points: nextPoints,
        };
        setPenHoverTarget(null);
        setPenDrawPreview({
          points: nextPoints,
          cursor: nextPoint,
        });
        return;
      }

      if (showObstacles) return;
      if (obstacleEditMode && obstacleTool !== "select") return;

      setSelectedWaypoint(null);
      if (!plottingRouteId) return;
      const route = routesRef.current.find((r) => r.id === plottingRouteId);
      const routeFaction = getRouteFactionId(route, factionId);
      const routeSpawns = hqData?.maps?.[mapId]?.factions?.[routeFaction]?.hqSpawns || [];
      const startHq = routeSpawns[route?.hqIndex ?? hqIndex];
      if (!startHq) return;
      setStatus("Calculating route…");
      const result = await planRoute(mapId, startHq, pt, obstaclesRef.current);
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      const waypoints = [{ ...startHq }, { x: pt.x, y: pt.y, user: true }];
      const speed = getRouteVehicleSpeedKmh(route?.vehicleId, routeFaction);
      const side = getHqSideFromData(hqData, mapId, routeFaction);
      updateRoute(plottingRouteId, (r) =>
        enrichRouteTiming(
          {
            ...r,
            waypoints,
            anchors: waypoints,
            points: result.points,
            hqIndex: route?.hqIndex ?? hqIndex,
            factionId: routeFaction,
          },
          speed,
          side
        )
      );
      setPlottingRouteId(null);
      setStatus("");
    },
    [
      showObstacles,
      plottingRouteId,
      mapId,
      hqIndex,
      factionId,
      hqData,
      updateRoute,
      obstacleEditMode,
      obstacleTool,
      finishPenDraw,
      tryShapeEditAtPoint,
    ]
  );

  const handleMapDoubleClick = useCallback(
    async (pt) => {
      if (!obstacleEditMode || !isPenTool(obstacleTool)) return;
      const session = penSessionRef.current;
      if (!session?.points || session.points.length < 3) return;
      if (isNearPoint(pt, session.points[0], PEN_CLOSE_THRESHOLD)) return;
      await finishPenDraw(session.points, obstacleTool);
    },
    [obstacleEditMode, obstacleTool, finishPenDraw]
  );

  const handleMapPointerMove = useCallback(
    (pt, event) => {
      if (!obstacleEditMode) return;

      const penPointer = penPointerRef.current;
      if (penPointer && isPenTool(obstacleTool) && penPointer.pointerId === event.pointerId) {
        const movedPx = Math.hypot(
          event.clientX - penPointer.startScreen.x,
          event.clientY - penPointer.startScreen.y
        );
        if (!penPointer.freehand && movedPx >= FREEHAND_MIN_PX) {
          penPointer.freehand = true;
          penSessionRef.current = {
            tool: obstacleTool,
            points: [penPointer.startPt],
          };
        }

        if (penPointer.freehand) {
          const session = penSessionRef.current;
          const points = session?.points || [];
          const last = points[points.length - 1];
          if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= FREEHAND_SAMPLE_PCT) {
            const nextPoints = [...points, clampPoint(pt)];
            penSessionRef.current = { tool: obstacleTool, points: nextPoints };
            setPenHoverTarget(null);
            setPenDrawPreview({
              points: nextPoints,
              cursor: pt,
            });
          }
          return;
        }
      }

      if (!isPenTool(obstacleTool) && obstacleTool !== "select") return;

      const session = penSessionRef.current;
      if (isPenTool(obstacleTool) && session?.points?.length) {
        setPenHoverTarget(null);
        setPenDrawPreview({
          points: session.points,
          cursor: pt,
        });
        return;
      }

      if (selectedObstacleId) {
        const obstacle = obstaclesRef.current.find((o) => o.id === selectedObstacleId);
        const target = resolveShapeEditTarget(obstacle, pt);
        if (target.mode === "add-anchor") {
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

  const handleMapPointerDown = useCallback(
    (pt, event) => {
      if (dragRef.current || !obstacleEditMode || !isPenTool(obstacleTool)) return;
      if (event.button !== 0) return;
      if (penSessionRef.current?.points?.length) return;

      penPointerRef.current = {
        pointerId: event.pointerId,
        startScreen: { x: event.clientX, y: event.clientY },
        startPt: clampPoint(pt),
        freehand: false,
      };
      kernelRef.current?.setBlockPan(true);
    },
    [obstacleEditMode, obstacleTool]
  );

  const handleMapPointerUp = useCallback(
    async (pt, event) => {
      const penPointer = penPointerRef.current;
      if (!penPointer || penPointer.pointerId !== event.pointerId) return;

      kernelRef.current?.setBlockPan(false);
      penPointerRef.current = null;

      if (penPointer.freehand) {
        const points = penSessionRef.current?.points;
        if (points?.length >= 3) {
          suppressNextClickRef.current = true;
          await finishPenDraw(points, obstacleTool);
        } else {
          cancelPenDraw();
        }
      }
    },
    [obstacleTool, finishPenDraw, cancelPenDraw]
  );

  const handleMapContextMenu = useCallback(
    async (pt, event) => {
      if (!obstacleEditMode) return;
      event?.preventDefault?.();

      if (penSessionRef.current?.points?.length) {
        cancelPenDraw();
        return;
      }

      if (selectedObstacleId && selectedAnchorIndex != null) {
        await handleRemoveSelectedAnchor();
        return;
      }

      if (selectedObstacleId && (obstacleTool === "select" || isPenTool(obstacleTool))) {
        const obstacle = obstaclesRef.current.find((o) => o.id === selectedObstacleId);
        const target = resolveShapeEditTarget(obstacle, pt);
        if (target.mode === "select-anchor") {
          await commitPenEdit(selectedObstacleId, {
            mode: "remove-anchor",
            vertexIndex: target.vertexIndex,
          });
        }
      }
    },
    [
      obstacleEditMode,
      obstacleTool,
      selectedObstacleId,
      selectedAnchorIndex,
      cancelPenDraw,
      handleRemoveSelectedAnchor,
      commitPenEdit,
    ]
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
      factionId,
      hqIndex,
      vehicleId: getDefaultRouteVehicleId(factionId),
      driver: "",
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

  const handleWaypointContextMenu = useCallback(
    async (routeId, waypointIndex) => {
      const route = routesRef.current.find((r) => r.id === routeId);
      const waypoints = getRouteWaypoints(route);
      const wp = waypoints[waypointIndex];
      if (!wp?.user || waypointIndex <= 0 || waypointIndex >= waypoints.length - 1) return;
      const next = removeWaypoint(waypoints, waypointIndex);
      if (!next) return;
      setSelectedWaypoint(null);
      await replanRoute(routeId, next);
    },
    [replanRoute]
  );

  const handleObstaclePointerDown = useCallback(
    async (obstacleId, event) => {
      if (!obstacleEditMode) return;
      if (penSessionRef.current?.points?.length) return;

      event.preventDefault();
      event.stopPropagation();
      const obstacle = obstaclesRef.current.find((o) => o.id === obstacleId);
      if (!obstacle) return;

      const pt = kernelRef.current?.screenToMapPercent(event.clientX, event.clientY);
      if (!pt) return;

      setSelectedObstacleId(obstacleId);
      const canEditAnchors =
        obstacleTool === "select" || obstacleTool === "pen-add" || obstacleTool === "pen-subtract";
      const target = canEditAnchors ? resolveShapeEditTarget(obstacle, pt) : { mode: "none" };

      if (target.mode === "select-anchor") {
        setSelectedAnchorIndex(target.vertexIndex);
        obstacleInteractionRef.current = {
          kind: "anchor",
          obstacleId,
          anchorIndex: target.vertexIndex,
          pointerId: event.pointerId,
          moved: false,
          originalPoints: obstacle.points.map((p) => ({ ...p })),
          captureTarget: event.currentTarget,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
        kernelRef.current?.setBlockPan(true);
        return;
      }

      if (target.mode === "add-anchor") {
        setSelectedAnchorIndex(null);
        await commitPenEdit(obstacleId, target);
        return;
      }

      setSelectedAnchorIndex(null);
      if (obstacleTool !== "select") return;

      obstacleInteractionRef.current = {
        kind: "body",
        obstacleId,
        pointerId: event.pointerId,
        moved: false,
        start: pt,
        originalPoints: obstacle.points.map((p) => ({ ...p })),
        captureTarget: event.currentTarget,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      kernelRef.current?.setBlockPan(true);
    },
    [obstacleEditMode, obstacleTool, commitPenEdit]
  );

  const handleObstacleAnchorPointerDown = useCallback(
    (obstacleId, anchor, event) => {
      if (!obstacleEditMode) return;
      if (penSessionRef.current?.points?.length) return;
      event.preventDefault();
      event.stopPropagation();
      const obstacle = obstaclesRef.current.find((o) => o.id === obstacleId);
      if (!obstacle) return;

      setSelectedObstacleId(obstacleId);
      if (anchor.kind === "vertex") setSelectedAnchorIndex(anchor.index);
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

  const handleAnchorContextMenu = useCallback(
    async (obstacleId, anchor, event) => {
      if (!obstacleEditMode) return;
      event.preventDefault();
      event.stopPropagation();
      if (anchor.kind !== "vertex") return;
      setSelectedObstacleId(obstacleId);
      setSelectedAnchorIndex(anchor.index);
      await commitPenEdit(obstacleId, {
        mode: "remove-anchor",
        vertexIndex: anchor.index,
      });
    },
    [obstacleEditMode, commitPenEdit]
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
    if (!obstacleEditMode || !isPenTool(obstacleTool)) return undefined;

    const onMove = (event) => {
      if (!penPointerRef.current || penPointerRef.current.pointerId !== event.pointerId) return;
      const pt = kernelRef.current?.screenToMapPercent(event.clientX, event.clientY);
      if (pt) handleMapPointerMove(pt, event);
    };

    const onUp = (event) => {
      if (!penPointerRef.current || penPointerRef.current.pointerId !== event.pointerId) return;
      const pt = kernelRef.current?.screenToMapPercent(event.clientX, event.clientY);
      if (pt) handleMapPointerUp(pt, event);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [obstacleEditMode, obstacleTool, handleMapPointerMove, handleMapPointerUp]);

  useEffect(() => {
    const viewport = kernelRef.current?.getViewport?.();
    if (!viewport) return undefined;

    if (!obstacleEditMode || (obstacleTool !== "select" && !isPenTool(obstacleTool))) {
      viewport.style.cursor = "";
      return undefined;
    }

    if (penHoverTarget?.mode === "add-anchor") viewport.style.cursor = "copy";
    else if (isPenTool(obstacleTool)) viewport.style.cursor = "crosshair";
    else viewport.style.cursor = "";

    return () => {
      viewport.style.cursor = "";
    };
  }, [obstacleEditMode, obstacleTool, penHoverTarget]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && obstacleEditMode && isPenTool(obstacleTool) && penSessionRef.current) {
        event.preventDefault();
        cancelPenDraw();
        return;
      }
      if (event.key === "Enter" && obstacleEditMode && isPenTool(obstacleTool)) {
        const points = penSessionRef.current?.points;
        if (points?.length >= 3) {
          event.preventDefault();
          finishPenDraw(points, obstacleTool);
        }
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (obstacleEditMode && selectedObstacleId && selectedAnchorIndex != null) {
        event.preventDefault();
        handleRemoveSelectedAnchor();
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
    selectedAnchorIndex,
    selectedWaypoint,
    cancelPenDraw,
    finishPenDraw,
    handleRemoveSelectedObstacle,
    handleRemoveSelectedAnchor,
    handleRemoveSelectedWaypoint,
  ]);

  const handleVehicleChange = useCallback(
    (routeId, vehicleId) => {
      updateRoute(routeId, (route) => {
        const faction = getRouteFactionId(route, factionId);
        const side = getHqSideFromData(hqData, mapId, faction);
        return route.points?.length >= 2
          ? enrichRouteTiming(
              { ...route, vehicleId },
              getRouteVehicleSpeedKmh(vehicleId, faction),
              side
            )
          : { ...route, vehicleId };
      });
    },
    [updateRoute, factionId, hqData, mapId]
  );

  const handleRouteColorChange = useCallback(
    (routeId, color) => {
      updateRoute(routeId, (route) => ({ ...route, color }));
    },
    [updateRoute]
  );

  const handleRouteNameChange = useCallback(
    (routeId, name) => {
      updateRoute(routeId, (route) => ({ ...route, name }));
    },
    [updateRoute]
  );

  const handleRouteDriverChange = useCallback(
    (routeId, driver) => {
      updateRoute(routeId, (route) => ({ ...route, driver }));
    },
    [updateRoute]
  );

  const handleRouteHqChange = useCallback(
    async (routeId, nextHqIndex) => {
      const route = routesRef.current.find((r) => r.id === routeId);
      if (!route) return;
      const faction = getRouteFactionId(route, factionId);
      const spawns = hqData?.maps?.[mapId]?.factions?.[faction]?.hqSpawns || [];
      const newHq = spawns[nextHqIndex];
      if (!newHq) return;

      const waypoints = getRouteWaypoints(route);
      if (waypoints.length >= 2) {
        const dest = waypoints[waypoints.length - 1];
        const via = waypoints.slice(1, -1);
        updateRoute(routeId, (r) => ({ ...r, hqIndex: nextHqIndex }));
        await replanRoute(routeId, [{ ...newHq }, ...via, dest]);
        return;
      }
      updateRoute(routeId, (r) => ({ ...r, hqIndex: nextHqIndex }));
    },
    [factionId, hqData, mapId, updateRoute, replanRoute]
  );

  const handleRouteFactionChange = useCallback(
    async (routeId, nextFaction) => {
      const route = routesRef.current.find((r) => r.id === routeId);
      if (!route) return;
      const spawns = hqData?.maps?.[mapId]?.factions?.[nextFaction]?.hqSpawns || [];
      const nextHqIndex = Math.min(route.hqIndex ?? 0, Math.max(0, spawns.length - 1));
      const newHq = spawns[nextHqIndex];
      const vehicleId = normalizeRouteVehicleId(route.vehicleId, nextFaction);
      const side = getHqSideFromData(hqData, mapId, nextFaction);

      const waypoints = getRouteWaypoints(route);
      if (waypoints.length >= 2 && newHq) {
        const dest = waypoints[waypoints.length - 1];
        const via = waypoints.slice(1, -1);
        updateRoute(routeId, (r) => ({
          ...r,
          factionId: nextFaction,
          hqIndex: nextHqIndex,
          vehicleId,
        }));
        await replanRoute(routeId, [{ ...newHq }, ...via, dest]);
        return;
      }

      updateRoute(routeId, (r) => {
        const updated = { ...r, factionId: nextFaction, hqIndex: nextHqIndex, vehicleId };
        return r.points?.length >= 2
          ? enrichRouteTiming(updated, getRouteVehicleSpeedKmh(vehicleId, nextFaction), side)
          : updated;
      });
    },
    [factionId, hqData, mapId, updateRoute, replanRoute]
  );

  const handleFactionChange = useCallback(
    (nextFaction) => {
      setFactionId(nextFaction);
      persistPatch({ factionId: nextFaction });
      setMatchTimeSec(0);
      setTimelinePlaying(false);
    },
    [persistPatch]
  );

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const selectedRouteIndex = selectedRoute ? routes.indexOf(selectedRoute) : -1;
  const overlayFactionId = selectedRoute
    ? getRouteFactionId(selectedRoute, factionId)
    : factionId;
  const overlayHqIndex = selectedRoute?.hqIndex ?? hqIndex;
  const overlayHqSpawns =
    hqData?.maps?.[mapId]?.factions?.[overlayFactionId]?.hqSpawns || hqSpawns;
  const overlayHqSide = getHqSideFromData(hqData, mapId, overlayFactionId);
  const selectedRouteHqSpawns =
    hqData?.maps?.[mapId]?.factions?.[getRouteFactionId(selectedRoute, factionId)]?.hqSpawns ||
    [];
  const routeHint =
    selectedRoute && getRouteWaypoints(selectedRoute).length >= 2
      ? "Click the route line to add a waypoint · Drag handles to move · Right-click or Delete removes a manual via-point"
      : null;

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
          showGrid={showGrid}
          showStrongpoints={showStrongpoints}
          onKernelReady={() => setKernelReady(true)}
          onMapClick={handleMapClick}
          onMapPointerDown={handleMapPointerDown}
          onMapPointerMove={handleMapPointerMove}
          onMapPointerUp={handleMapPointerUp}
          onMapContextMenu={handleMapContextMenu}
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
        visible={showObstacles}
        editMode={obstacleEditMode}
        obstacleTool={obstacleTool}
        selectedObstacleId={selectedObstacleId}
        selectedAnchorIndex={selectedAnchorIndex}
        penPreview={penDrawPreview}
        penHoverTarget={penHoverTarget}
        onObstaclePointerDown={handleObstaclePointerDown}
        onAnchorPointerDown={handleObstacleAnchorPointerDown}
        onAnchorContextMenu={handleAnchorContextMenu}
      />

      <FrontierWallOverlay
        kernelRef={kernelRef}
        kernelReady={kernelReady}
        hqSide={overlayHqSide}
        visible={!showObstacles}
      />

      <RoutePlaybackOverlay
        kernelRef={kernelRef}
        kernelReady={kernelReady}
        routes={routes}
        planFactionId={factionId}
        hqData={hqData}
        mapId={mapId}
        matchTimeSec={matchTimeSec}
        active={timelineActive}
      />

      <RouteOverlay
        kernelRef={kernelRef}
        kernelReady={kernelReady}
        routes={routes}
        planFactionId={factionId}
        hqSpawns={overlayHqSpawns}
        selectedHqIndex={overlayHqIndex}
        hoveredRouteId={hoveredRouteId}
        selectedRouteId={selectedRouteId}
        selectedWaypoint={selectedWaypoint}
        dragPreview={dragPreview}
        hideVehicleMarkers={timelineActive}
        onWaypointPointerDown={handleWaypointPointerDown}
        onWaypointContextMenu={handleWaypointContextMenu}
        onRoutePathClick={handleRoutePathClick}
      />

      <div
        ref={leftRef}
        className="pointer-events-none absolute bottom-6 left-6 top-6 z-20"
        style={{ width: STRAT_PANEL_WIDTH }}
      >
        <div className="pointer-events-auto h-full">
          {showObstacles ? (
            <ObstacleToolbar
              backTo={backTo}
              obstacleTool={obstacleTool}
              onToolChange={handleObstacleToolChange}
              obstacleCount={obstacles.length}
              selectedObstacleId={selectedObstacleId}
              onDeleteSelected={handleRemoveSelectedObstacle}
              onExit={exitObstacleMode}
              status={status}
            />
          ) : (
            <RouteplannerSettingsPanel
              backTo={backTo}
              mapId={mapId}
              onMapChange={(nextMap) => {
                setMapId(nextMap);
                setObstacles([]);
                obstaclesRef.current = [];
                setObstacleVectorBuildId(null);
                clearEffectiveGridCache();
                clearAccessibilityVectorsCache();
                persistPatch({ mapId: nextMap, obstacles: [], obstacleVectorBuildId: null });
              }}
              factionId={factionId}
              onFactionChange={handleFactionChange}
              hqIndex={hqIndex}
              onHqChange={(index) => {
                setHqIndex(index);
                persistPatch({ hqIndex: index });
              }}
              hqSpawns={hqSpawns}
              obstacleCount={obstacles.length}
              routeHint={routeHint}
              status={status}
              selectedRoute={selectedRoute}
              selectedRouteIndex={selectedRouteIndex}
              routeHqSpawns={selectedRouteHqSpawns}
              onRouteColorChange={handleRouteColorChange}
              onRouteNameChange={handleRouteNameChange}
              onRouteDriverChange={handleRouteDriverChange}
              onRouteFactionChange={handleRouteFactionChange}
              onRouteHqChange={handleRouteHqChange}
              onRouteVehicleChange={handleVehicleChange}
            />
          )}
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-3">
        <MatchTimeline
          matchTimeSec={matchTimeSec}
          maxMatchSec={maxTimelineSec}
          playing={timelinePlaying}
          onMatchTimeChange={setMatchTimeSec}
          onPlayingChange={setTimelinePlaying}
          disabled={showObstacles || maxTimelineSec <= 0}
        />
        <RouteMapChrome
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((on) => !on)}
          showStrongpoints={showStrongpoints}
          onToggleStrongpoints={() => setShowStrongpoints((on) => !on)}
          showObstacles={showObstacles}
          onToggleObstacles={() => {
            if (showObstacles) exitObstacleMode();
            else enterObstacleMode();
          }}
          onFitView={() => kernelRef.current?.fitToView()}
        />
      </div>

      <div className="absolute right-6 top-6 z-30">
        <EditorUserCluster />
      </div>

      <div
        ref={rightRef}
        aria-hidden={showObstacles}
        className={`pointer-events-none absolute bottom-6 right-6 z-20 overflow-hidden transition-[width,opacity] ease-out ${panelCollapseClass(showObstacles)}`}
        style={{
          width: showObstacles ? 0 : STRAT_PANEL_WIDTH,
          top: "calc(1.5rem + 2.5rem + 0.65rem)",
          transitionDuration: `${PANEL_COLLAPSE_MS}ms`,
        }}
      >
        <div className="pointer-events-auto h-full">
          <RoutesPanel
            planTitle={plan?.title || "Route plan"}
            dirty={dirty}
            saving={saving}
            planFactionId={factionId}
            routes={routes}
            selectedRouteId={selectedRouteId}
            hoveredRouteId={hoveredRouteId}
            onSelectRoute={(id) => {
              setSelectedRouteId(id);
              setSelectedWaypoint(null);
              const route = routesRef.current.find((r) => r.id === id);
              const waypoints = getRouteWaypoints(route);
              if (!route?.points?.length || waypoints.length < 2) {
                setPlottingRouteId(id);
                setStatus("Click the map to set destination.");
              } else {
                setPlottingRouteId(null);
              }
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
    </div>
  );
}
