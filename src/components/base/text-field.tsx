"use client"

import {
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
  Input,
  Label,
  TextArea,
} from "react-aria-components"
import { FieldHelp } from "@/components/base/field-error"
import { cx } from "@/components/cx"

export type TextFieldProps = Omit<AriaTextFieldProps, "children" | "className"> & {
  label: string
  hideLabel?: boolean
  description?: string
  errorMessage?: string
  multiline?: boolean
  "aria-disabled"?: boolean | "true" | "false"
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
  "aria-disabled": ariaDisabled,
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
        <TextArea
          rows={rows}
          aria-disabled={ariaDisabled}
          className={cx(CONTROL, "resize-y leading-[1.6]")}
        />
      ) : (
        <Input aria-disabled={ariaDisabled} className={CONTROL} />
      )}
      <FieldHelp description={description} errorMessage={errorMessage} />
    </AriaTextField>
  )
}
