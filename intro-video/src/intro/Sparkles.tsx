import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const SPARKLES = [
  { x: 390, y: 300, size: 90, delay: 0, color: "#FFD93D" },
  { x: 1500, y: 260, size: 110, delay: 4, color: "#FFFFFF" },
  { x: 1580, y: 620, size: 70, delay: 8, color: "#FFB86B" },
  { x: 330, y: 640, size: 64, delay: 6, color: "#FFFFFF" },
  { x: 960, y: 180, size: 76, delay: 10, color: "#FF9ECF" },
];

const Star: React.FC<(typeof SPARKLES)[number]> = ({ x, y, size, delay, color }) => {
  const frame = useCurrentFrame();

  return (
    <svg
      width={size}
      height={size}
      viewBox="-50 -50 100 100"
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        scale: interpolate(frame - delay, [0, 6, 14], [0, 1.15, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        rotate: `${interpolate(frame - delay, [0, 14], [0, 90], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })}deg`,
      }}
    >
      <path d="M0 -50 Q8 -8 50 0 Q8 8 0 50 Q-8 8 -50 0 Q-8 -8 0 -50 Z" fill={color} />
    </svg>
  );
};

export const Sparkles: React.FC = () => {
  return (
    <AbsoluteFill>
      {SPARKLES.map((s, i) => (
        <Star key={i} {...s} />
      ))}
    </AbsoluteFill>
  );
};
