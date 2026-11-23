import Link from "next/link"
import { Logo } from "@/components/brand/logo"

export function CabecalhoPublico() {
  return (
    <header className="mx-auto flex w-full max-w-[64rem] items-center px-4 pt-5 min-[48rem]:px-6">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-md text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <Logo variant="full" size="sm" />
      </Link>
    </header>
  )
}
