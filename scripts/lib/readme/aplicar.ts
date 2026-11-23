// Troca o conteúdo dos blocos gerados do README, entre os marcadores `<!-- ritu:<bloco> -->` (spec 024).
import { RituError } from "@/core/errors"
import type { Blocos } from "./blocos"

const NOMES = ["site", "numeros", "adrs"] as const satisfies readonly (keyof Blocos)[]

export class MarcadorDoReadmeError extends RituError {
  readonly bloco: string

  constructor(bloco: string) {
    super("readme_sem_marcador", `Marcador do bloco "${bloco}" ausente ou repetido no README`)
    this.name = "MarcadorDoReadmeError"
    this.bloco = bloco
  }
}

function aplicarBloco(readme: string, bloco: string, conteudo: string): string {
  const abre = `<!-- ritu:${bloco} -->`
  const fecha = `<!-- /ritu:${bloco} -->`
  const unico = (marca: string) => readme.split(marca).length === 2
  if (!unico(abre) || !unico(fecha)) throw new MarcadorDoReadmeError(bloco)
  const trecho = new RegExp(`${escaparRegex(abre)}[\\s\\S]*?${escaparRegex(fecha)}`)
  // Função no replace: o conteúdo não tem padrões especiais do replace ($&, $1).
  return readme.replace(trecho, () => `${abre}\n${conteudo}\n${fecha}`)
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
}

export function aplicarBlocos(readme: string, blocos: Blocos): string {
  return NOMES.reduce((texto, bloco) => aplicarBloco(texto, bloco, blocos[bloco]), readme)
}
