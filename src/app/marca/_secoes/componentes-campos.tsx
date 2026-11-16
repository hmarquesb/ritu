"use client"

import { useState } from "react"
import { Checkbox } from "@/components/base/checkbox"
import { Chip, TagList, ToggleChip } from "@/components/base/chip"
import { ComboBox, ComboBoxItem } from "@/components/base/combo-box"
import { Switch } from "@/components/base/switch"
import { TextField } from "@/components/base/text-field"
import { Bloco, Linha } from "./componentes-bloco"

const ALIMENTOS = ["Gengibre", "Canela", "Cúrcuma", "Arroz", "Ghee", "Cardamomo", "Erva-doce"].map(
  (nome) => ({ id: nome.toLowerCase(), nome }),
)

export function CamposTexto() {
  return (
    <>
      <Bloco titulo="TextField">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Cidade" />
          <TextField label="O que tem em casa" description="Separe os itens por vírgula." />
          <TextField
            label="Cidade"
            defaultValue="Rio"
            errorMessage="Escolha uma cidade da lista."
          />
          <TextField label="Apelido" isDisabled defaultValue="Helena" />
          <TextField
            label="Como foi o chá?"
            multiline
            rows={3}
            className="md:col-span-2"
            description="Conte com suas palavras."
          />
        </div>
      </Bloco>
      <Bloco titulo="ComboBox">
        <div className="grid gap-4 md:grid-cols-2">
          <ComboBox
            label="Alimento"
            data-testid="busca"
            emptyText="Nada com esse nome na lista."
            defaultItems={ALIMENTOS}
          >
            {(item) => <ComboBoxItem id={item.id}>{item.nome}</ComboBoxItem>}
          </ComboBox>
          <ComboBox
            label="Alimento (buscando)"
            isLoading
            emptyText="Nada com esse nome na lista."
            defaultItems={[] as typeof ALIMENTOS}
            menuTrigger="focus"
          >
            {(item) => <ComboBoxItem id={item.id}>{item.nome}</ComboBoxItem>}
          </ComboBox>
        </div>
      </Bloco>
    </>
  )
}

export function Selecao() {
  const [itens, setItens] = useState(
    ALIMENTOS.slice(0, 3).map(({ id, nome }) => ({ id, label: nome })),
  )
  return (
    <>
      <Bloco titulo="Chip">
        <Linha>
          <Chip>Chá de gengibre</Chip>
          <ToggleChip>Sem lactose</ToggleChip>
          <ToggleChip defaultSelected>Para a noite</ToggleChip>
        </Linha>
      </Bloco>
      <Bloco titulo="TagList">
        <div className="grid gap-4 md:grid-cols-2">
          <TagList
            label="Tenho em casa"
            items={itens}
            onRemove={(ids) => setItens((atual) => atual.filter((i) => !ids.has(i.id)))}
          />
          <TagList label="Não gosto" items={[]} emptyText="Nada por aqui ainda." />
        </div>
      </Bloco>
      <Bloco titulo="Switch">
        <Linha>
          <Switch defaultSelected>Lembrar do chá da tarde</Switch>
          <Switch>Avisar quando esfriar</Switch>
          <Switch isDisabled>Sincronizar</Switch>
        </Linha>
      </Bloco>
      <Bloco titulo="Checkbox">
        <Linha>
          <Checkbox defaultSelected>Gengibre</Checkbox>
          <Checkbox>Canela</Checkbox>
          <Checkbox isDisabled>Cúrcuma</Checkbox>
          <Checkbox isInvalid>Aceito os termos</Checkbox>
        </Linha>
      </Bloco>
    </>
  )
}
