import localFont from "next/font/local"

export const titleFont = localFont({
  src: "./fonts/cormorant-garamond.woff2",
  weight: "300 700",
  variable: "--font-cormorant",
  display: "swap",
})

export const bodyFont = localFont({
  src: "./fonts/figtree.woff2",
  weight: "300 900",
  variable: "--font-figtree",
  display: "swap",
})
