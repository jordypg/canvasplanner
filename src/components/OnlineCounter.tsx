"use client";

import { useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Users } from "lucide-react";
import { getOrCreateSession } from "@/utils/session";

const HEARTBEAT_INTERVAL_MS = 5000; // Update presence every 5 seconds

export default function OnlineCounter() {
  const activeCount = useQuery(api.presence.getActiveCount);
  const updatePresence = useMutation(api.presence.updatePresence);
  const removePresence = useMutation(api.presence.remove);

  useEffect(() => {
    const session = getOrCreateSession();
    if (!session) return;

    // Initial presence update
    updatePresence({
      sessionId: session.id,
      userName: session.userName,
    }).catch((error) => {
      console.error("Failed to update presence:", error);
    });

    // Set up heartbeat interval
    const intervalId = setInterval(() => {
      updatePresence({
        sessionId: session.id,
        userName: session.userName,
      }).catch((error) => {
        console.error("Failed to update presence:", error);
      });
    }, HEARTBEAT_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      clearInterval(intervalId);
      removePresence({ sessionId: session.id }).catch((error) => {
        console.error("Failed to remove presence:", error);
      });
    };
  }, [updatePresence, removePresence]);

  // Don't render until we have a count
  if (activeCount === undefined) {
    return null;
  }

  return (
    <div className="absolute top-4 left-4 z-50 flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-md border border-gray-200">
      <Users className="w-5 h-5 text-blue-600" />
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold text-gray-900">{activeCount}</span>
        <span className="text-sm text-gray-600">
          {activeCount === 1 ? "user" : "users"} online
        </span>
      </div>
    </div>
  );
}
