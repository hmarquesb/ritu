"use client"

import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/base/button"
import { TagList, ToggleChip } from "@/components/base/chip"
import { ComboBox, ComboBoxItem } from "@/components/base/combo-box"
import { TextField } from "@/components/base/text-field"

type Chave = string | number
type Item = { tipo: "grupo" | "alimento" | "texto"; valor: string; rotulo: string }
type Alimento = { id: string; nome: string }
type Envio = "pronto" | "nenhum" | "pulou"

const textos = config.textosEntrada.componentes

export type CorpoEvitar =
  | { passo: "pronto"; itens: { tipo: Item["tipo"]; valor: string }[] }
  | { passo: "nenhum" | "pulou" }

type Props = {
  /** Grava a escolha no destino e faz o que vem depois; lança se falhar. */
  gravar: (corpo: CorpoEvitar) => Promise<void>
  grupos: { id: string; nome: string }[]
  botoes: { pronto: string; nenhum: string; pular: string }
  maxItens: number
  maxTexto: number
  minBusca: number
  /** Omite "Nenhum" e "Pular", que só fazem sentido no onboarding. */
  semAlternativas?: boolean
}

const chave = (item: Pick<Item, "tipo" | "valor">) => `${item.tipo}:${item.valor}`

async function buscarAlimentos(termo: string, signal: AbortSignal): Promise<Alimento[]> {
  try {
    const resposta = await fetch(`/api/alimentos?q=${encodeURIComponent(termo)}`, { signal })
    if (resposta.status === 401) {
      window.location.href = "/"
      return []
    }
    if (!resposta.ok) return []
    return ((await resposta.json()) as { alimentos: Alimento[] }).alimentos
  } catch {
    return []
  }
}

export function EscolherEvitar({
  gravar,
  grupos,
  botoes,
  maxItens,
  maxTexto,
  minBusca,
  semAlternativas = false,
}: Props) {
  const [itens, setItens] = useState<Item[]>([])
  const [busca, setBusca] = useState("")
  const [achados, setAchados] = useState<Alimento[]>([])
  const [buscando, setBuscando] = useState(false)
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState<Envio | null>(null)
  const [erro, setErro] = useState(false)
  const pedido = useRef(0)

  const cheio = itens.length >= maxItens

  useEffect(() => {
    const termo = busca.trim()
    if (termo.length < minBusca) {
      setAchados([])
      setBuscando(false)
      return
    }
    const numero = ++pedido.current
    const controle = new AbortController()
    setBuscando(true)
    const espera = setTimeout(async () => {
      const dados = await buscarAlimentos(termo, controle.signal)
      if (numero !== pedido.current) return
      setAchados(dados)
      setBuscando(false)
    }, 200)
    return () => {
      clearTimeout(espera)
      controle.abort()
    }
  }, [busca, minBusca])

  function acrescentar(item: Item) {
    setItens((atuais) => {
      if (atuais.length >= maxItens) return atuais
      const k = chave(item)
      const repetido = atuais.some(
        (a) =>
          chave(a) === k ||
          (a.tipo === "texto" &&
            item.tipo === "texto" &&
            a.valor.toLowerCase() === item.valor.toLowerCase()),
      )
      return repetido ? atuais : [...atuais, item]
    })
  }

  function alternarGrupo(grupo: { id: string; nome: string }, ligado: boolean) {
    if (ligado) acrescentar({ tipo: "grupo", valor: grupo.id, rotulo: grupo.nome })
    else setItens((atuais) => atuais.filter((a) => chave(a) !== `grupo:${grupo.id}`))
  }

  function escolherAlimento(id: Chave | null) {
    const achado = achados.find((a) => a.id === id)
    if (achado) acrescentar({ tipo: "alimento", valor: achado.id, rotulo: achado.nome })
    setBusca("")
    setAchados([])
  }

  function adicionarTexto() {
    const valor = texto.trim()
    if (!valor) return
    acrescentar({ tipo: "texto", valor, rotulo: valor })
    setTexto("")
  }

  function tirar(ids: Set<Chave>) {
    setItens((atuais) => atuais.filter((a) => !ids.has(chave(a))))
  }

  async function enviar(passo: Envio) {
    if (enviando) return
    if (passo === "pronto" && itens.length === 0) return
    setEnviando(passo)
    setErro(false)
    const corpo: CorpoEvitar =
      passo === "pronto"
        ? { passo, itens: itens.map(({ tipo, valor }) => ({ tipo, valor })) }
        : { passo }
    try {
      await gravar(corpo)
    } catch {
      setErro(true)
      setEnviando(null)
    }
  }

  const selecionados = new Set(itens.map(chave))

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
        <legend className="sr-only">{textos.evitar.grupos}</legend>
        {grupos.map((grupo) => {
          const ligado = selecionados.has(`grupo:${grupo.id}`)
          return (
            <ToggleChip
              key={grupo.id}
              isSelected={ligado}
              isDisabled={cheio && !ligado}
              onChange={(valor) => alternarGrupo(grupo, valor)}
            >
              {grupo.nome}
            </ToggleChip>
          )
        })}
      </fieldset>

      <ComboBox<Alimento>
        label={textos.evitar.buscar}
        emptyText={
          busca.trim().length < minBusca
            ? formatar(textos.buscaMinima, { n: minBusca })
            : textos.evitar.nenhumAlimento
        }
        isLoading={buscando}
        items={achados}
        inputValue={busca}
        onInputChange={setBusca}
        selectedKey={null}
        onSelectionChange={escolherAlimento}
        isDisabled={cheio}
        menuTrigger="input"
      >
        {(alimento) => <ComboBoxItem id={alimento.id}>{alimento.nome}</ComboBoxItem>}
      </ComboBox>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          adicionarTexto()
        }}
      >
        <TextField
          label={textos.evitar.outro}
          value={texto}
          onChange={setTexto}
          maxLength={maxTexto}
          isDisabled={cheio}
          className="min-w-0 flex-1"
        />
        <Button type="submit" variant="secondary" isDisabled={cheio || texto.trim() === ""}>
          {textos.evitar.adicionar}
        </Button>
      </form>

      <TagList
        label={formatar(textos.evitar.escolhidos, { n: itens.length, max: maxItens })}
        items={itens.map((i) => ({ id: chave(i), label: i.rotulo }))}
        onRemove={tirar}
        emptyText={textos.evitar.nadaEscolhido}
      />

      {erro ? (
        <p role="alert" className="text-sm text-danger">
          {textos.erroSalvar}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          fullWidth
          aria-disabled={itens.length === 0 || undefined}
          className={itens.length === 0 ? "opacity-50" : undefined}
          isPending={enviando === "pronto"}
          isDisabled={enviando !== null && enviando !== "pronto"}
          onPress={() => enviar("pronto")}
        >
          {botoes.pronto}
        </Button>
        {semAlternativas ? null : (
          <div className="flex gap-3">
            <Button
              fullWidth
              isPending={enviando === "nenhum"}
              isDisabled={enviando !== null && enviando !== "nenhum"}
              onPress={() => enviar("nenhum")}
            >
              {botoes.nenhum}
            </Button>
            <Button
              variant="quiet"
              fullWidth
              isPending={enviando === "pulou"}
              isDisabled={enviando !== null && enviando !== "pulou"}
              onPress={() => enviar("pulou")}
            >
              {botoes.pular}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
