"use client"

import { Check, type Icon, X } from "@phosphor-icons/react"
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
  Tag as AriaTag,
  TagGroup as AriaTagGroup,
  TagList as AriaTagList,
  type TagProps as AriaTagProps,
  ToggleButton as AriaToggleButton,
  type ToggleButtonProps as AriaToggleButtonProps,
  type Key,
  Label,
  Text,
} from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"

const CHIP =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill border border-line bg-surface px-4 py-1.5 font-body text-sm font-medium text-ink transition-[transform,background-color,border-color] duration-[var(--ritu-fast)] ease-ritu data-hovered:bg-sunken data-pressed:scale-[0.98] data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus data-disabled:opacity-60 data-selected:border-primary data-selected:bg-primary-soft"

export type ChipProps = Omit<AriaButtonProps, "className"> & { icon?: Icon; className?: string }

export function Chip({ icon: Glyph, className, children, ...props }: ChipProps) {
  return (
    <AriaButton {...props} className={cx(CHIP, className)}>
      {(state) => (
        <>
          {Glyph ? <Glyph weight="light" size={ICON.sm} aria-hidden="true" /> : null}
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </AriaButton>
  )
}

export type ToggleChipProps = Omit<AriaToggleButtonProps, "className"> & {
  icon?: Icon
  className?: string
}

export function ToggleChip({ icon: Glyph, className, children, ...props }: ToggleChipProps) {
  return (
    <AriaToggleButton {...props} className={cx(CHIP, className)}>
      {(state) => (
        <>
          {state.isSelected ? (
            <Check weight="light" size={ICON.sm} aria-hidden="true" />
          ) : Glyph ? (
            <Glyph weight="light" size={ICON.sm} aria-hidden="true" />
          ) : null}
          {typeof children === "function" ? children(state) : children}
        </>
      )}
    </AriaToggleButton>
  )
}

export type TagProps = Omit<AriaTagProps, "className"> & { className?: string }

export function Tag({ className, children, textValue, ...props }: TagProps) {
  const text = textValue ?? (typeof children === "string" ? children : undefined)
  return (
    <AriaTag
      {...props}
      textValue={text}
      className={cx(
        "inline-flex min-h-11 items-center gap-1 rounded-pill border border-line bg-surface py-1 pl-4 font-body text-sm font-medium text-ink data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus",
        "pr-4 data-[allows-removing]:pr-1",
        className,
      )}
    >
      {({ allowsRemoving }) => (
        <>
          {typeof children === "function" ? null : children}
          {allowsRemoving ? (
            <AriaButton
              slot="remove"
              aria-label={`Tirar ${text ?? ""}`.trim()}
              className="flex size-11 items-center justify-center rounded-pill text-ink-muted transition-transform duration-[var(--ritu-fast)] ease-ritu data-hovered:text-ink data-pressed:scale-[0.98] data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus"
            >
              <X weight="light" size={ICON.sm} aria-hidden="true" />
            </AriaButton>
          ) : null}
        </>
      )}
    </AriaTag>
  )
}

export type TagListProps = {
  label: string
  items: { id: string; label: string }[]
  onRemove?: (ids: Set<Key>) => void
  emptyText?: string
  className?: string
}

export function TagList({ label, items, onRemove, emptyText, className }: TagListProps) {
  return (
    <AriaTagGroup onRemove={onRemove} className={cx("flex flex-col gap-2 font-body", className)}>
      <Label className="text-sm font-medium text-ink">{label}</Label>
      <AriaTagList
        items={items}
        className="flex flex-wrap gap-2"
        renderEmptyState={() => <Text className="text-sm text-ink-muted">{emptyText ?? ""}</Text>}
      >
        {(item) => <Tag id={item.id}>{item.label}</Tag>}
      </AriaTagList>
    </AriaTagGroup>
  )
}
