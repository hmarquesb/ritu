"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { useState } from "react"
import { Button } from "@/components/base/button"
import { TagList, ToggleChip } from "@/components/base/chip"
import { ComboBox, ComboBoxItem } from "@/components/base/combo-box"
import { Sheet } from "@/components/base/dialog"
import { TextField } from "@/components/base/text-field"
import type { Restricao } from "@/core/knowledge/vocab"
import type { MemoriaNaTela } from "@/core/memory/visao"
import { type Alimento, useBuscaDeAlimento } from "../alimento/use-busca-de-alimento"
import { BuscaDeCidade } from "../cidade/busca-de-cidade"
import type { Cidade } from "../cidade/use-busca-de-cidade"
import { EscolherEvitar } from "../evitar/escolher-evitar"
import { Confirmacao, ItemDeMemoria, ListaDeMemoria } from "./item-memoria"
import { focarNivel, NivelDaMemoria } from "./nivel"
import type { VoceEmUso } from "./use-voce"

const T = config.textosVoce
const E = config.textosEntrada.componentes
const LIMITES = config.limites

const RESTRICOES: Restricao[] = ["vegetariana", "vegana", "sem_lactose", "sem_gluten"]

type Fixos = MemoriaNaTela["fixos"]
type ItemFixo = Fixos["evitar"][number]

const chaveDoItem = (i: ItemFixo) => `${i.tipo}:${i.valor}`

function origemDoDosha(dosha: NonNullable<Fixos["dosha"]>): string {
  return dosha.origem === "quiz" ? T.fixos.origemQuiz : T.fixos.origemDeclarado
}

function FolhaDaCidade({
  em,
  fechar,
  temCidade,
}: {
  em: VoceEmUso
  fechar: () => void
  temCidade: boolean
}) {
  const [escolhida, setEscolhida] = useState<Cidade | null>(null)
  async function gravar(cidade: Cidade | null) {
    if (await em.perfil({ acao: "cidade", cidade })) fechar()
  }
  return (
    <div className="flex flex-col gap-4">
      <BuscaDeCidade aoMudar={setEscolhida} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          isDisabled={escolhida === null}
          isPending={em.pendente === "cidade"}
          onPress={() => gravar(escolhida)}
        >
          {T.dosha.salvar}
        </Button>
        {temCidade ? (
          <Button variant="quiet" onPress={() => gravar(null)}>
            {T.fixos.tirarCidade}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

type FolhaEvitarProps = {
  em: VoceEmUso
  grupos: { id: string; nome: string }[]
  fechar: () => void
}

function FolhaDeEvitar({ em, grupos, fechar }: FolhaEvitarProps) {
  return (
    <EscolherEvitar
      semAlternativas
      grupos={grupos}
      botoes={{ pronto: T.dosha.salvar, nenhum: T.manter, pular: T.manter }}
      maxItens={LIMITES.evitar.maxItens}
      maxTexto={LIMITES.evitar.textoLivreCaracteres}
      minBusca={LIMITES.buscaDeAlimento.minimoCaracteres}
      gravar={async (corpo) => {
        if (corpo.passo !== "pronto") return fechar()
        const nova = await em.perfil({ acao: "evitar_acrescentar", itens: corpo.itens })
        if (!nova) throw new Error("nao_gravou")
        fechar()
      }}
    />
  )
}

function FolhaDeNaoCome({ em, fechar }: { em: VoceEmUso; fechar: () => void }) {
  const minimo = LIMITES.buscaDeAlimento.minimoCaracteres
  const { busca, setBusca, achados, buscando } = useBuscaDeAlimento(minimo)
  const [texto, setTexto] = useState("")

  async function gravar(corpo: { alimento_id: string } | { texto: string }) {
    if (await em.perfil({ acao: "nao_come_acrescentar", ...corpo })) fechar()
  }

  return (
    <div className="flex flex-col gap-5">
      <ComboBox<Alimento>
        label={E.evitar.buscar}
        emptyText={
          busca.trim().length < minimo
            ? formatar(E.buscaMinima, { n: minimo })
            : E.evitar.nenhumAlimento
        }
        isLoading={buscando}
        items={achados}
        inputValue={busca}
        onInputChange={setBusca}
        selectedKey={null}
        onSelectionChange={(id) => {
          const achado = achados.find((a) => a.id === id)
          if (achado) void gravar({ alimento_id: achado.id })
        }}
        menuTrigger="input"
      >
        {(alimento) => <ComboBoxItem id={alimento.id}>{alimento.nome}</ComboBoxItem>}
      </ComboBox>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const valor = texto.trim()
          if (valor.length >= 2) void gravar({ texto: valor })
        }}
      >
        <TextField
          label={E.evitar.outro}
          value={texto}
          onChange={setTexto}
          maxLength={LIMITES.evitar.textoLivreCaracteres}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary" isDisabled={texto.trim().length < 2}>
          {E.evitar.adicionar}
        </Button>
      </form>
    </div>
  )
}

type Props = {
  fixos: Fixos
  em: VoceEmUso
  /** Grupos de `grupos_evitar.yaml`, para a folha de "Evitar sempre". */
  grupos: { id: string; nome: string }[]
  /** Abre a folha "Já sei meu dosha" (a mesma da carta). */
  aoMudarDosha: () => void
}

type Aberta = "cidade" | "evitar" | "nao_come" | null

export function Fixos({ fixos, em, grupos, aoMudarDosha }: Props) {
  const [aberta, setAberta] = useState<Aberta>(null)
  const [tirando, setTirando] = useState<ItemFixo | null>(null)
  const fechar = () => setAberta(null)
  const marcadas = new Set(fixos.restricoes)

  async function alternar(id: Restricao, ligada: boolean) {
    const novas = RESTRICOES.filter((r) => (r === id ? ligada : marcadas.has(r)))
    const rotulos = novas.map((r) => T.fixos.restricao[r])
    await em.perfil(
      { acao: "restricoes", restricoes: novas },
      formatar(T.confirma.anotei, { item: rotulos.join(", ") || T.fixos.nenhum }),
    )
  }

  const itens = (lista: ItemFixo[]) => lista.map((i) => ({ id: chaveDoItem(i), label: i.nome }))
  const achar = (lista: ItemFixo[], ids: Set<unknown>) => lista.find((i) => ids.has(chaveDoItem(i)))

  return (
    <NivelDaMemoria id="fixos" titulo={T.nivel.fixos.titulo} como={T.nivel.fixos.como} vazio={null}>
      <ListaDeMemoria>
        <ItemDeMemoria
          rotulo={T.fixos.dosha}
          principal={
            fixos.dosha ? `${fixos.dosha.nome} · ${origemDoDosha(fixos.dosha)}` : T.fixos.semDosha
          }
          acoes={
            <Button variant="quiet" size="sm" onPress={aoMudarDosha}>
              {T.fixos.mudar}
            </Button>
          }
        />
        <ItemDeMemoria
          rotulo={T.fixos.cidade}
          principal={fixos.cidade ?? T.fixos.semCidade}
          acoes={
            <Button variant="quiet" size="sm" onPress={() => setAberta("cidade")}>
              {T.fixos.mudar}
            </Button>
          }
        />
        <ItemDeMemoria
          principal={
            <TagList
              label={T.fixos.evitar}
              items={itens(fixos.evitar)}
              emptyText={T.fixos.nenhum}
              onRemove={(ids) => setTirando(achar(fixos.evitar, ids) ?? null)}
            />
          }
          acoes={
            <Button variant="secondary" size="sm" onPress={() => setAberta("evitar")}>
              {T.fixos.adicionar}
            </Button>
          }
        />
        <ItemDeMemoria
          principal={
            <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
              <legend className="mb-2 p-0 text-sm font-medium text-ink">
                {T.fixos.restricoes}
              </legend>
              <div className="flex flex-wrap gap-2">
                {RESTRICOES.map((r) => (
                  <ToggleChip
                    key={r}
                    isSelected={marcadas.has(r)}
                    onChange={(ligada) => alternar(r, ligada)}
                  >
                    {T.fixos.restricao[r]}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>
          }
        />
        <ItemDeMemoria
          principal={
            <TagList
              label={T.fixos.naoCome}
              items={itens(fixos.nao_come)}
              emptyText={T.fixos.nenhum}
              onRemove={async (ids) => {
                const item = achar(fixos.nao_come, ids)
                if (!item || item.tipo === "grupo") return
                const nova = await em.perfil({
                  acao: "nao_come_tirar",
                  item: { tipo: item.tipo, valor: item.valor },
                })
                if (nova) focarNivel("fixos")
              }}
            />
          }
          acoes={
            <Button variant="secondary" size="sm" onPress={() => setAberta("nao_come")}>
              {T.fixos.adicionar}
            </Button>
          }
        />
      </ListaDeMemoria>

      <Sheet
        title={T.fixos.cidade}
        isOpen={aberta === "cidade"}
        onOpenChange={(o) => !o && fechar()}
      >
        <FolhaDaCidade em={em} fechar={fechar} temCidade={fixos.cidade !== null} />
      </Sheet>
      <Sheet
        title={T.fixos.evitar}
        isOpen={aberta === "evitar"}
        onOpenChange={(o) => !o && fechar()}
      >
        <FolhaDeEvitar em={em} grupos={grupos} fechar={fechar} />
      </Sheet>
      <Sheet
        title={T.fixos.naoCome}
        isOpen={aberta === "nao_come"}
        onOpenChange={(o) => !o && fechar()}
      >
        <FolhaDeNaoCome em={em} fechar={fechar} />
      </Sheet>
      <Confirmacao
        titulo={formatar(T.evitar.confirmaTitulo, { item: tirando?.nome ?? "" })}
        texto={T.evitar.confirmaTexto}
        confirmar={T.evitar.tirar}
        aberto={tirando !== null}
        aoFechar={() => setTirando(null)}
        aoConfirmar={async () => {
          if (!tirando) return false
          const nova = await em.perfil({
            acao: "evitar_tirar",
            item: { tipo: tirando.tipo, valor: tirando.valor },
            confirmado: true,
          })
          if (nova) focarNivel("fixos")
          return nova !== undefined
        }}
      />
    </NivelDaMemoria>
  )
}
