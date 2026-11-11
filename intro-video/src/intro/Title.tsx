import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { fontFamily } from "./font";

const COLORS = ["#FF8FB1", "#FFB86B", "#FFD93D", "#7ED6A5", "#6FC3FF", "#A79BFF", "#FF9ECF"];

const Letter: React.FC<{ char: string; index: number }> = ({ char, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = index * 4;

  const drop = spring({
    frame: frame - delay,
    fps,
    config: { damping: 9, stiffness: 140, mass: 0.8 },
  });

  // A gentle wave runs through the letters while the orca passes by (2.6s–4.2s).
  const wobbleStrength = interpolate(
    frame,
    [1.6 * fps, 2 * fps, 3 * fps, 3.4 * fps],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const wobble = Math.sin(frame / 4 - index * 0.9) * 22 * wobbleStrength;

  return (
    <span
      style={{
        display: "inline-block",
        color: COLORS[index % COLORS.length],
        opacity: frame >= delay ? 1 : 0,
        translate: `0px ${interpolate(drop, [0, 1], [-700, 0]) + wobble}px`,
        scale: `${interpolate(drop, [0, 0.8, 1], [0.6, 1.08, 1])} ${interpolate(drop, [0, 0.8, 1], [1.3, 0.92, 1])}`,
        textShadow: "0 10px 0 rgba(30, 90, 140, 0.18)",
        WebkitTextStroke: "10px #FFFFFF",
        paintOrder: "stroke fill",
      }}
    >
      {char}
    </span>
  );
};

export const Title: React.FC<{ text: string }> = ({ text }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 80,
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 280,
          letterSpacing: 6,
          lineHeight: 1,
        }}
      >
        {text.split("").map((char, i) => (
          <Letter key={i} char={char} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
