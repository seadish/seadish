import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

const wavePath = (offset: number, amplitude: number, baseY: number) => {
  // Two periods of a sine wave across 3840px so it can scroll seamlessly.
  const points: string[] = [];
  for (let x = 0; x <= 3840; x += 40) {
    const y = baseY + Math.sin((x / 960) * Math.PI * 2 + offset) * amplitude;
    points.push(`${x},${y.toFixed(1)}`);
  }
  return `M0,1080 L${points.join(" L")} L3840,1080 Z`;
};

const Wave: React.FC<{
  color: string;
  baseY: number;
  amplitude: number;
  speed: number;
  phase: number;
}> = ({ color, baseY, amplitude, speed, phase }) => {
  const frame = useCurrentFrame();

  return (
    <svg
      width={3840}
      height={1080}
      viewBox="0 0 3840 1080"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        translate: `${-((frame * speed) % 1920)}px ${Math.sin(frame / 18 + phase) * 8}px`,
      }}
    >
      <path d={wavePath(phase, amplitude, baseY)} fill={color} />
    </svg>
  );
};

export const Background: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #DDF4FF 0%, #BDE8FA 55%, #A6DDF5 100%)",
      }}
    >
      <AbsoluteFill
        style={{
          translate: `0px ${interpolate(frame, [0, 25], [220, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px`,
        }}
      >
        <Wave color="#8FD3F0" baseY={800} amplitude={26} speed={3} phase={0} />
        <Wave color="#6EC4EA" baseY={870} amplitude={22} speed={5} phase={1.7} />
        <Wave color="#55B4E0" baseY={950} amplitude={18} speed={7} phase={3.1} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
