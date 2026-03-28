import React from "react";

/**
 * Asclepius logo mark — the Rod of Asclepius (staff with serpent),
 * the universal symbol of medicine.
 */
export const AsclepiusIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Staff */}
    <line x1="12" y1="2" x2="12" y2="22" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
    {/* Serpent body — S-curve wrapping the staff */}
    <path
      d="M12 5 C16 5, 16 8, 12 9 C8 10, 8 13, 12 14 C16 15, 16 18, 12 19"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    {/* Serpent head */}
    <circle cx="12" cy="4.5" r="1.2" fill="#fff"/>
  </svg>
);

interface LogoMarkProps {
  size?: number;
  radius?: number;
  shadow?: string;
}

export const LogoMark: React.FC<LogoMarkProps> = ({
  size = 36,
  radius = 9,
  shadow = "0 4px 14px rgba(0,122,255,0.3)",
}) => (
  <div style={{
    width: size,
    height: size,
    background: "linear-gradient(135deg, #007AFF, #5856d6)",
    borderRadius: radius,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: shadow,
    flexShrink: 0,
  }}>
    <AsclepiusIcon size={Math.round(size * 0.58)} />
  </div>
);
