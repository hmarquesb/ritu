"use client"

import {
  Radio as AriaRadio,
  RadioGroup as AriaRadioGroup,
  type RadioGroupProps as AriaRadioGroupProps,
  type RadioProps as AriaRadioProps,
  Label,
} from "react-aria-components"
import { cx } from "@/components/cx"

export type RadioGroupProps = Omit<AriaRadioGroupProps, "className" | "children"> & {
  label: string
  children: React.ReactNode
  className?: string
}

const ORIENTATION = {
  horizontal: "flex-row flex-wrap",
  vertical: "flex-col",
} as const

export function RadioGroup({
  label,
  orientation = "horizontal",
  className,
  children,
  ...props
}: RadioGroupProps) {
  return (
    <AriaRadioGroup
      {...props}
      orientation={orientation}
      className={cx("flex flex-col gap-2 font-body", className)}
    >
      <Label className="text-sm font-medium text-ink">{label}</Label>
      <div className={cx("flex gap-2", ORIENTATION[orientation])}>{children}</div>
    </AriaRadioGroup>
  )
}

export type RadioProps = Omit<AriaRadioProps, "className"> & { className?: string }

export function Radio({ className, children, ...props }: RadioProps) {
  return (
    <AriaRadio
      {...props}
      className={cx(
        "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-pill border border-line bg-surface px-4 py-1.5 font-body text-sm font-medium text-ink transition-[transform,background-color,border-color] duration-[var(--ritu-fast)] ease-ritu data-hovered:bg-sunken data-pressed:scale-[0.98] data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus data-disabled:cursor-not-allowed data-disabled:opacity-60 data-selected:border-primary data-selected:bg-primary-soft",
        className,
      )}
    >
      {children}
    </AriaRadio>
  )
}
