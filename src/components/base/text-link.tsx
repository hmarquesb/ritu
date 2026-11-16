"use client"

import { Link, type LinkProps } from "react-aria-components"
import { cx } from "@/components/cx"

export interface TextLinkProps extends Omit<LinkProps, "className"> {
  className?: string
}

export function TextLink({ className, ...props }: TextLinkProps) {
  return (
    <Link
      data-inline=""
      {...props}
      className={cx(
        "text-primary underline underline-offset-4 decoration-1 cursor-pointer rounded-sm",
        "transition-colors duration-[var(--ritu-fast)] ease-ritu",
        "data-hovered:text-primary-hover data-pressed:text-primary-pressed data-disabled:opacity-50 data-disabled:cursor-not-allowed",
        className,
      )}
    />
  )
}
