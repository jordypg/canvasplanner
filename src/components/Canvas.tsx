"use client";

import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import ReactFlow, {
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    BackgroundVariant,
    useReactFlow,
    useStore,
    useUpdateNodeInternals,
    ConnectionMode,
} from "reactflow";
import type {
    Connection,
    Edge,
    Viewport,
    Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { useTool } from "@/contexts/ToolContext";
import CustomNode from "./CustomNode";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getOrCreateSession } from "@/utils/session";
import Cursor from "./Cursor";
import { io, type Socket } from "socket.io-client";
import { useToast } from "@/hooks/useToast";
import OnlineCounter from "./OnlineCounter";
import ToolSelector from "./ToolSelector";

const VIEWPORT_STORAGE_KEY = "workflow-canvas-viewport";
const MIN_NODE_SIZE = 50;
const MIN_CONNECTORS = 1;
const MAX_CONNECTORS = 8;
const CONNECTOR_DISTANCE_FACTOR = 20;

// Canvas bounds - large but finite coordinate space
const CANVAS_MIN_X = -5000;
const CANVAS_MAX_X = 5000;
const CANVAS_MIN_Y = -5000;
const CANVAS_MAX_Y = 5000;

interface DragState {
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    isDrawing: boolean;
}

interface ConnectorPlacementState {
    nodeWidth: number;
    nodeHeight: number;
    nodeX: number;
    nodeY: number;
    releaseX: number;
    releaseY: number;
    currentX: number;
    currentY: number;
}

function CanvasContent() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const { setViewport, screenToFlowPosition, getZoom } = useReactFlow();
    const updateNodeInternals = useUpdateNodeInternals();
    const { activeTool } = useTool();
    const toast = useToast();
    const toastError = useCallback((message: string) => toast.error(message), [toast.error]);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [connectorPlacement, setConnectorPlacement] = useState<ConnectorPlacementState | null>(null);
    const [session, setSession] = useState<{ id: string; userName: string; color: string } | null>(null);
    const cursorAnimationFrameRef = useRef<number | null>(null);
    const lastCursorUpdateRef = useRef<{ x: number; y: number; timestamp: number }>({ x: 0, y: 0, timestamp: 0 });
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const [cursors, setCursors] = useState<Array<{
        sessionId: string;
        x: number;
        y: number;
        userName: string;
        color: string;
    }>>([]);
    const socketRef = useRef<Socket | null>(null);
    // Use ref for debug info to avoid re-render loops
    const debugInfoRef = useRef<{
        localScreen: { x: number; y: number };
        localFlow: { x: number; y: number };
    }>({
        localScreen: { x: 0, y: 0 },
        localFlow: { x: 0, y: 0 },
    });
    const [connectionStart, setConnectionStart] = useState<{
        nodeId: string;
        handleId: string;
        handleType: "source" | "target";
    } | null>(null);
    const [hoveredHandle, setHoveredHandle] = useState<{
        nodeId: string;
        handleId: string;
    } | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
    const collapseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Conflict resolution state - track pending operations
    const pendingOperationsRef = useRef<Map<string, { type: string; data: { x?: number; y?: number; text?: string; description?: string; status?: string }; timestamp: number }>>(new Map());
    const [conflictDetected, setConflictDetected] = useState(false);
    const conflictDetectedRef = useRef(false);

    // Track last synced Convex data to prevent unnecessary re-renders
    const lastSyncedConvexDataRef = useRef<string | null>(null);

    // Track edges currently being deleted to prevent double-deletion
    const deletingEdgesRef = useRef<Set<string>>(new Set());

    // Get viewport bounds for minimap calculations
    const transform = useStore((state) => state.transform);

    // Calculate minimap dimensions and bounds
    const minimapWidth = 200;
    const minimapHeight = 150;
    const canvasWidth = CANVAS_MAX_X - CANVAS_MIN_X;
    const canvasHeight = CANVAS_MAX_Y - CANVAS_MIN_Y;

    // Calculate viewport rectangle in flow coordinates
    const getViewportBounds = () => {
        if (!canvasContainerRef.current) return null;

        const bounds = canvasContainerRef.current.getBoundingClientRect();
        const zoom = transform[2];

        // Calculate the top-left corner of the viewport in flow coordinates
        const viewportFlowX = -transform[0] / zoom;
        const viewportFlowY = -transform[1] / zoom;

        // Calculate viewport dimensions in flow coordinates
        const viewportFlowWidth = bounds.width / zoom;
        const viewportFlowHeight = bounds.height / zoom;

        return {
            x: viewportFlowX,
            y: viewportFlowY,
            width: viewportFlowWidth,
            height: viewportFlowHeight,
        };
    };

    // Convex queries and mutations (for nodes/edges only)
    const convexNodes = useQuery(api.nodes.getAll);
    const convexEdges = useQuery(api.edges.getAll);
    const createNode = useMutation(api.nodes.create);
    const createEdge = useMutation(api.edges.create);
    const removeNode = useMutation(api.nodes.remove);
    const removeEdge = useMutation(api.edges.remove);
    const removeEdgesByNode = useMutation(api.edges.removeByNode);
    const updateNodePosition = useMutation(api.nodes.updatePosition);
    const updateNodeText = useMutation(api.nodes.updateText);
    const updateNodeDescription = useMutation(api.nodes.updateDescription);
    const updateNodeStatus = useMutation(api.nodes.updateStatus);
    const updateConnectors = useMutation(api.nodes.updateConnectors);

    // Register custom node types
    const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

    // Callback for nodes to report handle hover state
    const handleHandleHover = useCallback((nodeId: string | null, handleId: string | null) => {
        if (nodeId && handleId) {
            setHoveredHandle({ nodeId, handleId });
        } else {
            setHoveredHandle(null);
        }
    }, []);

    // Callback for nodes to report node hover state
    const handleNodeHover = useCallback((nodeId: string | null) => {
        setHoveredNodeId(nodeId);

        // Clear any pending collapse timeout
        if (collapseTimeoutRef.current) {
            clearTimeout(collapseTimeoutRef.current);
            collapseTimeoutRef.current = null;
        }

        if (nodeId) {
            // Immediately expand when hovering over a node
            setExpandedNodeId(nodeId);
        } else {
            // Delay collapse by 100ms when leaving a node
            collapseTimeoutRef.current = setTimeout(() => {
                setExpandedNodeId(null);
                collapseTimeoutRef.current = null;
            }, 100);
        }
    }, []);

    // Helper function to remove a connector and redistribute remaining connectors
    const removeConnectorAndRedistribute = useCallback(
        async (nodeId: string, connectorId: string) => {

            let originalConnectors: Array<{ id: string; type: string; side: string; position: number }> = [];
            let finalConnectors: Array<{ id: string; type: string; side: string; position: number }> = [];

            // Track whether we found the node and connector
            let nodeFound = false;
            let connectorFound = false;

            // Use functional update to access current nodes without depending on nodes state
            setNodes((nds) => {
                const node = nds.find((n) => n.id === nodeId);
                if (!node) {
                    console.warn("⚠️ Node not found for ID:", nodeId, "- may have already been deleted");
                    return nds; // Return unchanged
                }

                nodeFound = true;

                const currentConnectors = node.data.connectors || [];
                const connectorToRemove = currentConnectors.find((c: { id: string }) => c.id === connectorId);

                if (!connectorToRemove) {
                    console.warn("⚠️ Connector not found:", connectorId, "- may have already been deleted");
                    return nds; // Return unchanged
                }

                connectorFound = true;

                // Store original connectors for rollback
                originalConnectors = [...currentConnectors];

                // Remove the connector
                const remainingConnectors = currentConnectors.filter((c: { id: string }) => c.id !== connectorId);

                // Redistribute connectors of the same type and side
                const sameTypeAndSide = remainingConnectors.filter(
                    (c: { type: string; side: string }) => c.type === connectorToRemove.type && c.side === connectorToRemove.side
                );

                const redistributed = sameTypeAndSide.map((c: { id: string; type: string; side: string; position: number }, index: number) => ({
                    ...c,
                    position: ((index + 1) / (sameTypeAndSide.length + 1)) * 100,
                }));

                finalConnectors = remainingConnectors.map((c: { id: string; type: string; side: string; position: number }) => {
                    const redistributedConnector = redistributed.find((r: { id: string }) => r.id === c.id);
                    return redistributedConnector || c;
                });

                // Optimistically update the node
                return nds.map((n) => {
                    if (n.id === nodeId) {
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                connectors: finalConnectors,
                            },
                        };
                    }
                    return n;
                });
            });

            // If node or connector wasn't found, don't try to update the database
            if (!nodeFound || !connectorFound) {
                return;
            }

            // Update all connectors in the database
            try {
                await updateConnectors({
                    id: nodeId as Id<"nodes">,
                    connectors: finalConnectors,
                });

                // Remove edges connected to this connector using functional update
                setEdges((eds) => {
                    const edgesToRemove = eds.filter(
                        (e) =>
                            (e.source === nodeId && e.sourceHandle === connectorId) ||
                            (e.target === nodeId && e.targetHandle === connectorId)
                    );

                    // Remove edges from database
                    for (const edge of edgesToRemove) {
                        removeEdge({ id: edge.id as Id<"edges"> }).catch((error) => {
                            console.error("Failed to remove edge:", error);
                        });
                    }

                    // Return filtered edges
                    return eds.filter(
                        (e) =>
                            !((e.source === nodeId && e.sourceHandle === connectorId) ||
                                (e.target === nodeId && e.targetHandle === connectorId))
                    );
                });

            } catch (error) {
                console.error("Failed to update connectors:", error);

                // Rollback: restore original connectors
                setNodes((nds) =>
                    nds.map((n) => {
                        if (n.id === nodeId) {
                            return {
                                ...n,
                                data: {
                                    ...n.data,
                                    connectors: originalConnectors,
                                },
                            };
                        }
                        return n;
                    })
                );

                toastError("Failed to remove connector. Please try again.");
            }
        },
        [setNodes, setEdges, updateConnectors, removeEdge, toastError]
    );

    // Initialize session and Socket.io connection
    useEffect(() => {
        const userSession = getOrCreateSession();
        if (userSession) {
            setSession(userSession);
        }

        // Connect to Socket.io server
        const socket = io();
        socketRef.current = socket;

        // Handle initial cursors
        socket.on('cursors:init', (initialCursors) => {
            setCursors(initialCursors);
        });

        // Handle cursor updates from other clients
        socket.on('cursor:update', (cursorData) => {
            setCursors((prev) => {
                const filtered = prev.filter((c) => c.sessionId !== cursorData.sessionId);
                return [...filtered, cursorData];
            });
        });

        // Handle cursor removal
        socket.on('cursor:remove', (data) => {
            setCursors((prev) => prev.filter((c) => c.sessionId !== data.sessionId));
        });

        // Cleanup on unmount
        return () => {
            if (userSession) {
                socket.emit('cursor:remove', { sessionId: userSession.id });
            }
            socket.disconnect();
        };
    }, []);

    // Cleanup collapse timeout on unmount
    useEffect(() => {
        return () => {
            if (collapseTimeoutRef.current) {
                clearTimeout(collapseTimeoutRef.current);
            }
        };
    }, []);

    // Update node expansion state when expandedNodeId changes
    useEffect(() => {
        setNodes((nds) =>
            nds.map((node) => ({
                ...node,
                data: {
                    ...node.data,
                    isExpanded: expandedNodeId === node.id,
                },
            }))
        );
    }, [expandedNodeId, setNodes]);

    // Handle mouse movement for cursor tracking (attached to window) with optimized throttling
    useEffect(() => {
        if (!session || !socketRef.current || !canvasContainerRef.current) {
            return;
        }

        const CURSOR_UPDATE_INTERVAL = 50; // Minimum ms between cursor updates

        const handleMouseMove = (event: MouseEvent) => {
            // Check if mouse is over the canvas container
            if (!canvasContainerRef.current) return;

            const bounds = canvasContainerRef.current.getBoundingClientRect();

            // Check if mouse is within canvas bounds
            const isWithinCanvas =
                event.clientX >= bounds.left &&
                event.clientX <= bounds.right &&
                event.clientY >= bounds.top &&
                event.clientY <= bounds.bottom;

            if (!isWithinCanvas) {
                return; // Mouse is outside canvas area
            }

            // Capture event coordinates before async operations
            const clientX = event.clientX;
            const clientY = event.clientY;

            // Convert screen coordinates to flow coordinates (canvas coordinates)
            const flowPosition = screenToFlowPosition({
                x: clientX,
                y: clientY,
            });

            // Use requestAnimationFrame for smoother updates and adaptive throttling
            if (cursorAnimationFrameRef.current === null) {
                cursorAnimationFrameRef.current = requestAnimationFrame(() => {
                    const now = performance.now();
                    const timeSinceLastUpdate = now - lastCursorUpdateRef.current.timestamp;

                    // Only send update if enough time has passed
                    if (timeSinceLastUpdate >= CURSOR_UPDATE_INTERVAL) {
                        socketRef.current?.emit('cursor:update', {
                            sessionId: session.id,
                            x: flowPosition.x,
                            y: flowPosition.y,
                            userName: session.userName,
                            color: session.color,
                        });

                        // Update debug info ref (no state update to avoid re-renders)
                        debugInfoRef.current = {
                            localScreen: { x: clientX, y: clientY },
                            localFlow: { x: flowPosition.x, y: flowPosition.y },
                        };

                        lastCursorUpdateRef.current = {
                            x: flowPosition.x,
                            y: flowPosition.y,
                            timestamp: now,
                        };
                    }

                    cursorAnimationFrameRef.current = null;
                });
            }
        };

        window.addEventListener('mousemove', handleMouseMove);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (cursorAnimationFrameRef.current !== null) {
                cancelAnimationFrame(cursorAnimationFrameRef.current);
            }
        };
    }, [session, screenToFlowPosition]);

    // Memoize node transformation callbacks to prevent recreation on every render
    const createLabelChangeHandler = useCallback((nodeId: string, _currentText: string) => {
        return async (newLabel: string) => {
            // Track pending operation
            pendingOperationsRef.current.set(nodeId, {
                type: "text",
                data: { text: newLabel },
                timestamp: Date.now(),
            });

            try {
                await updateNodeText({
                    id: nodeId as Id<"nodes">,
                    text: newLabel,
                });
            } catch (error) {
                console.error("Failed to update node text:", error);
                pendingOperationsRef.current.delete(nodeId);
                toastError("Failed to update node text");
            }
        };
    }, [updateNodeText, toastError]);

    const createDescriptionChangeHandler = useCallback((nodeId: string) => {
        return async (newDescription: string) => {
            // Track pending operation
            pendingOperationsRef.current.set(nodeId, {
                type: "description",
                data: { description: newDescription },
                timestamp: Date.now(),
            });

            try {
                await updateNodeDescription({
                    id: nodeId as Id<"nodes">,
                    description: newDescription,
                });
            } catch (error) {
                console.error("Failed to update node description:", error);
                pendingOperationsRef.current.delete(nodeId);
                toastError("Failed to update node description");
            }
        };
    }, [updateNodeDescription, toastError]);

    const createStatusChangeHandler = useCallback((nodeId: string) => {
        return async (newStatus: "not ready" | "can start" | "in progress" | "complete") => {
            // Store original status for rollback
            let originalStatus: "not ready" | "can start" | "in progress" | "complete" = "not ready";

            // Optimistically update local state immediately
            setNodes((nds) =>
                nds.map((n) => {
                    if (n.id === nodeId) {
                        originalStatus = n.data.status || "not ready";
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                status: newStatus,
                            },
                        };
                    }
                    return n;
                })
            );

            // Track pending operation
            pendingOperationsRef.current.set(nodeId, {
                type: "status",
                data: { status: newStatus },
                timestamp: Date.now(),
            });

            // Then update the database in the background
            try {
                await updateNodeStatus({
                    id: nodeId as Id<"nodes">,
                    status: newStatus,
                });
            } catch (error) {
                console.error("Failed to update node status:", error);

                // Remove from pending operations
                pendingOperationsRef.current.delete(nodeId);

                // Rollback on error
                setNodes((nds) =>
                    nds.map((n) => {
                        if (n.id === nodeId) {
                            return {
                                ...n,
                                data: {
                                    ...n.data,
                                    status: originalStatus,
                                },
                            };
                        }
                        return n;
                    })
                );

                toastError("Failed to update node status");
            }
        };
    }, [updateNodeStatus, toastError, setNodes]);

    // Sync Convex nodes to ReactFlow state with conflict detection
    useEffect(() => {
        if (!convexNodes) return;

        // Check if this is the same data we've already synced
        const convexDataHash = JSON.stringify(convexNodes.map((n: { _id: string; x: number; y: number; text: string; description?: string; status?: string; connectors?: Array<unknown> }) => ({
            _id: n._id,
            x: n.x,
            y: n.y,
            text: n.text,
            description: n.description,
            status: n.status,
            connectors: n.connectors,
        })));

        // Only skip sync if ref is not null AND hash matches (allow first sync when ref is null)
        if (lastSyncedConvexDataRef.current !== null && lastSyncedConvexDataRef.current === convexDataHash) {
            // Data hasn't changed, skip sync
            return;
        }

        // Update the last synced data ref
        lastSyncedConvexDataRef.current = convexDataHash;

        // Check for conflicts with pending operations (don't trigger state updates here)
        let hasConflict = false;
        convexNodes.forEach((convexNode: { _id: string; x: number; y: number; text: string; description?: string; status?: string }) => {
            const pendingOp = pendingOperationsRef.current.get(convexNode._id);
            if (pendingOp) {
                // Check if server state differs from what we expected
                const isConflict =
                    (pendingOp.type === "position" &&
                        pendingOp.data.x !== undefined &&
                        pendingOp.data.y !== undefined &&
                        (Math.abs(convexNode.x - pendingOp.data.x) > 1 ||
                            Math.abs(convexNode.y - pendingOp.data.y) > 1)) ||
                    (pendingOp.type === "text" && convexNode.text !== pendingOp.data.text) ||
                    (pendingOp.type === "description" && convexNode.description !== pendingOp.data.description) ||
                    (pendingOp.type === "status" && convexNode.status !== pendingOp.data.status);

                if (isConflict) {
                    console.warn("⚠️ Conflict detected for node:", convexNode._id, "Operation:", pendingOp.type);
                    hasConflict = true;
                }

                // Operation complete, remove from pending
                pendingOperationsRef.current.delete(convexNode._id);
            }
        });

        // Only update conflict state if it changed
        if (hasConflict && !conflictDetectedRef.current) {
            conflictDetectedRef.current = true;
            setConflictDetected(true);
            setTimeout(() => {
                setConflictDetected(false);
                conflictDetectedRef.current = false;
            }, 3000);
        }

        // Transform convexNodes to reactFlowNodes inline
        const transformedNodes = convexNodes.map((node: { _id: string; x: number; y: number; text: string; description?: string; status?: "not ready" | "can start" | "in progress" | "complete"; connectors?: Array<{ id: string; type: string; side: string; position: number }>; width: number; height: number }) => ({
            id: node._id,
            type: "custom",
            position: { x: node.x, y: node.y },
            data: {
                label: node.text,
                description: node.description || "",
                status: node.status || "not ready",
                connectors: node.connectors || [],
                isExpanded: expandedNodeId === node._id,
                onLabelChange: createLabelChangeHandler(node._id, node.text),
                onDescriptionChange: createDescriptionChangeHandler(node._id),
                onStatusChange: createStatusChangeHandler(node._id),
                onHandleHover: handleHandleHover,
                onNodeHover: handleNodeHover,
                onConnectorDelete: removeConnectorAndRedistribute,
            },
            style: {
                width: node.width,
                height: node.height,
            },
        }));

        setNodes(transformedNodes);
    }, [convexNodes, setNodes, createLabelChangeHandler, createDescriptionChangeHandler, createStatusChangeHandler, handleHandleHover, handleNodeHover, removeConnectorAndRedistribute]);

    // Memoize transformed ReactFlow edges to prevent unnecessary recalculations
    const reactFlowEdges = useMemo(() => {
        if (!convexEdges) return [];

        return convexEdges.map((edge: { _id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string }) => ({
            id: edge._id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle || undefined,
            targetHandle: edge.targetHandle || undefined,
            type: 'smoothstep',
            animated: true,
            style: {
                stroke: '#6366f1',
                strokeWidth: 2,
            },
            markerEnd: {
                type: 'arrowclosed' as const,
                color: '#6366f1',
                width: 20,
                height: 20,
            },
        }));
    }, [convexEdges]);

    // Sync Convex edges to ReactFlow state
    useEffect(() => {
        if (convexEdges) {
            setEdges(reactFlowEdges);
        }
    }, [reactFlowEdges, setEdges, convexEdges]);

    // Track previous connector counts to detect remote changes
    const prevConnectorCountsRef = useRef<Map<string, number>>(new Map());

    // Force edge re-render when connector counts change (for remote updates)
    useEffect(() => {
        if (!convexNodes) return;

        const changedNodeIds: string[] = [];
        const currentCounts = new Map<string, number>();

        convexNodes.forEach((node: { _id: string; connectors?: Array<{ id: string }> }) => {
            const nodeId = node._id;
            const connectorCount = (node.connectors || []).length;
            currentCounts.set(nodeId, connectorCount);

            // Check if this node's connector count changed
            const prevCount = prevConnectorCountsRef.current.get(nodeId);
            if (prevCount !== undefined && prevCount !== connectorCount) {
                changedNodeIds.push(nodeId);
            }
        });

        // If connector count changed, force ReactFlow to recalculate handle positions
        if (changedNodeIds.length > 0) {
            // Use double requestAnimationFrame to ensure DOM has painted with new connector positions
            // First rAF: runs before paint, second rAF: runs after paint
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    changedNodeIds.forEach(nodeId => {
                        updateNodeInternals(nodeId);
                    });
                });
            });
        }

        // Update ref for next comparison
        prevConnectorCountsRef.current = currentCounts;
    }, [convexNodes, updateNodeInternals]);

    // Helper function to add a connector and redistribute all connectors of the same type
    const addConnectorAndRedistribute = useCallback(
        async (nodeId: Id<"nodes">, newConnector: { id: string; type: "input" | "output"; side: string; position: number }) => {
            // Get the current node
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) {
                console.error("Node not found");
                return null;
            }

            // Get all current connectors
            const currentConnectors = node.data.connectors || [];

            // Add the new connector
            const allConnectors = [...currentConnectors, newConnector];

            // Filter connectors by type and side
            const sameTypeAndSide = allConnectors.filter(
                (c: { type: string; side: string }) => c.type === newConnector.type && c.side === newConnector.side
            );

            // Redistribute positions evenly
            const redistributed = sameTypeAndSide.map((c: { id: string; type: string; side: string; position: number }, index: number) => ({
                ...c,
                position: ((index + 1) / (sameTypeAndSide.length + 1)) * 100,
            }));

            // Merge back with connectors of other types/sides
            const finalConnectors = allConnectors.map((c: { id: string; type: string; side: string; position: number }) => {
                const redistributedConnector = redistributed.find((r: { id: string }) => r.id === c.id);
                return redistributedConnector || c;
            });


            // Optimistically update the local nodes state
            setNodes((nds) =>
                nds.map((n) => {
                    if (n.id === nodeId) {
                        return {
                            ...n,
                            data: {
                                ...n.data,
                                connectors: finalConnectors,
                            },
                        };
                    }
                    return n;
                })
            );

            // Update all connectors in the database
            try {
                await updateConnectors({
                    id: nodeId,
                    connectors: finalConnectors,
                });
                return newConnector.id;
            } catch (error) {
                console.error("Failed to update connectors:", error);
                return null;
            }
        },
        [nodes, updateConnectors, setNodes]
    );

    // Track when connection starts
    const onConnectStart = useCallback(
        (_: React.MouseEvent | React.TouchEvent, params: { nodeId: string | null; handleId: string | null; handleType: "source" | "target" | null }) => {
            if (params.nodeId && params.handleId && params.handleType) {
                setConnectionStart({
                    nodeId: params.nodeId,
                    handleId: params.handleId,
                    handleType: params.handleType,
                });
            } else {
            }
        },
        []
    );

    // Clear connection start when connection ends
    const onConnectEnd = useCallback(
        async (event: MouseEvent | TouchEvent) => {

            if (!connectionStart) {
                setConnectionStart(null);
                return;
            }

            // Get the element under the cursor
            const target = event.target as HTMLElement;

            // Check if we released on a node (but not on a handle)
            const nodeElement = target.closest('.react-flow__node');
            const handleElement = target.closest('.react-flow__handle');

            if (nodeElement && !handleElement) {
                // Released on a node, not on a handle
                const targetNodeId = nodeElement.getAttribute('data-id');

                if (targetNodeId && targetNodeId !== connectionStart.nodeId) {
                    // Find the nodes
                    const sourceNodeId = connectionStart.handleType === "source" ? connectionStart.nodeId : targetNodeId;
                    const targetNodeIdFinal = connectionStart.handleType === "source" ? targetNodeId : connectionStart.nodeId;

                    const sourceNode = nodes.find((n) => n.id === sourceNodeId);
                    const targetNode = nodes.find((n) => n.id === targetNodeIdFinal);

                    if (sourceNode && targetNode) {

                        let sourceHandle = connectionStart.handleType === "source" ? connectionStart.handleId : undefined;
                        let targetHandle = connectionStart.handleType === "target" ? connectionStart.handleId : undefined;

                        // If dragging from a source handle, find or create an input on the target
                        if (connectionStart.handleType === "source") {
                            const inputConnectors = targetNode.data.connectors?.filter((c: { type: string }) => c.type === "input") || [];

                            // Find connectors that are already in use
                            const usedConnectors = new Set(
                                edges
                                    .filter((e) => e.target === targetNodeIdFinal && e.targetHandle)
                                    .map((e) => e.targetHandle)
                            );


                            // Find an unused input connector
                            const unusedInputConnector = inputConnectors.find((c: { id: string }) => !usedConnectors.has(c.id));

                            if (unusedInputConnector) {
                                targetHandle = unusedInputConnector.id;
                            } else {
                                // Create a new input connector
                                const newConnectorId = `input-${Date.now()}`;
                                const result = await addConnectorAndRedistribute(targetNodeIdFinal as Id<"nodes">, {
                                    id: newConnectorId,
                                    type: "input",
                                    side: "left",
                                    position: 50, // Initial position, will be redistributed
                                });

                                if (result) {
                                    targetHandle = newConnectorId;
                                } else {
                                    console.error("  ❌ Failed to add input connector");
                                    setConnectionStart(null);
                                    return;
                                }
                            }
                        }

                        // If dragging from a target handle, find or create an output on the source
                        if (connectionStart.handleType === "target") {
                            const outputConnectors = sourceNode.data.connectors?.filter((c: { type: string }) => c.type === "output") || [];

                            // Find connectors that are already in use
                            const usedConnectors = new Set(
                                edges
                                    .filter((e) => e.source === sourceNodeId && e.sourceHandle)
                                    .map((e) => e.sourceHandle)
                            );


                            // Find an unused output connector
                            const unusedOutputConnector = outputConnectors.find((c: { id: string }) => !usedConnectors.has(c.id));

                            if (unusedOutputConnector) {
                                sourceHandle = unusedOutputConnector.id;
                            } else {
                                // Create a new output connector
                                const newConnectorId = `output-${Date.now()}`;
                                const result = await addConnectorAndRedistribute(sourceNodeId as Id<"nodes">, {
                                    id: newConnectorId,
                                    type: "output",
                                    side: "right",
                                    position: 50, // Initial position, will be redistributed
                                });

                                if (result) {
                                    sourceHandle = newConnectorId;
                                } else {
                                    console.error("  ❌ Failed to add output connector");
                                    setConnectionStart(null);
                                    return;
                                }
                            }
                        }

                        // Create the edge
                        if (sourceHandle && targetHandle) {
                            const params = {
                                source: sourceNodeId,
                                target: targetNodeIdFinal,
                                sourceHandle,
                                targetHandle,
                            };


                            // Generate temp ID for optimistic update
                            const tempEdgeId = `temp-edge-${Date.now()}`;
                            const optimisticEdge = { ...params, id: tempEdgeId };

                            setEdges((eds) => addEdge(optimisticEdge, eds));

                            try {
                                await createEdge({
                                    source: sourceNodeId as Id<"nodes">,
                                    target: targetNodeIdFinal as Id<"nodes">,
                                    sourceHandle,
                                    targetHandle,
                                });
                                // Remove temp edge and let Convex sync add the real one
                                setEdges((eds) => eds.filter((e) => e.id !== tempEdgeId));
                            } catch (error) {
                                console.error("  ❌ Failed to create edge:", error);
                                // Rollback: remove optimistic edge
                                setEdges((eds) => eds.filter((e) => e.id !== tempEdgeId));
                                toastError("Failed to create connection");
                            }
                        }
                    }
                }
            }

            setConnectionStart(null);
        },
        [connectionStart, nodes, edges, addConnectorAndRedistribute, setEdges, createEdge, toastError]
    );

    const onConnect = useCallback(
        async (params: Connection) => {

            // If no connectionStart, just do normal connection
            if (!connectionStart || !params.source || !params.target) {
                setEdges((eds) => addEdge(params, eds));
                if (params.source && params.target) {
                    try {
                        await createEdge({
                            source: params.source as Id<"nodes">,
                            target: params.target as Id<"nodes">,
                            sourceHandle: params.sourceHandle || undefined,
                            targetHandle: params.targetHandle || undefined,
                        });
                    } catch (error) {
                        console.error("Failed to create edge:", error);
                    }
                }
                return;
            }

            // Smart connection logic
            const sourceNode = nodes.find((n) => n.id === params.source);
            const targetNode = nodes.find((n) => n.id === params.target);

            if (!sourceNode || !targetNode) {
                return;
            }


            let finalSourceHandle = params.sourceHandle;
            let finalTargetHandle = params.targetHandle;

            // If dragging from a source handle and target handle is not specified
            if (connectionStart.handleType === "source" && !params.targetHandle) {
                const inputConnectors = targetNode.data.connectors?.filter((c: { type: string }) => c.type === "input") || [];

                // Find connectors that are already in use
                const usedConnectors = new Set(
                    edges
                        .filter((e) => e.target === params.target && e.targetHandle)
                        .map((e) => e.targetHandle)
                );


                // Find an unused input connector
                const unusedInputConnector = inputConnectors.find((c: { id: string }) => !usedConnectors.has(c.id));

                if (unusedInputConnector) {
                    finalTargetHandle = unusedInputConnector.id;
                } else {
                    // Create a new input connector
                    const newConnectorId = `input-${Date.now()}`;
                    const result = await addConnectorAndRedistribute(params.target as Id<"nodes">, {
                        id: newConnectorId,
                        type: "input",
                        side: "left",
                        position: 50, // Initial position, will be redistributed
                    });

                    if (result) {
                        finalTargetHandle = newConnectorId;
                    } else {
                        console.error("Failed to add connector");
                        return;
                    }
                }
            }

            // If dragging from a target handle and source handle is not specified
            if (connectionStart.handleType === "target" && !params.sourceHandle) {
                const outputConnectors = sourceNode.data.connectors?.filter((c: { type: string }) => c.type === "output") || [];

                // Find connectors that are already in use
                const usedConnectors = new Set(
                    edges
                        .filter((e) => e.source === params.source && e.sourceHandle)
                        .map((e) => e.sourceHandle)
                );


                // Find an unused output connector
                const unusedOutputConnector = outputConnectors.find((c: { id: string }) => !usedConnectors.has(c.id));

                if (unusedOutputConnector) {
                    finalSourceHandle = unusedOutputConnector.id;
                } else {
                    // Create a new output connector
                    const newConnectorId = `output-${Date.now()}`;
                    const result = await addConnectorAndRedistribute(params.source as Id<"nodes">, {
                        id: newConnectorId,
                        type: "output",
                        side: "right",
                        position: 50, // Initial position, will be redistributed
                    });

                    if (result) {
                        finalSourceHandle = newConnectorId;
                    } else {
                        console.error("Failed to add connector");
                        return;
                    }
                }
            }

            // Add to local state for immediate feedback
            const finalParams = {
                ...params,
                sourceHandle: finalSourceHandle ?? null,
                targetHandle: finalTargetHandle ?? null,
            };


            // Generate temp ID for optimistic update
            const tempEdgeId = `temp-edge-${Date.now()}`;
            const optimisticEdge = { ...finalParams, id: tempEdgeId };

            setEdges((eds) => addEdge(optimisticEdge, eds));

            // Persist to Convex
            try {
                await createEdge({
                    source: params.source as Id<"nodes">,
                    target: params.target as Id<"nodes">,
                    sourceHandle: finalSourceHandle || undefined,
                    targetHandle: finalTargetHandle || undefined,
                });
                // Remove temp edge and let Convex sync add the real one
                setEdges((eds) => eds.filter((e) => e.id !== tempEdgeId));
            } catch (error) {
                console.error("  ❌ Failed to create edge:", error);
                // Rollback: remove optimistic edge
                setEdges((eds) => eds.filter((e) => e.id !== tempEdgeId));
                toastError("Failed to create connection");
            }
        },
        [setEdges, createEdge, connectionStart, nodes, edges, addConnectorAndRedistribute, toastError]
    );

    // Handle node deletions with optimistic updates
    const onNodesDelete = useCallback(
        async (deleted: Node[]) => {
            for (const node of deleted) {
                try {
                    // Remove all edges connected to this node first
                    await removeEdgesByNode({ nodeId: node.id as Id<"nodes"> });
                    // Then remove the node
                    await removeNode({ id: node.id as Id<"nodes"> });
                } catch (error) {
                    console.error("Failed to delete node:", error);

                    // Rollback: restore the deleted node
                    setNodes((nds) => [...nds, node]);
                    toastError("Failed to delete node. Please try again.");
                }
            }
        },
        [removeNode, removeEdgesByNode, toastError, setNodes]
    );

    // Handle edge deletions with optimistic updates
    const onEdgesDelete = useCallback(
        async (deleted: Edge[]) => {
            // Deduplicate edges by ID to prevent duplicate deletion attempts
            const uniqueEdges = Array.from(
                new Map(deleted.map(edge => [edge.id, edge])).values()
            );

            for (const edge of uniqueEdges) {
                // Skip if this edge is already being deleted
                if (deletingEdgesRef.current.has(edge.id)) {
                    continue;
                }

                // Mark this edge as being deleted
                deletingEdgesRef.current.add(edge.id);

                try {
                    await removeEdge({ id: edge.id as Id<"edges"> });
                } catch (error) {
                    console.error("Failed to delete edge:", error);

                    // Check if this is a "not found" error (edge was already deleted)
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const isNotFoundError = errorMessage.includes('not found') ||
                        errorMessage.includes('does not exist') ||
                        errorMessage.includes('Could not find');

                    if (!isNotFoundError) {
                        // Real error - rollback by restoring the edge
                        setEdges((eds) => [...eds, edge]);
                        toastError("Failed to delete connection. Please try again.");
                    } else {
                        // Edge was already deleted, just log it
                    }
                } finally {
                    // Clean up tracking
                    deletingEdgesRef.current.delete(edge.id);
                }
            }
        },
        [removeEdge, toastError, setEdges]
    );

    // Handle node drag end - persist position to Convex with error handling and conflict detection
    const onNodeDragStop = useCallback(
        async (_event: React.MouseEvent, node: Node) => {
            const originalPosition = { ...node.position };

            // Track pending operation
            pendingOperationsRef.current.set(node.id, {
                type: "position",
                data: { x: node.position.x, y: node.position.y },
                timestamp: Date.now(),
            });

            try {
                await updateNodePosition({
                    id: node.id as Id<"nodes">,
                    x: node.position.x,
                    y: node.position.y,
                });
            } catch (error) {
                console.error("Failed to update node position:", error);

                // Remove from pending operations
                pendingOperationsRef.current.delete(node.id);

                // Rollback: restore original position
                setNodes((nds) =>
                    nds.map((n) =>
                        n.id === node.id
                            ? { ...n, position: originalPosition }
                            : n
                    )
                );
                toastError("Failed to save node position");
            }
        },
        [updateNodePosition, toastError, setNodes]
    );

    // Save viewport to localStorage with debouncing
    const saveViewport = useCallback((viewport: Viewport) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            try {
                localStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport));
            } catch (error) {
                console.error("Failed to save viewport:", error);
            }
        }, 500);
    }, []);

    // Load viewport from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(VIEWPORT_STORAGE_KEY);
            if (saved) {
                const viewport = JSON.parse(saved) as Viewport;
                setViewport(viewport, { duration: 0 });
            }
        } catch (error) {
            console.error("Failed to load viewport:", error);
        }
    }, [setViewport]);

    // Handle viewport changes
    const onMove = useCallback(
        (_: unknown, viewport: Viewport) => {
            saveViewport(viewport);
        },
        [saveViewport]
    );

    // Handle space bar for panning and delete for connector removal
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if user is typing in an input or textarea
            const target = event.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            // Handle space bar for panning (only if not typing)
            if (event.code === "Space" && !event.repeat && !isTyping) {
                event.preventDefault();
                setIsSpacePressed(true);
            }

            // Handle delete/backspace for connector removal
            if ((event.code === "Delete" || event.code === "Backspace") && hoveredHandle) {
                // Only delete hovered connector if:
                // 1. No edge is selected
                // 2. The node containing this connector is not selected
                const hasSelectedEdge = edges.some(edge => edge.selected);
                const hoveredNodeIsSelected = nodes.some(node => node.id === hoveredHandle.nodeId && node.selected);

                if (!hasSelectedEdge && !hoveredNodeIsSelected) {
                    event.preventDefault();
                    removeConnectorAndRedistribute(
                        hoveredHandle.nodeId as Id<"nodes">,
                        hoveredHandle.handleId
                    );
                    setHoveredHandle(null);
                }
                return; // Early return to prevent node deletion
            }

            // Handle delete/backspace for node removal (only if not hovering a handle)
            if ((event.code === "Delete" || event.code === "Backspace") && hoveredNodeId && !hoveredHandle) {
                // Only delete hovered node if:
                // 1. Not typing
                // 2. No edge is selected
                // 3. The node is not selected (to avoid conflict with ReactFlow's built-in deletion)
                const hasSelectedEdge = edges.some(edge => edge.selected);
                const hoveredNodeIsSelected = nodes.some(node => node.id === hoveredNodeId && node.selected);

                if (!isTyping && !hasSelectedEdge && !hoveredNodeIsSelected) {
                    event.preventDefault();
                    const nodeToDelete = nodes.find(n => n.id === hoveredNodeId);
                    if (nodeToDelete) {
                        onNodesDelete([nodeToDelete]);
                    }
                    setHoveredNodeId(null);
                }
                return; // Early return to prevent ReactFlow's default deletion
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            if (event.code === "Space" && !isTyping) {
                event.preventDefault();
                setIsSpacePressed(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [hoveredHandle, hoveredNodeId, removeConnectorAndRedistribute, edges, nodes, onNodesDelete]);

    // Mouse event handlers for node creation
    const handleMouseDown = useCallback(
        (event: React.MouseEvent) => {

            if (activeTool !== "node") {
                return;
            }

            if (connectorPlacement) {
                return; // In connector placement phase
            }

            // Check if the mouse down is on a handle/connector
            const target = event.target as HTMLElement;
            const isHandle = target.classList.contains('react-flow__handle') ||
                target.closest('.react-flow__handle');

            if (isHandle) {
                return; // Let ReactFlow handle the connection
            }

            // Store absolute screen coordinates
            setDragState({
                startX: event.clientX,
                startY: event.clientY,
                currentX: event.clientX,
                currentY: event.clientY,
                isDrawing: true,
            });
        },
        [activeTool, connectorPlacement]
    );

    const handleMouseMove = useCallback(
        (event: React.MouseEvent) => {
            if (dragState?.isDrawing) {
                setDragState((prev) =>
                    prev ? { ...prev, currentX: event.clientX, currentY: event.clientY } : null
                );
            } else if (connectorPlacement) {
                setConnectorPlacement((prev) =>
                    prev ? { ...prev, currentX: event.clientX, currentY: event.clientY } : null
                );
            }
        },
        [dragState, connectorPlacement]
    );

    const handleMouseUp = useCallback(
        async (event: React.MouseEvent) => {

            if (dragState?.isDrawing) {
                const width = Math.abs(dragState.currentX - dragState.startX);
                const height = Math.abs(dragState.currentY - dragState.startY);

                // Check minimum size
                if (width >= MIN_NODE_SIZE && height >= MIN_NODE_SIZE) {
                    // Calculate top-left corner in screen coordinates
                    const topLeftX = Math.min(dragState.startX, dragState.currentX);
                    const topLeftY = Math.min(dragState.startY, dragState.currentY);

                    setConnectorPlacement({
                        nodeWidth: width,
                        nodeHeight: height,
                        nodeX: topLeftX,
                        nodeY: topLeftY,
                        releaseX: event.clientX,
                        releaseY: event.clientY,
                        currentX: event.clientX,
                        currentY: event.clientY,
                    });
                } else {
                }

                setDragState(null);
            } else if (connectorPlacement) {
                // Finalize node creation with connectors
                const distance = Math.sqrt(
                    Math.pow(connectorPlacement.currentX - connectorPlacement.releaseX, 2) +
                    Math.pow(connectorPlacement.currentY - connectorPlacement.releaseY, 2)
                );

                const connectorCount = Math.max(
                    MIN_CONNECTORS,
                    Math.min(MAX_CONNECTORS, Math.floor(distance / CONNECTOR_DISTANCE_FACTOR))
                );


                // Convert screen coordinates to flow coordinates
                const flowPosition = screenToFlowPosition({
                    x: connectorPlacement.nodeX,
                    y: connectorPlacement.nodeY,
                });

                // Adjust dimensions for zoom level
                const zoom = getZoom();
                const nodeWidth = connectorPlacement.nodeWidth / zoom;
                const nodeHeight = connectorPlacement.nodeHeight / zoom;

                // Clamp node position to canvas bounds
                const clampedX = Math.max(CANVAS_MIN_X, Math.min(CANVAS_MAX_X - nodeWidth, flowPosition.x));
                const clampedY = Math.max(CANVAS_MIN_Y, Math.min(CANVAS_MAX_Y - nodeHeight, flowPosition.y));


                // Create connectors for Convex (input connectors on the left, one output on the right)
                const inputConnectors = Array.from({ length: connectorCount }, (_, index) => ({
                    id: `input-${index}`,
                    type: "input" as const,
                    side: "left" as const,
                    position: ((index + 1) / (connectorCount + 1)) * 100,
                }));

                const outputConnector = {
                    id: `output-0`,
                    type: "output" as const,
                    side: "right" as const,
                    position: 50, // Center of the right side
                };

                const connectors = [...inputConnectors, outputConnector];

                // Generate a temporary ID for optimistic update
                const tempId = `temp-node-${Date.now()}`;

                // Optimistically add the node to local state
                const optimisticNode: Node = {
                    id: tempId,
                    type: "custom",
                    position: { x: clampedX, y: clampedY },
                    data: {
                        label: "New Node",
                        description: "",
                        status: "not ready",
                        connectors,
                        isExpanded: false,
                        onLabelChange: () => { },
                        onDescriptionChange: () => { },
                        onStatusChange: () => { },
                        onHandleHover: handleHandleHover,
                        onNodeHover: handleNodeHover,
                        onConnectorDelete: removeConnectorAndRedistribute,
                    },
                    style: {
                        width: nodeWidth,
                        height: nodeHeight,
                    },
                };

                setNodes((nds) => [...nds, optimisticNode]);

                // Persist to Convex
                try {

                    const result = await createNode({
                        x: clampedX,
                        y: clampedY,
                        width: nodeWidth,
                        height: nodeHeight,
                        text: "New Node",
                        status: "not ready",
                        connectors,
                    });


                    // Remove optimistic node and let Convex sync add the real one
                    setNodes((nds) => nds.filter((n) => n.id !== tempId));
                } catch (error) {
                    console.error("  ❌ Failed to create node:", error);

                    // Rollback: remove optimistic node
                    setNodes((nds) => nds.filter((n) => n.id !== tempId));

                    toastError("Failed to create node. Please try again.");
                    console.error("  📊 Error details:", {
                        message: error instanceof Error ? error.message : 'Unknown error',
                        stack: error instanceof Error ? error.stack : undefined,
                        type: typeof error,
                        error,
                    });
                }

                setConnectorPlacement(null);
            } else {
            }
        },
        [dragState, connectorPlacement, screenToFlowPosition, getZoom, createNode, handleHandleHover, removeConnectorAndRedistribute, setNodes, toastError]
    );

    // Calculate cursor style based on active tool
    const cursorStyle = activeTool === "node" ? "crosshair" : "default";

    // Helper function to convert flow coordinates to minimap pixel coordinates
    const flowToMinimapPosition = (flowX: number, flowY: number) => {
        const normalizedX = (flowX - CANVAS_MIN_X) / canvasWidth;
        const normalizedY = (flowY - CANVAS_MIN_Y) / canvasHeight;
        return {
            x: normalizedX * minimapWidth,
            y: normalizedY * minimapHeight,
        };
    };

    return (
        <div
            ref={canvasContainerRef}
            className="flex-1 bg-gray-100 relative"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            style={{ cursor: cursorStyle }}
            role="application"
            aria-label="Interactive canvas for workflow design"
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodesDelete={onNodesDelete}
                onEdgesDelete={onEdgesDelete}
                onNodeDragStop={onNodeDragStop}
                onConnect={onConnect}
                onConnectStart={onConnectStart}
                onConnectEnd={onConnectEnd}
                onMove={onMove}
                connectionMode={ConnectionMode.Loose}
                minZoom={0.1}
                maxZoom={4}
                panOnDrag={isSpacePressed ? true : activeTool === "select" ? [0, 1, 2] : [1, 2]}
                panOnScroll={false}
                preventScrolling={true}
                nodesDraggable={activeTool === "select"}
                translateExtent={[
                    [CANVAS_MIN_X, CANVAS_MIN_Y],
                    [CANVAS_MAX_X, CANVAS_MAX_Y],
                ]}
                // Performance optimizations
                onlyRenderVisibleElements={true}
                elevateNodesOnSelect={false}
                disableKeyboardA11y={true}
                nodeOrigin={[0.5, 0.5]}
                zoomActivationKeyCode={null}
                // Additional performance props
                fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                deleteKeyCode={["Backspace", "Delete"]}
                selectNodesOnDrag={false}
            >
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
                <MiniMap
                    className="react-flow__minimap"
                    style={{ left: "10px", right: "auto" }}
                    nodeStrokeWidth={3}
                    zoomable
                    pannable
                    maskColor="transparent"
                />

                {/* Cursor indicators on minimap */}
                <div
                    className="react-flow__minimap-cursors"
                    style={{
                        position: "absolute",
                        bottom: "15px", // 10px base + 15px minimap padding
                        left: "25px",   // 10px base + 15px minimap padding
                        width: `${minimapWidth}px`,
                        height: `${minimapHeight}px`,
                        pointerEvents: "none",
                        zIndex: 6,
                        // Add visual debugging border
                        // border: "1px solid rgba(255,0,0,0.3)"
                    }}
                >
                    {/* Remote cursors on minimap */}
                    {cursors &&
                        session &&
                        cursors
                            .filter((cursor: { sessionId: string }) => cursor.sessionId !== session.id)
                            .map((cursor: { sessionId: string; x: number; y: number; color: string; userName: string }) => {
                                const pos = flowToMinimapPosition(cursor.x, cursor.y);

                                // Only show if within minimap bounds
                                if (pos.x < 0 || pos.x > minimapWidth || pos.y < 0 || pos.y > minimapHeight) {
                                    return null;
                                }

                                return (
                                    <div
                                        key={cursor.sessionId}
                                        style={{
                                            position: "absolute",
                                            left: `${pos.x}px`,
                                            top: `${pos.y}px`,
                                            width: "8px",
                                            height: "8px",
                                            backgroundColor: cursor.color,
                                            border: "2px solid white",
                                            borderRadius: "50%",
                                            transform: "translate(-50%, -50%)",
                                            boxShadow: "0 0 6px rgba(0,0,0,0.4)",
                                            zIndex: 2,
                                        }}
                                        title={cursor.userName}
                                    />
                                );
                            })}

                    {/* Viewport indicator rectangle */}
                    {(() => {
                        const viewport = getViewportBounds();
                        if (!viewport) return null;

                        // Convert viewport flow coordinates to minimap coordinates
                        const topLeft = flowToMinimapPosition(viewport.x, viewport.y);
                        const bottomRight = flowToMinimapPosition(
                            viewport.x + viewport.width,
                            viewport.y + viewport.height
                        );

                        const viewportWidth = bottomRight.x - topLeft.x;
                        const viewportHeight = bottomRight.y - topLeft.y;

                        // Clamp to minimap bounds
                        const clampedX = Math.max(0, Math.min(minimapWidth, topLeft.x));
                        const clampedY = Math.max(0, Math.min(minimapHeight, topLeft.y));
                        const clampedWidth = Math.max(0, Math.min(minimapWidth - clampedX, viewportWidth));
                        const clampedHeight = Math.max(0, Math.min(minimapHeight - clampedY, viewportHeight));

                        return (
                            <div
                                style={{
                                    position: "absolute",
                                    left: `${clampedX}px`,
                                    top: `${clampedY}px`,
                                    width: `${clampedWidth}px`,
                                    height: `${clampedHeight}px`,
                                    border: "2px solid rgba(59, 130, 246, 0.8)",
                                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                                    borderRadius: "2px",
                                    pointerEvents: "none",
                                    boxShadow: "0 0 8px rgba(59, 130, 246, 0.4)",
                                    zIndex: 1,
                                }}
                                title="Current viewport"
                            />
                        );
                    })()}

                    {/* Minimap bounds indicator */}
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            border: "1px solid rgba(100, 100, 100, 0.3)",
                            borderRadius: "4px",
                            pointerEvents: "none",
                        }}
                        title={`Canvas: ${CANVAS_MIN_X} to ${CANVAS_MAX_X}, ${CANVAS_MIN_Y} to ${CANVAS_MAX_Y}`}
                    />
                </div>
            </ReactFlow>

            {/* Render other users' cursors - convert flow coordinates to screen coordinates */}
            {cursors &&
                session &&
                cursors
                    .filter((cursor: { sessionId: string }) => cursor.sessionId !== session.id)
                    .map((cursor: { sessionId: string; x: number; y: number; color: string; userName: string }) => {
                        if (!canvasContainerRef.current) return null;

                        // Manual coordinate transformation using transform state
                        // transform = [x, y, zoom] where x,y is the pan offset and zoom is the scale
                        const [tx, ty, zoom] = transform;

                        // Convert flow coordinates to screen coordinates (relative to canvas container)
                        // Screen position = flow position * zoom + transform offset
                        const screenX = cursor.x * zoom + tx;
                        const screenY = cursor.y * zoom + ty;

                        // Get canvas container's position in the viewport
                        const bounds = canvasContainerRef.current.getBoundingClientRect();

                        // Convert to absolute viewport coordinates by adding container offset
                        const absoluteX = bounds.left + screenX;
                        const absoluteY = bounds.top + screenY;

                        // Check if cursor is within reasonable range
                        const padding = 100;
                        const isVisible =
                            absoluteX >= -padding &&
                            absoluteX <= window.innerWidth + padding &&
                            absoluteY >= -padding &&
                            absoluteY <= window.innerHeight + padding;

                        if (!isVisible) return null;

                        return (
                            <Cursor
                                key={cursor.sessionId}
                                x={absoluteX}
                                y={absoluteY}
                                color={cursor.color}
                                userName={cursor.userName}
                            />
                        );
                    })}

            {/* Online Counter */}
            <OnlineCounter />

            {/* Tool Selector */}
            <ToolSelector />

            {/* Node creation drag preview */}
            {dragState?.isDrawing && (
                <div
                    className="fixed pointer-events-none border-2 border-blue-500 bg-blue-100 bg-opacity-30 z-20"
                    style={{
                        left: Math.min(dragState.startX, dragState.currentX),
                        top: Math.min(dragState.startY, dragState.currentY),
                        width: Math.abs(dragState.currentX - dragState.startX),
                        height: Math.abs(dragState.currentY - dragState.startY),
                    }}
                >
                    <div className="absolute bottom-1 right-1 text-xs bg-blue-600 text-white px-2 py-1 rounded">
                        {Math.abs(dragState.currentX - dragState.startX).toFixed(0)} ×{" "}
                        {Math.abs(dragState.currentY - dragState.startY).toFixed(0)}
                    </div>
                </div>
            )}

            {/* Connector placement visualization */}
            {connectorPlacement && (() => {
                const distance = Math.sqrt(
                    Math.pow(connectorPlacement.currentX - connectorPlacement.releaseX, 2) +
                    Math.pow(connectorPlacement.currentY - connectorPlacement.releaseY, 2)
                );
                const connectorCount = Math.max(
                    MIN_CONNECTORS,
                    Math.min(MAX_CONNECTORS, Math.floor(distance / CONNECTOR_DISTANCE_FACTOR))
                );

                // Calculate connector positions on the left edge of the node outline
                const connectors = Array.from({ length: connectorCount }, (_, index) => {
                    const position = ((index + 1) / (connectorCount + 1)) * 100;
                    const y = connectorPlacement.nodeY + (connectorPlacement.nodeHeight * position) / 100;
                    const x = connectorPlacement.nodeX;
                    return { x, y, index };
                });

                return (
                    <>
                        {/* Keep the node outline visible */}
                        <div
                            className="fixed pointer-events-none border-2 border-blue-500 bg-blue-100 bg-opacity-30 z-20"
                            style={{
                                left: connectorPlacement.nodeX,
                                top: connectorPlacement.nodeY,
                                width: connectorPlacement.nodeWidth,
                                height: connectorPlacement.nodeHeight,
                            }}
                        >
                            <div className="absolute bottom-1 right-1 text-xs bg-blue-600 text-white px-2 py-1 rounded">
                                {connectorPlacement.nodeWidth.toFixed(0)} × {connectorPlacement.nodeHeight.toFixed(0)}
                            </div>
                        </div>

                        {/* Connector position indicators */}
                        {connectors.map((connector) => (
                            <div
                                key={connector.index}
                                className="fixed pointer-events-none z-20 w-3 h-3 bg-blue-500 border-2 border-white rounded-full"
                                style={{
                                    left: connector.x - 6,
                                    top: connector.y - 6,
                                }}
                            />
                        ))}

                        {/* Dotted line from release point to cursor */}
                        <svg
                            className="fixed top-0 left-0 pointer-events-none z-20"
                            style={{ width: "100vw", height: "100vh" }}
                        >
                            <title>Connector placement guide line</title>
                            <line
                                x1={connectorPlacement.releaseX}
                                y1={connectorPlacement.releaseY}
                                x2={connectorPlacement.currentX}
                                y2={connectorPlacement.currentY}
                                stroke="#3b82f6"
                                strokeWidth="2"
                                strokeDasharray="5,5"
                            />
                        </svg>

                        {/* Connector count badge */}
                        <div
                            className="fixed pointer-events-none z-20 bg-blue-600 text-white px-2 py-1 rounded text-sm font-medium"
                            style={{
                                left: connectorPlacement.currentX + 10,
                                top: connectorPlacement.currentY + 10,
                            }}
                        >
                            {connectorCount} connectors
                        </div>
                    </>
                );
            })()}

            {nodes.length === 0 && !dragState && !connectorPlacement && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="text-center">
                        <div className="text-6xl mb-4">🎨</div>
                        <h2 className="text-2xl font-semibold text-gray-700 mb-2">
                            Workflow Canvas
                        </h2>
                        <p className="text-gray-500">
                            Click &ldquo;Add Node&rdquo; to get started
                        </p>
                    </div>
                </div>
            )}

            {/* Conflict indicator banner */}
            {conflictDetected && (
                <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <title>Conflict warning</title>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-medium">Conflict detected - server version restored</span>
                </div>
            )}


        </div>
    );
}

// Canvas is now wrapped in ReactFlowProvider by CanvasWithToolbar
export default function Canvas() {
    return <CanvasContent />;
}
