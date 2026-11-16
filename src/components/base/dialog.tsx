"use client"

import { X } from "@phosphor-icons/react"
import { type ReactNode, useId } from "react"
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components"
import { IconButton } from "@/components/base/icon-button"
import { cx } from "@/components/cx"

export const DialogTrigger = AriaDialogTrigger

export interface DialogProps {
  title: string
  description?: string
  role?: "dialog" | "alertdialog"
  isDismissable?: boolean
  isOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  children: ReactNode | ((close: () => void) => ReactNode)
  className?: string
}

const OVERLAY = {
  dialog: "items-center justify-center p-4",
  sheet: "items-end justify-center md:items-center md:p-4",
} as const

const MODAL = {
  dialog: "w-full max-w-lg rounded-lg animate-fade",
  sheet: "w-full rounded-t-lg animate-sheet md:max-w-lg md:rounded-lg md:animate-fade",
} as const

function Panel({ variant, ...props }: DialogProps & { variant: "dialog" | "sheet" }) {
  const { title, description, role = "dialog", isDismissable = true, children, className } = props
  const descriptionId = useId()
  return (
    <ModalOverlay
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
      isDismissable={isDismissable}
      className={cx("fixed inset-0 z-50 flex bg-scrim animate-fade", OVERLAY[variant])}
    >
      <Modal className={cx("flex max-h-[90dvh] flex-col bg-raised shadow-lift", MODAL[variant])}>
        <AriaDialog
          role={role}
          aria-describedby={description ? descriptionId : undefined}
          className={cx("flex min-h-0 flex-col outline-none", className)}
        >
          {({ close }) => (
            <>
              <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-2">
                <div className="min-w-0">
                  <Heading slot="title" className="font-title text-title-sm text-ink">
                    {title}
                  </Heading>
                  {description ? (
                    <p id={descriptionId} className="mt-1 text-sm text-ink-muted">
                      {description}
                    </p>
                  ) : null}
                </div>
                <IconButton icon={X} aria-label="Fechar" onPress={close} />
              </div>
              <div className="min-h-0 overflow-y-auto px-5 pt-2 pb-5">
                {typeof children === "function" ? children(close) : children}
              </div>
            </>
          )}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  )
}

export function Dialog(props: DialogProps) {
  return <Panel {...props} variant="dialog" />
}

export function Sheet(props: DialogProps) {
  return <Panel {...props} variant="sheet" />
}
