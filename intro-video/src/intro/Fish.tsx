import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const Fish: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const tail = Math.sin(frame / 2.2) * 14;

  return (
    <AbsoluteFill>
      <svg
        width={260}
        height={180}
        viewBox="0 0 260 180"
        style={{
          position: "absolute",
          top: 700,
          translate: `${interpolate(frame, [0, durationInFrames], [-300, 2000], {
            easing: Easing.inOut(Easing.sin),
          })}px ${Math.sin(frame / 5) * 18}px`,
          rotate: `${Math.cos(frame / 5) * 6}deg`,
        }}
      >
        {/* tail */}
        <g style={{ transformOrigin: "70px 90px", rotate: `${tail}deg` }}>
          <path d="M70 90 L10 40 Q24 90 10 140 Z" fill="#FF9E7A" />
        </g>
        {/* body */}
        <ellipse cx="145" cy="90" rx="85" ry="62" fill="#FFB38A" />
        <path d="M120 32 Q150 0 180 34" fill="#FF9E7A" />
        <ellipse cx="135" cy="105" rx="28" ry="16" fill="#FFD0B5" />
        {/* stripes */}
        <path d="M110 40 Q100 90 110 140" stroke="#FFFFFF" strokeWidth="10" fill="none" opacity="0.7" />
        {/* eye */}
        <circle cx="190" cy="76" r="16" fill="#FFFFFF" />
        <circle cx="194" cy="76" r="9" fill="#2B3A55" />
        <circle cx="197" cy="72" r="3" fill="#FFFFFF" />
        {/* cheek + smile */}
        <circle cx="200" cy="104" r="8" fill="#FF8FB1" opacity="0.7" />
        <path d="M212 96 Q220 104 212 110" stroke="#2B3A55" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </AbsoluteFill>
  );
};
