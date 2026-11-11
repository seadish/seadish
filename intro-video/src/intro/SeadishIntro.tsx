import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Background } from "./Background";
import { Bubbles } from "./Bubbles";
import { Fish } from "./Fish";
import { Outro } from "./Outro";
import { Sparkles } from "./Sparkles";
import { Title } from "./Title";

type Props = {
  readonly title: string;
};

export const SeadishIntro: React.FC<Props> = ({ title }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Background />
      <Bubbles />
      <Sequence name="Title" from={1 * fps} layout="none">
        <Title text={title} />
      </Sequence>
      <Sequence name="Fish" from={2.6 * fps} durationInFrames={1.6 * fps}>
        <Fish />
      </Sequence>
      <Sequence name="Sparkles" from={3.6 * fps}>
        <Sparkles />
      </Sequence>
      <Sequence name="Outro" from={4.5 * fps}>
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
