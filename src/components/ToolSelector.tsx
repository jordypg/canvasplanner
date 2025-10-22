"use client";

import { useEffect } from "react";
import { MousePointer2, Combine } from "lucide-react";
import { ExpandableTabs } from "./ui/expandable-tabs";
import { useTool } from "@/contexts/ToolContext";

export default function ToolSelector() {
    const { activeTool, setActiveTool } = useTool();

    const tabs = [
        { title: "Select (V)", icon: MousePointer2 },
        { title: "Node (N)", icon: Combine },
    ];

    const handleToolChange = (index: number | null) => {
        if (index === 0) {
            setActiveTool("select");
        } else if (index === 1) {
            setActiveTool("node");
        }
    };

    // Find current index based on active tool
    const getCurrentIndex = () => {
        if (activeTool === "select") return 0;
        if (activeTool === "node") return 1;
        return null;
    };

    // Add hotkey support
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if user is typing in an input or textarea
            const target = event.target as HTMLElement;
            const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            if (isTyping) return;

            if (event.key === 'v' || event.key === 'V') {
                event.preventDefault();
                setActiveTool("select");
            } else if (event.key === 'n' || event.key === 'N') {
                event.preventDefault();
                setActiveTool("node");
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setActiveTool]);

    // Prevent all mouse events from propagating to canvas
    const handleMouseEvent = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
    };

    return (
        <div
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50"
            onMouseDown={handleMouseEvent}
            onMouseUp={handleMouseEvent}
            onClick={handleMouseEvent}
            onDoubleClick={handleMouseEvent}
        >
            <ExpandableTabs
                tabs={tabs}
                onChange={handleToolChange}
                selected={getCurrentIndex()}
                activeColor="text-primary"
                disableClickOutside={true}
            />
        </div>
    );
}
