"use client"

import { WarningCircle } from "@phosphor-icons/react"
import { FieldError, Text } from "react-aria-components"
import { ICON } from "@/components/base/icon-size"

/** Descrição e mensagem de erro comuns aos campos de texto e de busca. */
export function FieldHelp({
  description,
  errorMessage,
}: {
  description?: string
  errorMessage?: string
}) {
  return (
    <>
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
    </>
  )
}
