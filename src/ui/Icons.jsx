import React from "react";

const s = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const CameraIcon = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <path d="M3 8h3l2-3h8l2 3h3v11H3z" />
    <circle cx="12" cy="13" r="3.2" />
  </svg>
);
export const InteriorIcon = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 4v4M4.5 15l4-1.5M19.5 15l-4-1.5" />
  </svg>
);
export const MapIcon = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);
export const LightsIcon = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <path d="M4 7c3-1 5-1 5 5s-2 6-5 5z" />
    <path d="M12 8h3M12 12h5M12 16h3" />
  </svg>
);
export const HazardIcon = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <path d="M12 3 2 20h20z" />
    <path d="M12 9v5M12 17h.01" />
  </svg>
);
export const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
  </svg>
);
export const ExitIcon = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <path d="M14 4h4v16h-4" />
    <path d="M10 8l-4 4 4 4M6 12h9" />
  </svg>
);
export const WheelIcon = () => (
  <svg viewBox="0 0 24 24" {...s} style={{ width: 46, height: 46 }}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 14.5V21M9.6 11 4 8M14.4 11 20 8" />
  </svg>
);
export const RouteIcon = () => (
  <svg viewBox="0 0 24 24" {...s}>
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18h6a4 4 0 0 0 0-8H9a4 4 0 0 1 0-8h1" />
  </svg>
);
