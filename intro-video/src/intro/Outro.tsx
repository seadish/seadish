import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        opacity: interpolate(frame, [0, durationInFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    />
  );
};
