import { Masthead } from "@/components/kit/Masthead";
import { FrontPage } from "@/components/FrontPage";

export default function HomePage() {
  return (
    <div className="wrap">
      <Masthead current="home" />
      <FrontPage />
    </div>
  );
}
