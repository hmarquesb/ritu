"use client"

import { CaretDown, WarningCircle } from "@phosphor-icons/react"
import {
  ComboBox as AriaComboBox,
  type ComboBoxProps as AriaComboBoxProps,
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  Popover,
  Text,
} from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { Spinner } from "@/components/base/spinner"
import { cx } from "@/components/cx"

export type ComboBoxProps<T extends object> = Omit<
  AriaComboBoxProps<T>,
  "children" | "className"
> & {
  label: string
  description?: string
  errorMessage?: string
  isLoading?: boolean
  emptyText: string
  children: React.ReactNode | ((item: T) => React.ReactNode)
  className?: string
}

export function ComboBox<T extends object>({
  label,
  description,
  errorMessage,
  isLoading,
  emptyText,
  children,
  className,
  isInvalid,
  ...props
}: ComboBoxProps<T>) {
  return (
    <AriaComboBox
      {...props}
      isInvalid={isInvalid || Boolean(errorMessage)}
      className={cx("group flex flex-col gap-1.5 font-body", className)}
    >
      <Label className="text-sm font-medium text-ink">{label}</Label>
      <div className="relative flex">
        <Input
          autoComplete="off"
          className="min-h-11 w-full rounded-md border border-line-strong bg-surface py-2.5 pl-4 pr-12 text-body text-ink placeholder:text-ink-muted transition-colors duration-[var(--ritu-fast)] ease-ritu data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus data-invalid:border-danger data-disabled:opacity-60"
        />
        <Button className="touch-manipulation absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-md text-ink data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus data-disabled:opacity-50">
          <CaretDown weight="light" size={ICON.md} aria-hidden="true" />
        </Button>
      </div>
      {description ? (
        <Text slot="description" className="text-caption text-ink-muted">
          {description}
        </Text>
      ) : null}
      <FieldError className="flex items-start gap-1.5 text-caption text-danger">
        <WarningCircle
          weight="light"
          size={ICON.sm}
          aria-hidden="true"
          className="mt-0.5 shrink-0"
        />
        <span>{errorMessage}</span>
      </FieldError>
      <Popover className="w-(--trigger-width) rounded-lg border border-line bg-raised shadow-lift">
        <ListBox
          className="max-h-72 overflow-y-auto p-1.5 outline-none"
          renderEmptyState={() =>
            isLoading ? (
              <div className="flex min-h-11 items-center px-3 text-sm text-ink-muted">
                <Spinner label={label} />
              </div>
            ) : (
              <div className="flex min-h-11 items-center px-3 text-sm text-ink-muted">
                {emptyText}
              </div>
            )
          }
        >
          {children}
        </ListBox>
      </Popover>
    </AriaComboBox>
  )
}

export function ComboBoxItem({
  className,
  ...props
}: Omit<ListBoxItemProps, "className"> & { className?: string }) {
  return (
    <ListBoxItem
      {...props}
      className={cx(
        "flex min-h-11 cursor-pointer items-center rounded-md px-3 text-body text-ink outline-none",
        "data-focused:bg-sunken data-hovered:bg-sunken data-selected:font-semibold data-selected:bg-primary-soft",
        "data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
    />
  )
}
