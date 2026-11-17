"use client"

import { List, SignOut } from "@phosphor-icons/react"
import { IconButton } from "@/components/base/icon-button"
import { Menu, MenuItem } from "@/components/base/menu"

export function MenuDaConta({ sair }: { sair: () => Promise<void> }) {
  return (
    <Menu
      label="Menu da conta"
      trigger={<IconButton icon={List} aria-label="Menu da conta" />}
      onAction={(id) => {
        if (id === "sair") void sair()
      }}
    >
      <MenuItem id="sair" icon={SignOut}>
        Sair
      </MenuItem>
    </Menu>
  )
}
