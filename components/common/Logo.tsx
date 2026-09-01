import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// The mark is the app icon's foreground — a white pig on transparent — so it
// needs the brand navy behind it or it disappears on a white sidebar. #103572
// is the icon's own background, sampled from assets/adhoc-icon.png in gig-app,
// which keeps this tile and the phone's home screen the same blue.
const BRAND_NAVY = "#103572";

export default function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 cursor-pointer", className)}
    >
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: BRAND_NAVY }}
      >
        <Image
          src="/adhoc-mark.png"
          alt=""
          width={64}
          height={64}
          className="size-6"
          priority
        />
      </span>
      {showWordmark && (
        <h1 className="font-black text-sm sm:text-lg md:text-xl lg:text-2xl text-primary">
          AdHoc
        </h1>
      )}
    </Link>
  );
}
