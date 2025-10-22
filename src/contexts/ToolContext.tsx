"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type ToolType = "select" | "node" | "connect" | "edit";

interface ToolContextType {
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
}

const ToolContext = createContext<ToolContextType | undefined>(undefined);

export function ToolProvider({ children }: { children: ReactNode }) {
  const [activeTool, setActiveTool] = useState<ToolType>("select");

  return (
    <ToolContext.Provider value={{ activeTool, setActiveTool }}>
      {children}
    </ToolContext.Provider>
  );
}

export function useTool() {
  const context = useContext(ToolContext);
  if (context === undefined) {
    throw new Error("useTool must be used within a ToolProvider");
  }
  return context;
}
