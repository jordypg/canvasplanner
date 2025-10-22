"use client";

import { ReactFlowProvider } from "reactflow";
import Canvas from "./Canvas";

function CanvasWithToolbarContent() {
  return <Canvas />;
}

export default function CanvasWithToolbar() {
  return (
    <ReactFlowProvider>
      <CanvasWithToolbarContent />
    </ReactFlowProvider>
  );
}
