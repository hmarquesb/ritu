"use client"

import {
  Tab as AriaTab,
  TabList as AriaTabList,
  type TabListProps as AriaTabListProps,
  TabPanel as AriaTabPanel,
  type TabPanelProps as AriaTabPanelProps,
  type TabProps as AriaTabProps,
  Tabs as AriaTabs,
  type TabsProps as AriaTabsProps,
} from "react-aria-components"
import { cx } from "@/components/cx"

export type TabsProps = Omit<AriaTabsProps, "className"> & { className?: string }

export function Tabs({ className, ...props }: TabsProps) {
  return <AriaTabs {...props} className={cx("flex flex-col gap-4 font-body", className)} />
}

export type TabListProps<T extends object> = Omit<AriaTabListProps<T>, "className"> & {
  className?: string
}

export function TabList<T extends object>({ className, ...props }: TabListProps<T>) {
  return (
    <AriaTabList
      {...props}
      className={cx("flex gap-1 overflow-x-auto border-b border-line", className)}
    />
  )
}

export type TabProps = Omit<AriaTabProps, "className"> & { className?: string }

export function Tab({ className, ...props }: TabProps) {
  return (
    <AriaTab
      {...props}
      className={cx(
        "relative inline-flex min-h-11 touch-manipulation shrink-0 cursor-pointer items-center px-4 text-body font-normal text-ink-muted outline-none",
        "transition-colors duration-[var(--ritu-fast)] ease-ritu",
        "after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-pill after:bg-transparent after:content-['']",
        "data-hovered:text-ink data-selected:font-semibold data-selected:text-ink data-selected:after:bg-primary",
        "data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
    />
  )
}

export type TabPanelProps = Omit<AriaTabPanelProps, "className"> & { className?: string }

export function TabPanel({ className, ...props }: TabPanelProps) {
  return (
    <AriaTabPanel
      {...props}
      className={cx(
        "rounded-md outline-none data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus",
        className,
      )}
    />
  )
}
