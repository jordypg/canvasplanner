import { memo } from "react";

interface CursorProps {
  x: number;
  y: number;
  color: string;
  userName: string;
}

function Cursor({ x, y, color, userName }: CursorProps) {
  return (
    <div
      className="fixed pointer-events-none z-50 transition-transform duration-100 ease-out"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-2px, -2px)",
      }}
    >
      {/* Cursor SVG */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M5.65376 12.3673L10.6269 17.3404L11.6904 19.4673C11.8711 19.8289 12.3034 19.9883 12.6909 19.8293C13.0785 19.6702 13.2804 19.2352 13.1451 18.8324L11.1821 12.7503L16.8777 12.0564C17.3093 12.0012 17.6154 11.6003 17.5582 11.1687C17.5207 10.8899 17.3416 10.6564 17.0985 10.5452L6.26686 5.68863C5.91481 5.52657 5.49751 5.68291 5.32669 6.02902C5.23051 6.23523 5.23038 6.4738 5.32644 6.67991L8.38037 12.3673H5.65376Z"
          fill={color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* User name label */}
      <div
        className="absolute top-6 left-4 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap shadow-lg"
        style={{ backgroundColor: color }}
      >
        {userName}
      </div>
    </div>
  );
}

export default memo(Cursor);
