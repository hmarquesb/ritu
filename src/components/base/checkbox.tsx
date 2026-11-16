"use client"

import { Check } from "@phosphor-icons/react"
import {
  Checkbox as AriaCheckbox,
  type CheckboxProps as AriaCheckboxProps,
} from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"

export type CheckboxProps = Omit<AriaCheckboxProps, "className"> & { className?: string }

export function Checkbox({ className, children, ...props }: CheckboxProps) {
  return (
    <AriaCheckbox
      {...props}
      className={cx(
        "group flex min-h-11 min-w-11 items-center gap-3 py-1 font-body text-body text-ink data-disabled:opacity-60",
        className,
      )}
    >
      {(state) => (
        <>
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-sm border border-line-strong bg-surface text-on-primary transition-colors duration-[var(--ritu-fast)] ease-ritu group-data-selected:border-primary group-data-selected:bg-primary group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-focus group-data-invalid:border-danger"
          >
            {state.isSelected ? <Check weight="light" size={ICON.sm} /> : null}
          </span>
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </AriaCheckbox>
  )
}
