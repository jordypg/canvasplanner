// Generate a unique session ID for the current user
export function generateSessionId(): string {
  return `session-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
}

// Generate a random color for the user's cursor
export function generateCursorColor(): string {
  const colors = [
    "#FF6B6B", // Red
    "#4ECDC4", // Cyan
    "#45B7D1", // Blue
    "#96CEB4", // Green
    "#FFEAA7", // Yellow
    "#DDA15E", // Orange
    "#BC6C25", // Brown
    "#8E44AD", // Purple
    "#E74C3C", // Dark Red
    "#3498DB", // Sky Blue
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Generate a random user name
export function generateUserName(): string {
  const adjectives = ["Quick", "Happy", "Clever", "Bright", "Swift", "Bold", "Calm", "Brave"];
  const nouns = ["Fox", "Eagle", "Tiger", "Lion", "Wolf", "Bear", "Hawk", "Shark"];

  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adjective} ${noun}`;
}

// Store session data in localStorage
export function getOrCreateSession() {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem("canvas-session");

  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // If parsing fails, create new session
    }
  }

  const session = {
    id: generateSessionId(),
    userName: generateUserName(),
    color: generateCursorColor(),
  };

  localStorage.setItem("canvas-session", JSON.stringify(session));
  return session;
}
