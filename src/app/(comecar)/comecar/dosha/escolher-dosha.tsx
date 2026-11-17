"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { enviarPasso } from "@/app/(comecar)/_lib/enviar-passo"
import { Button } from "@/components/base/button"
import { ToggleChip } from "@/components/base/chip"
import { ComboBox, ComboBoxItem } from "@/components/base/combo-box"
import { cx } from "@/components/cx"

type Dosha = "vata" | "pitta" | "kapha"
type Modo = "quiz" | "sei" | "adiar"
type Cidade = {
  nome: string
  regiao?: string
  pais: string
  lat: number
  lon: number
  fuso: string
}
type Item = Cidade & { id: string }

type Props = {
  opcoes: { quiz: string; sei: string; adiar: string }
  doshas: { id: Dosha; nome: string }[]
  cidade: { titulo: string; apoio: string }
}

const MINIMO_BUSCA = 2
const rotuloDe = (c: Cidade) => [c.nome, c.regiao, c.pais].filter(Boolean).join(", ")
const idDe = (c: Cidade) => `${c.lat},${c.lon}`

type Resultado = { itens: Item[]; indisponivel: boolean }

async function buscarCidades(termo: string, signal: AbortSignal): Promise<Resultado> {
  try {
    const resposta = await fetch(`/api/cidades?q=${encodeURIComponent(termo)}`, { signal })
    if (resposta.status === 401) {
      window.location.href = "/"
      return { itens: [], indisponivel: false }
    }
    if (!resposta.ok) return { itens: [], indisponivel: true }
    const { cidades } = (await resposta.json()) as { cidades: Cidade[] }
    return { itens: cidades.map((c) => ({ ...c, id: idDe(c) })), indisponivel: false }
  } catch {
    return { itens: [], indisponivel: !signal.aborted }
  }
}

function Opcao(props: {
  name: string
  value: string
  checked: boolean
  onSelect: () => void
  children: string
}) {
  return (
    <label className="relative block">
      <input
        type="radio"
        name={props.name}
        value={props.value}
        checked={props.checked}
        onChange={props.onSelect}
        className="peer sr-only"
      />
      <span
        className={cx(
          "flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 py-2.5 font-body text-body text-ink transition-colors duration-[var(--ritu-fast)] ease-ritu",
          "hover:bg-sunken peer-checked:border-primary peer-checked:bg-primary-soft peer-checked:font-semibold",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
        )}
      >
        {props.children}
      </span>
    </label>
  )
}

function useBuscaDeCidade() {
  const [busca, setBusca] = useState("")
  const [achadas, setAchadas] = useState<Item[]>([])
  const [buscando, setBuscando] = useState(false)
  const [indisponivel, setIndisponivel] = useState(false)
  const [escolhida, setEscolhida] = useState<Item | null>(null)
  const pedido = useRef(0)

  useEffect(() => {
    const termo = busca.trim()
    if (escolhida || termo.length < MINIMO_BUSCA) {
      setAchadas([])
      setBuscando(false)
      return
    }
    const numero = ++pedido.current
    const controle = new AbortController()
    setBuscando(true)
    const espera = setTimeout(async () => {
      const r = await buscarCidades(termo, controle.signal)
      if (numero !== pedido.current) return
      setAchadas(r.itens)
      setIndisponivel(r.indisponivel)
      setBuscando(false)
    }, 250)
    return () => {
      clearTimeout(espera)
      controle.abort()
    }
  }, [busca, escolhida])

  function digitar(valor: string) {
    setBusca(valor)
    if (escolhida && valor !== rotuloDe(escolhida)) setEscolhida(null)
  }
  function escolher(id: string | number | null) {
    const achada = achadas.find((c) => c.id === id)
    if (!achada) return
    setEscolhida(achada)
    setBusca(rotuloDe(achada))
  }
  function limpar() {
    setEscolhida(null)
    setBusca("")
    setAchadas([])
  }
  return { busca, achadas, buscando, indisponivel, escolhida, digitar, escolher, limpar }
}

export function EscolherDosha({ opcoes, doshas, cidade }: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<Modo | null>(null)
  const [escolha, setEscolha] = useState<Dosha | "misto" | null>(null)
  const [mistos, setMistos] = useState<Dosha[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(false)
  const c = useBuscaDeCidade()

  const doshaPronto =
    modo === "quiz" ||
    modo === "adiar" ||
    (modo === "sei" &&
      ((escolha !== null && escolha !== "misto") || (escolha === "misto" && mistos.length === 2)))

  function alternarMisto(id: Dosha, ligado: boolean) {
    setMistos((atuais) => {
      if (!ligado) return atuais.filter((d) => d !== id)
      return atuais.length >= 2 || atuais.includes(id) ? atuais : [...atuais, id]
    })
  }

  function valorDoDosha(): "quiz" | "adiado" | Dosha[] {
    if (modo === "quiz") return "quiz"
    if (modo === "adiar") return "adiado"
    return escolha === "misto" ? mistos : escolha ? [escolha] : "adiado"
  }

  async function continuar() {
    if (enviando || !doshaPronto) return
    setEnviando(true)
    setErro(false)
    const { escolhida } = c
    const corpo = {
      dosha: valorDoDosha(),
      cidade: escolhida
        ? { nome: escolhida.nome, lat: escolhida.lat, lon: escolhida.lon, fuso: escolhida.fuso }
        : null,
    }
    try {
      const proximo = await enviarPasso("/api/onboarding/perfil", corpo)
      if (proximo) router.push(proximo)
      else setEnviando(false)
    } catch {
      setErro(true)
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="sr-only">Seu dosha</legend>
        <Opcao name="dosha" value="quiz" checked={modo === "quiz"} onSelect={() => setModo("quiz")}>
          {opcoes.quiz}
        </Opcao>
        <Opcao name="dosha" value="sei" checked={modo === "sei"} onSelect={() => setModo("sei")}>
          {opcoes.sei}
        </Opcao>
        {modo === "sei" ? (
          <div className="flex flex-col gap-3 rounded-lg bg-sunken p-4">
            <div role="radiogroup" aria-label="Qual é o seu dosha" className="flex flex-col gap-2">
              {doshas.map((d) => (
                <Opcao
                  key={d.id}
                  name="qual-dosha"
                  value={d.id}
                  checked={escolha === d.id}
                  onSelect={() => setEscolha(d.id)}
                >
                  {d.nome}
                </Opcao>
              ))}
              <Opcao
                name="qual-dosha"
                value="misto"
                checked={escolha === "misto"}
                onSelect={() => setEscolha("misto")}
              >
                Misto
              </Opcao>
            </div>
            {escolha === "misto" ? (
              <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
                <legend className="mb-2 text-sm text-ink-muted">Escolha dois dos três.</legend>
                <div className="flex flex-wrap gap-2">
                  {doshas.map((d) => {
                    const ligado = mistos.includes(d.id)
                    return (
                      <ToggleChip
                        key={d.id}
                        isSelected={ligado}
                        isDisabled={mistos.length >= 2 && !ligado}
                        onChange={(v) => alternarMisto(d.id, v)}
                      >
                        {d.nome}
                      </ToggleChip>
                    )
                  })}
                </div>
              </fieldset>
            ) : null}
          </div>
        ) : null}
        <Opcao
          name="dosha"
          value="adiar"
          checked={modo === "adiar"}
          onSelect={() => setModo("adiar")}
        >
          {opcoes.adiar}
        </Opcao>
      </fieldset>

      <section className="flex flex-col gap-4" aria-labelledby="cidade-titulo">
        <div className="flex flex-col gap-2">
          <h2 id="cidade-titulo" className="font-title text-title-sm text-ink">
            {cidade.titulo}
          </h2>
          <p className="text-prose text-ink-muted">{cidade.apoio}</p>
        </div>
        <ComboBox<Item>
          label="Buscar cidade"
          emptyText={
            c.busca.trim().length < MINIMO_BUSCA
              ? `Digite ${MINIMO_BUSCA} letras ou mais`
              : "Nenhuma cidade encontrada"
          }
          isLoading={c.buscando}
          items={c.achadas}
          inputValue={c.busca}
          onInputChange={c.digitar}
          selectedKey={c.escolhida?.id ?? null}
          onSelectionChange={c.escolher}
          menuTrigger="input"
        >
          {(item) => <ComboBoxItem id={item.id}>{rotuloDe(item)}</ComboBoxItem>}
        </ComboBox>
        {c.indisponivel && !c.escolhida ? (
          <p role="status" className="text-sm text-ink-muted">
            Não consegui buscar a cidade agora. Você pode seguir sem ela.
          </p>
        ) : null}
        <div>
          <Button variant="quiet" size="sm" onPress={c.limpar}>
            Pular a cidade
          </Button>
        </div>
      </section>

      {erro ? (
        <p role="alert" className="text-sm text-danger">
          Não consegui salvar agora. Suas escolhas continuam aqui; toque de novo para tentar.
        </p>
      ) : null}

      <Button
        variant="primary"
        fullWidth
        isPending={enviando}
        aria-disabled={!doshaPronto || undefined}
        className={doshaPronto ? undefined : "opacity-50"}
        onPress={continuar}
      >
        Continuar
      </Button>
    </div>
  )
}
