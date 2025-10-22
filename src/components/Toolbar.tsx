"use client";

import { useTool } from "@/contexts/ToolContext";
import { useEffect, useState } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

interface ToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  currentZoom?: number;
  userCount?: number;
}

export default function Toolbar({
  onZoomIn,
  onZoomOut,
  onZoomReset,
  currentZoom = 100,
  userCount = 1,
}: ToolbarProps) {
  const { activeTool, setActiveTool } = useTool();
  const isOnline = useOnlineStatus();
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("select");
          break;
        case "n":
          setActiveTool("node");
          break;
        case "c":
          setActiveTool("connect");
          break;
        case "e":
          setActiveTool("edit");
          break;
        case "+":
        case "=":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onZoomIn?.();
          }
          break;
        case "-":
        case "_":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onZoomOut?.();
          }
          break;
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onZoomReset?.();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTool, onZoomIn, onZoomOut, onZoomReset]);

  // Tooltip component
  const Tooltip = ({ text, children }: { text: string; children: React.ReactNode }) => (
    <div
      className="relative group"
      onMouseEnter={() => setShowTooltip(text)}
      onMouseLeave={() => setShowTooltip(null)}
    >
      {children}
      {showTooltip === text && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none">
          {text}
          <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900" />
        </div>
      )}
    </div>
  );

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4 overflow-y-auto flex flex-col h-full">
      <div className="space-y-6 flex-1">
        {/* Status Indicators */}
        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <Tooltip text={isOnline ? "Connected to server" : "Disconnected from server"}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-xs font-medium text-gray-700">
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
            </Tooltip>
            <Tooltip text={`${userCount} active user${userCount !== 1 ? 's' : ''}`}>
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <title>Users icon</title>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>{userCount}</span>
              </div>
            </Tooltip>
          </div>
        </div>

        {/* Tools Section */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Tools</h2>
          <div className="space-y-2">
            <Tooltip text="Select and move elements (V)">
              <button
                type="button"
                onClick={() => setActiveTool("select")}
                aria-label="Select tool"
                aria-pressed={activeTool === "select"}
                className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeTool === "select"
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>Select</span>
                <span className="text-xs opacity-70">V</span>
              </button>
            </Tooltip>
            <Tooltip text="Create new nodes (N)">
              <button
                type="button"
                onClick={() => setActiveTool("node")}
                aria-label="Node creation tool"
                aria-pressed={activeTool === "node"}
                className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeTool === "node"
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>Add Node</span>
                <span className="text-xs opacity-70">N</span>
              </button>
            </Tooltip>
            <Tooltip text="Connect nodes with edges (C)">
              <button
                type="button"
                onClick={() => setActiveTool("connect")}
                aria-label="Connect tool"
                aria-pressed={activeTool === "connect"}
                className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeTool === "connect"
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>Connect</span>
                <span className="text-xs opacity-70">C</span>
              </button>
            </Tooltip>
            <Tooltip text="Edit node properties (E)">
              <button
                type="button"
                onClick={() => setActiveTool("edit")}
                aria-label="Edit tool"
                aria-pressed={activeTool === "edit"}
                className={`w-full px-3 py-2 text-left text-sm font-medium rounded-lg transition-colors flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  activeTool === "edit"
                    ? "text-white bg-blue-600 hover:bg-blue-700"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>Edit</span>
                <span className="text-xs opacity-70">E</span>
              </button>
            </Tooltip>
          </div>
        </div>

        {/* Zoom Controls */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">View</h2>
          <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-700">Zoom</span>
              <span className="text-xs text-gray-600">{Math.round(currentZoom)}%</span>
            </div>
            <div className="flex gap-2">
              <Tooltip text="Zoom out (Ctrl/Cmd + -)">
                <button
                  type="button"
                  onClick={onZoomOut}
                  aria-label="Zoom out"
                  disabled={!onZoomOut}
                  className="flex-1 px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  −
                </button>
              </Tooltip>
              <Tooltip text="Reset zoom (Ctrl/Cmd + 0)">
                <button
                  type="button"
                  onClick={onZoomReset}
                  aria-label="Reset zoom"
                  disabled={!onZoomReset}
                  className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  100%
                </button>
              </Tooltip>
              <Tooltip text="Zoom in (Ctrl/Cmd + +)">
                <button
                  type="button"
                  onClick={onZoomIn}
                  aria-label="Zoom in"
                  disabled={!onZoomIn}
                  className="flex-1 px-2 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                >
                  +
                </button>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Node Types Section */}
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Node Types</h2>
          <div className="space-y-2">
            <Tooltip text="Standard workflow process">
              <div className="p-3 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors focus-within:ring-2 focus-within:ring-blue-500" tabIndex={0} role="button">
                <div className="text-sm font-medium text-gray-900">Process</div>
                <div className="text-xs text-gray-500">Standard process node</div>
              </div>
            </Tooltip>
            <Tooltip text="Conditional branching logic">
              <div className="p-3 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors focus-within:ring-2 focus-within:ring-blue-500" tabIndex={0} role="button">
                <div className="text-sm font-medium text-gray-900">Decision</div>
                <div className="text-xs text-gray-500">Conditional branching</div>
              </div>
            </Tooltip>
            <Tooltip text="Workflow start or end points">
              <div className="p-3 border border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors focus-within:ring-2 focus-within:ring-blue-500" tabIndex={0} role="button">
                <div className="text-sm font-medium text-gray-900">Start/End</div>
                <div className="text-xs text-gray-500">Workflow endpoints</div>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Help */}
      <div className="mt-auto pt-4 border-t border-gray-200">
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer hover:text-gray-900 font-medium">Keyboard Shortcuts</summary>
          <div className="mt-2 space-y-1 pl-2">
            <div className="flex justify-between">
              <span>Select:</span>
              <kbd className="px-1 bg-gray-200 rounded">V</kbd>
            </div>
            <div className="flex justify-between">
              <span>Add Node:</span>
              <kbd className="px-1 bg-gray-200 rounded">N</kbd>
            </div>
            <div className="flex justify-between">
              <span>Connect:</span>
              <kbd className="px-1 bg-gray-200 rounded">C</kbd>
            </div>
            <div className="flex justify-between">
              <span>Edit:</span>
              <kbd className="px-1 bg-gray-200 rounded">E</kbd>
            </div>
            <div className="flex justify-between">
              <span>Zoom In:</span>
              <kbd className="px-1 bg-gray-200 rounded">Ctrl/Cmd +</kbd>
            </div>
            <div className="flex justify-between">
              <span>Zoom Out:</span>
              <kbd className="px-1 bg-gray-200 rounded">Ctrl/Cmd -</kbd>
            </div>
            <div className="flex justify-between">
              <span>Reset Zoom:</span>
              <kbd className="px-1 bg-gray-200 rounded">Ctrl/Cmd 0</kbd>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
