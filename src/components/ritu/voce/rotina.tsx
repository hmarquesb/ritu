"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { PencilSimple, Trash } from "@phosphor-icons/react"
import { useState } from "react"
import { Button } from "@/components/base/button"
import { Sheet } from "@/components/base/dialog"
import { TextField } from "@/components/base/text-field"
import type { MemoriaNaTela } from "@/core/memory/visao"
import { dataCurta, ItemDeMemoria, ListaDeMemoria } from "./item-memoria"
import { focarNivel, NivelDaMemoria } from "./nivel"
import { chaveDoToque, type VoceEmUso } from "./use-voce"

const T = config.textosVoce
const MAXIMO = config.conversa.maxFatoDeRotina

type Nota = MemoriaNaTela["rotina"]["notas"][number]

function FolhaDeCorrigir({ nota, em, fechar }: { nota: Nota; em: VoceEmUso; fechar: () => void }) {
  const [texto, setTexto] = useState(nota.texto)
  const limpo = texto.trim()
  const acao = { acao: "nota_corrigir", nota_id: nota.id, texto: limpo } as const
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (limpo === "") return
        if (await em.memoria(acao)) fechar()
      }}
    >
      <TextField
        label={T.rotina.campo}
        value={texto}
        onChange={setTexto}
        maxLength={MAXIMO}
        multiline
        description={`${texto.length}/${MAXIMO}`}
      />
      <Button
        type="submit"
        variant="primary"
        isDisabled={limpo === ""}
        isPending={em.pendente === chaveDoToque(acao)}
      >
        {T.rotina.salvar}
      </Button>
    </form>
  )
}

type Props = { rotina: MemoriaNaTela["rotina"]; em: VoceEmUso }

export function RotinaNaMemoria({ rotina, em }: Props) {
  const [corrigindo, setCorrigindo] = useState<Nota | null>(null)
  const vazia = rotina.resumo === null && rotina.notas.length === 0
  return (
    <NivelDaMemoria
      id="rotina"
      titulo={T.nivel.rotina.titulo}
      como={T.nivel.rotina.como}
      vazio={vazia ? T.nivel.rotina.vazio : null}
    >
      {rotina.resumo !== null ? (
        <div className="mb-3 flex flex-col gap-1">
          <p className="text-sm text-ink-muted">{T.rotina.resumo}</p>
          <p className="max-w-prose text-prose text-ink">{rotina.resumo}</p>
        </div>
      ) : null}
      <ListaDeMemoria>
        {rotina.notas.map((nota) => {
          const apagar = { acao: "nota_apagar", nota_id: nota.id } as const
          return (
            <ItemDeMemoria
              key={nota.id}
              principal={nota.texto}
              complemento={formatar(T.rotina.data, {
                data: dataCurta(nota.criado_em, em.voce.fuso),
              })}
              acoes={
                <>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon={PencilSimple}
                    aria-label={formatar(T.rotina.corrigirNota, { nome: nota.texto })}
                    onPress={() => setCorrigindo(nota)}
                  >
                    {T.rotina.corrigir}
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    icon={Trash}
                    aria-label={formatar(T.rotina.apagarNota, { nome: nota.texto })}
                    isPending={em.pendente === chaveDoToque(apagar)}
                    onPress={async () => {
                      if (await em.memoria(apagar)) focarNivel("rotina")
                    }}
                  >
                    {T.apagar}
                  </Button>
                </>
              }
            />
          )
        })}
      </ListaDeMemoria>
      <Sheet
        title={T.rotina.corrigir}
        isOpen={corrigindo !== null}
        onOpenChange={(aberto) => {
          if (!aberto) setCorrigindo(null)
        }}
      >
        {corrigindo ? (
          <FolhaDeCorrigir nota={corrigindo} em={em} fechar={() => setCorrigindo(null)} />
        ) : null}
      </Sheet>
    </NivelDaMemoria>
  )
}
