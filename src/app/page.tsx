"use client";

import dynamic from "next/dynamic";
import { ToolProvider } from "@/contexts/ToolContext";

// Dynamically import CanvasWithToolbar to avoid SSR issues with React Flow
const CanvasWithToolbar = dynamic(() => import("@/components/CanvasWithToolbar"), { ssr: false });

export default function Home() {
  return (
    <ToolProvider>
      <div className="flex flex-col h-screen">
        <CanvasWithToolbar />
      </div>
    </ToolProvider>
  );
}
