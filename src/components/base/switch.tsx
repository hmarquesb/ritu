"use client"

import { Switch as AriaSwitch, type SwitchProps as AriaSwitchProps } from "react-aria-components"
import { cx } from "@/components/cx"

export type SwitchProps = Omit<AriaSwitchProps, "className"> & { className?: string }

export function Switch({ className, children, ...props }: SwitchProps) {
  return (
    <AriaSwitch
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
            className="flex h-7 w-12 shrink-0 items-center rounded-pill border border-line-strong bg-sunken p-0.5 transition-colors duration-[var(--ritu-fast)] ease-ritu group-data-selected:border-primary group-data-selected:bg-primary group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-focus"
          >
            <span className="size-5 rounded-pill bg-line-strong transition-transform duration-[var(--ritu-base)] ease-ritu group-data-selected:translate-x-5 group-data-selected:bg-on-primary" />
          </span>
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </AriaSwitch>
  )
}
