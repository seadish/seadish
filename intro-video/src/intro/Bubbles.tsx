import { AbsoluteFill, interpolate, random, useCurrentFrame } from "remotion";

const BUBBLE_COUNT = 18;

const Bubble: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const x = random(`x-${index}`) * 1920;
  const size = 18 + random(`s-${index}`) * 46;
  const speed = 4 + random(`v-${index}`) * 5;
  const start = random(`d-${index}`) * 60;
  const travelled = Math.max(0, frame - start) * speed;
  const y = 1120 - travelled;

  return (
    <div
      style={{
        position: "absolute",
        left: x + Math.sin((frame + index * 20) / 12) * 18,
        top: y,
        width: size,
        height: size,
        borderRadius: "50%",
        border: "4px solid rgba(255,255,255,0.85)",
        background:
          "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9) 0 18%, rgba(255,255,255,0.15) 40%)",
        opacity: interpolate(y, [-80, 200, 900, 1120], [0, 0.9, 0.9, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    />
  );
};

export const Bubbles: React.FC = () => {
  return (
    <AbsoluteFill>
      {new Array(BUBBLE_COUNT).fill(true).map((_, i) => (
        <Bubble key={i} index={i} />
      ))}
    </AbsoluteFill>
  );
};
