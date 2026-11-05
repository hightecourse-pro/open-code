// The hackathon's logo with motion - the owner's own animated file (5/11: ״שים את הלוגו המונפש המצורף״),
// served as it is (a GIF keeps moving where the system turned CSS animations off).
import Image from "next/image";

export function HackathonLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/hackathon-2026/logo-hackathon-animated.gif"
      alt="האקתון AI 2026 - לפצח את קוד הכניסה"
      width={900}
      height={532}
      priority
      unoptimized
      className={className}
      data-testid="sh-logo"
    />
  );
}
