import { memo, useState, useCallback, useRef, useEffect } from "react";
import { Handle, Position, NodeProps } from "reactflow";

interface Connector {
  id: string;
  type?: "input" | "output";
  side: "top" | "right" | "bottom" | "left";
  position: number;
}

type NodeStatus = "not ready" | "can start" | "in progress" | "complete";

interface CustomNodeData {
  label: string;
  description?: string;
  status?: NodeStatus;
  connectors?: Connector[];
  isExpanded?: boolean;
  onLabelChange?: (newLabel: string) => void;
  onDescriptionChange?: (newDescription: string) => void;
  onStatusChange?: (newStatus: NodeStatus) => void;
  onHandleHover?: (nodeId: string | null, handleId: string | null) => void;
  onNodeHover?: (nodeId: string | null) => void;
  onConnectorDelete?: (nodeId: string, connectorId: string) => void;
}

function CustomNode({ data, selected, id }: NodeProps<CustomNodeData>) {
  const { label, description = "", status = "not ready", connectors = [], isExpanded = false, onLabelChange, onDescriptionChange, onStatusChange, onHandleHover, onNodeHover, onConnectorDelete } = data;
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(label);
  const [editDescriptionValue, setEditDescriptionValue] = useState(description);
  const [hoveredHandleId, setHoveredHandleId] = useState<string | null>(null);
  const [selectedHandleId, setSelectedHandleId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Handle double-click to enter title edit mode
  const handleTitleDoubleClick = useCallback((e: React.MouseEvent) => {
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
      className={`bg-white rounded-lg border-2 p-4 shadow-md min-w-[100px] min-h-[80px] transition-all ${
        selected
          ? "border-blue-500 shadow-lg"
          : `${statusConfig.borderColor} hover:shadow-lg`
      }`}
      style={{ width: "100%", height: "100%" }}
      title="Double-click title or click description to edit"
      onMouseEnter={() => {
        onNodeHover?.(id);
      }}
      onMouseLeave={() => {
        onNodeHover?.(null);
      }}
      onClick={(e) => e.stopPropagation()}
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
            className={`!border-2 !border-white transition-all duration-200 cursor-pointer ${
              connectorType === "input"
                ? "!bg-blue-500 hover:!bg-blue-600"
                : "!bg-green-500 hover:!bg-green-600"
            } ${
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
      <div className={`flex flex-col h-full ${description ? 'gap-2' : 'items-center justify-center'}`}>
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
              onDoubleClick={handleTitleDoubleClick}
              onClick={!description ? handleDescriptionClick : undefined}
              title={!description ? "Click to add description or double-click to edit title" : "Double-click to edit title"}
            >
              {label}
            </div>
          )}
        </div>

        {/* Description - show if there's content or editing */}
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
      </div>
    </div>
  );
}

export default memo(CustomNode);
