import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <header className="w-full max-w-[1440px] mx-auto px-4 md:px-8 py-4 flex items-center justify-between gap-4">
        <Link href="/" aria-label="Compex Solution home" className="shrink-0">
          <Image src="/compex-logo.jpeg" alt="Compex Solution" width={140} height={96} priority className="h-10 w-auto rounded-sm" />
        </Link>
        <Link href="/" className="font-label-md text-[#1769E0] hover:underline">
          Back to website
        </Link>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">{children}</div>
    </div>
  );
}
