"use client"

import type { Icon } from "@phosphor-icons/react"
import type { Key, ReactElement, ReactNode } from "react"
import {
  Menu as AriaMenu,
  MenuItem as AriaMenuItem,
  type MenuItemProps as AriaMenuItemProps,
  MenuTrigger,
  Popover,
} from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"

export interface MenuProps {
  trigger: ReactElement
  label: string
  onAction: (id: Key) => void
  children: ReactNode
  className?: string
}

export function Menu({ trigger, label, onAction, children, className }: MenuProps) {
  return (
    <MenuTrigger>
      {trigger}
      <Popover
        placement="bottom start"
        offset={6}
        className={cx(
          "min-w-48 max-h-[min(24rem,var(--visible-height,100vh))] overflow-y-auto rounded-lg bg-raised p-1.5 shadow-lift animate-fade",
          className,
        )}
      >
        <AriaMenu aria-label={label} onAction={onAction} className="outline-none">
          {children}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  )
}

export interface MenuItemProps extends Omit<AriaMenuItemProps, "className" | "children" | "id"> {
  id: Key
  icon?: Icon
  tone?: "default" | "danger"
  children: ReactNode
  className?: string
}

const TONE = {
  default: "text-ink",
  danger: "text-danger",
} as const

export function MenuItem({
  id,
  icon: IconComponent,
  tone = "default",
  className,
  children,
  ...props
}: MenuItemProps) {
  return (
    <AriaMenuItem
      {...props}
      id={id as AriaMenuItemProps["id"]}
      textValue={props.textValue ?? (typeof children === "string" ? children : undefined)}
      data-tone={tone}
      className={cx(
        "flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-body outline-none",
        "data-focused:bg-sunken data-hovered:bg-sunken data-pressed:bg-sunken",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        TONE[tone],
        className,
      )}
    >
      {IconComponent ? <IconComponent weight="light" size={ICON.md} aria-hidden="true" /> : null}
      <span className="min-w-0 flex-1">{children}</span>
    </AriaMenuItem>
  )
}
