import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

// The mark is the app icon itself (the otter), copied from gig-app/assets/otter-logo.png.
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
      <Image
        src="/otter-mark.png"
        alt=""
        width={64}
        height={64}
        className="size-8 shrink-0 rounded-lg"
        priority
      />
      {showWordmark && (
        <h1 className="font-black text-sm sm:text-lg md:text-xl lg:text-2xl text-primary">
          AdHoc
        </h1>
      )}
    </Link>
  );
}
