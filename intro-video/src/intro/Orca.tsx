import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const Orca: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const tail = Math.sin(frame / 3) * 12;

  return (
    <AbsoluteFill>
      <svg
        width={420}
        height={230}
        viewBox="0 0 420 230"
        style={{
          position: "absolute",
          top: 660,
          translate: `${interpolate(frame, [0, durationInFrames], [-480, 2000], {
            easing: Easing.inOut(Easing.sin),
          })}px ${Math.sin(frame / 6) * 20}px`,
          rotate: `${Math.cos(frame / 6) * 5}deg`,
        }}
      >
        {/* tail flukes, flapping up and down */}
        <g style={{ transformOrigin: "95px 125px", rotate: `${tail}deg` }}>
          <path d="M100 125 Q60 118 22 82 Q40 120 30 128 Q40 136 22 172 Q60 134 100 132 Z" fill="#1F2A44" />
        </g>
        {/* dorsal fin */}
        <path d="M200 70 Q215 10 250 4 Q238 40 250 72 Z" fill="#1F2A44" />
        {/* body */}
        <path
          d="M90 128 Q120 66 230 62 Q340 58 392 112 Q404 128 390 146 Q340 192 230 190 Q130 188 90 128 Z"
          fill="#1F2A44"
        />
        {/* white belly */}
        <path d="M150 168 Q230 150 330 160 Q370 166 386 150 Q350 186 240 186 Q180 186 150 168 Z" fill="#FFFFFF" />
        {/* side flipper */}
        <path d="M250 160 Q240 200 268 214 Q272 186 276 162 Z" fill="#1F2A44" />
        {/* grey saddle patch */}
        <path d="M180 76 Q215 66 260 72 Q230 90 182 86 Z" fill="#7C8AA5" opacity="0.7" />
        {/* white eye patch */}
        <ellipse cx="318" cy="98" rx="26" ry="12" fill="#FFFFFF" transform="rotate(-12 318 98)" />
        {/* eye */}
        <circle cx="345" cy="118" r="6" fill="#FFFFFF" />
        <circle cx="346" cy="118" r="3.5" fill="#1F2A44" />
        {/* cheek + smile */}
        <circle cx="350" cy="140" r="9" fill="#FF8FB1" opacity="0.75" />
        <path d="M368 136 Q382 144 392 134" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </AbsoluteFill>
  );
};
