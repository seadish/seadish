import { Composition } from "remotion";
import { SeadishIntro } from "./intro/SeadishIntro";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SeadishIntro"
        component={SeadishIntro}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ title: "seadish" }}
      />
    </>
  );
};
