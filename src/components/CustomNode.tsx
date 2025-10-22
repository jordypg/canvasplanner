import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { Clock } from "lucide-react";

interface Connector {
  id: string;
  type?: "input" | "output";
  side: "top" | "right" | "bottom" | "left";
  position: number;
}

type NodeStatus = "not ready" | "can start" | "in progress" | "complete";
type TimeUnit = "minutes" | "hours" | "days" | "weeks";

interface CustomNodeData {
  label: string;
  description?: string;
  status?: NodeStatus;
  timeEstimate?: number;
  timeUnit?: TimeUnit;
  connectors?: Connector[];
  isExpanded?: boolean;
  onLabelChange?: (newLabel: string) => void;
  onDescriptionChange?: (newDescription: string) => void;
  onStatusChange?: (newStatus: NodeStatus) => void;
  onTimeEstimateChange?: (timeEstimate: number | undefined) => void;
  onTimeUnitChange?: (timeUnit: TimeUnit) => void;
  onTimeUntilReady?: () => number;
  onHandleHover?: (nodeId: string | null, handleId: string | null) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onStatusHover?: (nodeId: string | null) => void;
  onConnectorDelete?: (nodeId: string, connectorId: string) => void;
  onClockPopupChange?: (nodeId: string, isOpen: boolean) => void;
  onRegisterRecalculate?: (nodeId: string, recalculateFn: (() => void) | null) => void;
  onDimensionChange?: (nodeId: string, width: number, height: number) => void;
}

function CustomNode({ data, selected, id }: NodeProps<CustomNodeData>) {
  const { label, description = "", status = "not ready", timeEstimate, timeUnit = "hours", connectors = [], isExpanded = false, onLabelChange, onDescriptionChange, onStatusChange, onTimeEstimateChange, onTimeUnitChange, onTimeUntilReady, onHandleHover, onNodeHover, onStatusHover, onConnectorDelete, onClockPopupChange, onRegisterRecalculate, onDimensionChange } = data;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(label);
  const [editDescriptionValue, setEditDescriptionValue] = useState(description);
  const [hoveredHandleId, setHoveredHandleId] = useState<string | null>(null);
  const [selectedHandleId, setSelectedHandleId] = useState<string | null>(null);
  const [isClockPopupOpen, setIsClockPopupOpen] = useState(false);
  const [localTimeEstimate, setLocalTimeEstimate] = useState<string>(timeEstimate?.toString() || "");
  const [localTimeUnit, setLocalTimeUnit] = useState<TimeUnit>(timeUnit);
  const [timeUntilReady, setTimeUntilReady] = useState<number | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const clockPopupRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  // Sync local time estimate with props
  useEffect(() => {
    setLocalTimeEstimate(timeEstimate?.toString() || "");
    setLocalTimeUnit(timeUnit);
  }, [timeEstimate, timeUnit]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      descriptionTextareaRef.current.focus();
      descriptionTextareaRef.current.select();
    }
  }, [isEditingDescription]);

  // Handle click to enter title edit mode
  const handleTitleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingTitle(true);
    setEditTitleValue(label);
  }, [label]);

  // Handle description click to enter edit mode
  const handleDescriptionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingDescription(true);
    setEditDescriptionValue(description);
  }, [description]);

  // Handle save title on blur or Enter key
  const handleTitleSave = useCallback(() => {
    setIsEditingTitle(false);
    const trimmedValue = editTitleValue.trim();
    if (trimmedValue !== label && onLabelChange) {
      onLabelChange(trimmedValue || "New Node");
    }
  }, [editTitleValue, label, onLabelChange]);

  // Handle save description on blur
  const handleDescriptionSave = useCallback(() => {
    setIsEditingDescription(false);
    const trimmedValue = editDescriptionValue.trim();
    if (trimmedValue !== description && onDescriptionChange) {
      onDescriptionChange(trimmedValue);
    }
  }, [editDescriptionValue, description, onDescriptionChange]);

  // Handle keyboard events for title editing
  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleTitleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsEditingTitle(false);
        setEditTitleValue(label);
      }
    },
    [handleTitleSave, label]
  );

  // Handle keyboard events for description editing
  const handleDescriptionKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setIsEditingDescription(false);
        setEditDescriptionValue(description);
      }
      // Allow Enter for multiline text
    },
    [description]
  );

  // Handle connector selection
  const handleHandleClick = useCallback((handleId: string) => {
    setSelectedHandleId((prev) => prev === handleId ? null : handleId);
  }, []);

  // Handle connector hover (wraps parent callback)
  const handleHandleHover = useCallback((handleId: string | null) => {
    setHoveredHandleId(handleId);
    onHandleHover?.(handleId ? id : null, handleId);
  }, [id, onHandleHover]);

  // Handle status button click - cycle through states
  const handleStatusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const statusCycle: NodeStatus[] = ["not ready", "can start", "in progress", "complete"];
    const currentIndex = statusCycle.indexOf(status);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIndex];
    onStatusChange?.(nextStatus);
  }, [status, onStatusChange]);

  // Handle clock icon click - toggle popup and calculate time until ready
  const handleClockClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const willOpen = !isClockPopupOpen;
    setIsClockPopupOpen(willOpen);

    // Calculate time until ready when opening the popup
    if (willOpen && onTimeUntilReady) {
      const calculatedTime = onTimeUntilReady();
      setTimeUntilReady(calculatedTime);
    }
  }, [isClockPopupOpen, onTimeUntilReady]);

  // Handle time estimate input change
  const handleTimeEstimateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalTimeEstimate(value);

    // Only update database if value is a valid number or empty
    const numValue = parseFloat(value);
    if (value === "" || !isNaN(numValue)) {
      onTimeEstimateChange?.(value === "" ? undefined : numValue);
    }
  }, [onTimeEstimateChange]);

  // Handle time unit toggle - cycle through units
  const handleTimeUnitToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const unitCycle: TimeUnit[] = ["minutes", "hours", "days", "weeks"];
    const currentIndex = unitCycle.indexOf(localTimeUnit);
    const nextIndex = (currentIndex + 1) % unitCycle.length;
    const nextUnit = unitCycle[nextIndex];
    setLocalTimeUnit(nextUnit);

    // Update database with new unit
    onTimeUnitChange?.(nextUnit);
  }, [localTimeUnit, onTimeUnitChange]);

  // Resize handlers
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!nodeRef.current) return;

    const nodeRect = nodeRef.current.getBoundingClientRect();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: nodeRect.width,
      height: nodeRect.height,
    });
  }, []);

  useEffect(() => {
    if (!isResizing || !resizeStart || !nodeRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!nodeRef.current || !resizeStart) return;

      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const newWidth = Math.max(100, resizeStart.width + deltaX);
      const newHeight = Math.max(80, resizeStart.height + deltaY);

      // Update the node size visually
      nodeRef.current.style.width = `${newWidth}px`;
      nodeRef.current.style.height = `${newHeight}px`;
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!nodeRef.current || !resizeStart) return;

      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      const newWidth = Math.max(100, resizeStart.width + deltaX);
      const newHeight = Math.max(80, resizeStart.height + deltaY);

      // Notify parent of dimension change
      if (onDimensionChange) {
        onDimensionChange(id, newWidth, newHeight);
      }

      setIsResizing(false);
      setResizeStart(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStart, id, onDimensionChange]);

  // Get status configuration (colors, labels, etc.)
  const getStatusConfig = useCallback((status: NodeStatus) => {
    switch (status) {
      case "not ready":
        return {
          textColor: "text-red-600",
          borderColor: "border-red-500",
          bgColor: "bg-red-50",
          label: "not ready"
        };
      case "can start":
        return {
          textColor: "text-yellow-600",
          borderColor: "border-yellow-400",
          bgColor: "bg-yellow-50",
          label: "ready"
        };
      case "in progress":
        return {
          textColor: "text-blue-600",
          borderColor: "border-blue-500",
          bgColor: "bg-blue-50",
          label: "ongoing"
        };
      case "complete":
        return {
          textColor: "text-green-600",
          borderColor: "border-green-500",
          bgColor: "bg-green-50",
          label: "complete"
        };
    }
  }, []);

  // Handle keyboard events for connector deletion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Backspace" || e.key === "Delete") && selectedHandleId) {
        e.preventDefault();
        if (onConnectorDelete) {
          onConnectorDelete(id, selectedHandleId);
        }
        setSelectedHandleId(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedHandleId, id, onConnectorDelete]);

  // Handle clicks outside the clock popup to close it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isClockPopupOpen && clockPopupRef.current && !clockPopupRef.current.contains(e.target as Node)) {
        setIsClockPopupOpen(false);
      }
    };

    if (isClockPopupOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isClockPopupOpen]);

  // Report popup state changes to parent
  useEffect(() => {
    if (onClockPopupChange) {
      onClockPopupChange(id, isClockPopupOpen);
    }
  }, [id, isClockPopupOpen, onClockPopupChange]);

  // Register recalculation function with parent
  useEffect(() => {
    if (onRegisterRecalculate && onTimeUntilReady) {
      const recalculateFn = () => {
        const calculatedTime = onTimeUntilReady();
        setTimeUntilReady(calculatedTime);
      };

      // Register on mount
      onRegisterRecalculate(id, recalculateFn);

      // Unregister on unmount
      return () => {
        onRegisterRecalculate(id, null);
      };
    }
  }, [id, onRegisterRecalculate, onTimeUntilReady]);

  // Helper to convert side to ReactFlow Position
  const getPositionFromSide = useCallback((side: string): Position => {
    switch (side) {
      case "top": return Position.Top;
      case "right": return Position.Right;
      case "bottom": return Position.Bottom;
      case "left": return Position.Left;
      default: return Position.Left;
    }
  }, []);

  const statusConfig = getStatusConfig(status);

  return (
    <div
      ref={nodeRef}
      className={`bg-white rounded-lg border-2 p-1 shadow-md min-w-[100px] min-h-[80px] transition-all ${statusConfig.borderColor} hover:shadow-lg`}
      style={{ width: "100%", height: "100%" }}
      title="Click title or description to edit"
      onMouseEnter={() => onNodeHover?.(id)}
      onMouseLeave={() => onNodeHover?.(null)}
    >
      {/* Render handles based on connector data */}
      {connectors.map((connector) => {
        // Infer type from side if not specified (for backwards compatibility)
        const connectorType = connector.type || (connector.side === "left" ? "input" : "output");
        const isHovered = hoveredHandleId === connector.id;
        const isSelected = selectedHandleId === connector.id;

        return (
          <Handle
            key={connector.id}
            type={connectorType === "input" ? "target" : "source"}
            position={getPositionFromSide(connector.side)}
            id={connector.id}
            className={`!border-2 !border-white transition-all duration-200 cursor-pointer !bg-black hover:!bg-gray-800 ${
              isSelected
                ? "!w-5 !h-5 !ring-4 !ring-red-400 !shadow-lg"
                : isHovered
                ? "!w-4 !h-4 !shadow-md"
                : "!w-3 !h-3"
            }`}
            style={{
              [connector.side === "top" || connector.side === "bottom" ? "left" : "top"]: `${connector.position}%`,
              boxShadow: isSelected
                ? '0 0 0 4px rgba(239, 68, 68, 0.3)'
                : isHovered
                ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                : '0 1px 3px rgba(0, 0, 0, 0.12)',
            }}
            isConnectableStart={true}
            onMouseEnter={() => handleHandleHover(connector.id)}
            onMouseLeave={() => handleHandleHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              handleHandleClick(connector.id);
            }}
          />
        );
      })}

      {/* Node content */}
      <div
        className={`flex flex-col h-full ${description || isEditingDescription ? 'gap-2' : 'items-center justify-center cursor-text hover:bg-gray-50'}`}
        onClick={!description && !isEditingDescription && !isEditingTitle ? handleDescriptionClick : undefined}
      >
        {/* Title */}
        <div className="flex items-center justify-center">
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={editTitleValue}
              onChange={(e) => setEditTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={handleTitleKeyDown}
              className="w-full px-2 py-1 text-center text-sm font-semibold border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="text-sm font-semibold text-gray-800 cursor-text hover:bg-gray-50 px-2 py-1 rounded"
              onClick={handleTitleClick}
              title="Click to edit title"
            >
              {label}
            </div>
          )}
        </div>

        {/* Description - only show when there's content or editing */}
        {(description || isEditingDescription) && (
          <div className="flex-1 flex items-start justify-center overflow-hidden">
            {isEditingDescription ? (
              <textarea
                ref={descriptionTextareaRef}
                value={editDescriptionValue}
                onChange={(e) => setEditDescriptionValue(e.target.value)}
                onBlur={handleDescriptionSave}
                onKeyDown={handleDescriptionKeyDown}
                className="w-full h-full px-2 py-1 text-xs text-gray-600 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="w-full h-full px-2 py-1 text-xs text-gray-600 cursor-text hover:bg-gray-50 rounded overflow-auto whitespace-pre-wrap"
                onClick={handleDescriptionClick}
              >
                {description}
              </div>
            )}
          </div>
        )}

        {/* Status badge */}
        <button
          onClick={handleStatusClick}
          onMouseEnter={() => {
            onStatusHover?.(id);
          }}
          onMouseLeave={() => {
            onStatusHover?.(null);
          }}
          className={`absolute top-2 left-2 h-6 ${statusConfig.bgColor} shadow-sm hover:shadow-md rounded-full flex items-center justify-center ${statusConfig.textColor} overflow-hidden`}
          style={{
            width: isExpanded ? "80px" : "1.5rem",
            transition: "width 0.3s ease-out",
            pointerEvents: "auto",
          }}
          title="Click to change status"
          aria-label={`Status: ${statusConfig.label}`}
        >
          {isExpanded && (
            <span className="text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap pointer-events-none">
              {statusConfig.label}
            </span>
          )}
        </button>

        {/* Clock icon */}
        <div className="absolute top-2 right-2" ref={clockPopupRef}>
          <button
            onClick={handleClockClick}
            className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors shadow-sm hover:shadow-md"
            title="View time tracking"
            aria-label="Time tracking"
          >
            <Clock size={14} />
          </button>

          {/* Clock popup */}
          {isClockPopupOpen && (
            <div
              className="absolute bottom-full right-0 mb-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg p-3 min-w-[200px] z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs text-gray-700">
                <p className="font-semibold mb-3">Time Estimate</p>

                {/* Time input and unit toggle */}
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={localTimeEstimate}
                    onChange={handleTimeEstimateChange}
                    placeholder="0"
                    className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onClick={(e) => e.stopPropagation()}
                  />

                  <button
                    onClick={handleTimeUnitToggle}
                    className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors"
                  >
                    {localTimeUnit}
                  </button>
                </div>

                {/* Time Until Ready */}
                <div className="pt-3 border-t border-gray-200">
                  <p className="font-semibold mb-2">Time Until Ready</p>
                  <div className="px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-blue-700">
                    {timeUntilReady !== null ? (
                      <span className="font-medium">
                        {timeUntilReady} {localTimeUnit}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Calculating...</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Small arrow pointing down */}
              <div className="absolute top-full right-2 -mt-[2px]">
                <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-200"></div>
                <div className="absolute top-[-8px] left-[-5px] w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resize handle - only show when selected */}
      {selected && (
        <div
          className="nodrag absolute w-3 h-3 cursor-nwse-resize bg-blue-500 border-2 border-white hover:bg-blue-600 transition-colors"
          style={{
            bottom: '-6px',
            right: '-6px',
            zIndex: 100,
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
          }}
          onMouseDown={handleResizeMouseDown}
          title="Drag to resize"
        />
      )}
    </div>
  );
}

export default memo(CustomNode);
