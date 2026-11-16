"use client"

import { WarningCircle } from "@phosphor-icons/react"
import {
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  FieldError,
  Input,
  Label,
  Text,
  TextArea,
} from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"

export type TextFieldProps = Omit<AriaTextFieldProps, "children" | "className"> & {
  label: string
  hideLabel?: boolean
  description?: string
  errorMessage?: string
  multiline?: boolean
  rows?: number
  className?: string
}

const CONTROL =
  "w-full min-h-11 rounded-md border border-line-strong bg-surface px-4 py-2.5 font-body text-body text-ink placeholder:text-ink-muted transition-colors duration-[var(--ritu-fast)] ease-ritu data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus data-invalid:border-danger data-disabled:opacity-60"

export function TextField({
  label,
  hideLabel,
  description,
  errorMessage,
  multiline,
  rows = 3,
  className,
  isInvalid,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField
      {...props}
      isInvalid={isInvalid || Boolean(errorMessage)}
      className={cx("flex flex-col gap-1.5 font-body", className)}
    >
      <Label className={hideLabel ? "sr-only" : "text-sm font-medium text-ink"}>{label}</Label>
      {multiline ? (
        <TextArea rows={rows} className={cx(CONTROL, "resize-y leading-[1.6]")} />
      ) : (
        <Input className={CONTROL} />
      )}
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
    </AriaTextField>
  )
}
