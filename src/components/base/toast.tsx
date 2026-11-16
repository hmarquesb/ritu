"use client"

import { config } from "@config/index"
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react"
import {
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastRegion as AriaToastRegion,
  Button,
  Text,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastQueue as ToastQueue,
} from "react-aria-components"
import { ICON } from "@/components/base/icon-size"
import { cx } from "@/components/cx"

type Tone = "neutral" | "positive" | "danger"

interface ToastContentValue {
  message: string
  tone: Tone
}

export interface ToastOptions {
  tone?: Tone
  timeoutMs?: number
}

const queue = new ToastQueue<ToastContentValue>({ maxVisibleToasts: 5 })

export function toast(message: string, options?: ToastOptions): void {
  queue.add(
    { message, tone: options?.tone ?? "neutral" },
    { timeout: options?.timeoutMs ?? config.ui.toast.timeoutMs },
  )
}

const TONE = {
  neutral: { box: "bg-raised text-ink", Icon: Info },
  positive: { box: "bg-sage-soft text-sage-ink", Icon: CheckCircle },
  danger: { box: "bg-danger-soft text-danger", Icon: WarningCircle },
} as const

export function ToastRegion() {
  return (
    <AriaToastRegion
      queue={queue}
      aria-label="Avisos"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col-reverse items-center gap-2 p-4 outline-none data-focus-visible:outline-2 data-focus-visible:-outline-offset-2 data-focus-visible:outline-focus"
    >
      {({ toast: item }) => {
        const { box, Icon } = TONE[item.content.tone]
        return (
          <AriaToast
            toast={item}
            className={cx(
              "flex w-full max-w-content items-center gap-3 rounded-lg border border-line py-2 pl-4 pr-2 font-body shadow-lift animate-rise outline-none",
              "data-focus-visible:outline-2 data-focus-visible:outline-offset-2 data-focus-visible:outline-focus",
              box,
            )}
          >
            <Icon weight="light" size={ICON.lg} aria-hidden="true" className="shrink-0" />
            <ToastContent className="min-w-0 flex-1">
              <Text slot="title" className="text-body text-pretty break-words">
                {item.content.message}
              </Text>
            </ToastContent>
            <Button
              slot="close"
              aria-label="Dispensar"
              className="flex size-11 shrink-0 touch-manipulation cursor-pointer items-center justify-center rounded-pill data-hovered:bg-sunken data-focus-visible:outline-2 data-focus-visible:outline-focus"
            >
              <X weight="light" size={ICON.md} aria-hidden="true" />
            </Button>
          </AriaToast>
        )
      }}
    </AriaToastRegion>
  )
}
