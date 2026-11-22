"use client"

import { config } from "@config/index"
import { useState } from "react"
import { Button } from "@/components/base/button"
import { Checkbox } from "@/components/base/checkbox"
import { Radio, RadioGroup } from "@/components/base/radio-group"
import type { VoceEmUso } from "./use-voce"

const T = config.textosVoce
const DOSHAS = ["vata", "pitta", "kapha"] as const
type Dosha = (typeof DOSHAS)[number]

const NOME: Record<Dosha, string> = T.dosha.nomes
const MISTO = "misto"

type Props = { em: VoceEmUso; fechar: () => void }

// Conteúdo da folha "Já sei meu dosha": um dosha ou "Misto" com exatamente dois.
export function FolhaDoDosha({ em, fechar }: Props) {
  const [escolha, setEscolha] = useState<string>("")
  const [dois, setDois] = useState<Dosha[]>([])

  const completa = escolha === MISTO ? dois.length === 2 : escolha !== ""
  const doshas = escolha === MISTO ? dois : escolha === "" ? [] : [escolha as Dosha]

  function alternar(dosha: Dosha, ligado: boolean) {
    setDois((atual) => (ligado ? [...atual, dosha] : atual.filter((d) => d !== dosha)))
  }

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        label={T.dosha.titulo}
        value={escolha}
        onChange={setEscolha}
        orientation="vertical"
      >
        {DOSHAS.map((dosha) => (
          <Radio key={dosha} value={dosha}>
            {NOME[dosha]}
          </Radio>
        ))}
        <Radio value={MISTO}>{T.dosha.misto}</Radio>
      </RadioGroup>
      {escolha === MISTO ? (
        <fieldset className="m-0 flex flex-col border-0 p-0">
          <legend className="text-sm text-ink-muted">{T.dosha.mistoAjuda}</legend>
          {DOSHAS.map((dosha) => (
            <Checkbox
              key={dosha}
              isSelected={dois.includes(dosha)}
              isDisabled={dois.length === 2 && !dois.includes(dosha)}
              onChange={(ligado) => alternar(dosha, ligado)}
            >
              {NOME[dosha]}
            </Checkbox>
          ))}
        </fieldset>
      ) : null}
      <div className="flex">
        <Button
          variant="primary"
          isDisabled={!completa}
          isPending={em.pendente === "dosha"}
          onPress={async () => {
            if (await em.perfil({ acao: "dosha", doshas })) fechar()
          }}
        >
          {T.dosha.salvar}
        </Button>
      </div>
    </div>
  )
}
