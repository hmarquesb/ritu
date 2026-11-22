import { config } from "@config/index"
import { formatar } from "@config/textos-conversa"
import type { Alimento, EstadoInfo, Pratica } from "./schemas"
import {
  ESTADOS,
  type Estado,
  type Guna,
  type Marca,
  MOMENTOS_DO_DIA,
  type MomentoDoDia,
} from "./vocab"

export const PREFIXO_CHA = "cha-"
const MOMENTOS_DO_ESTIMULANTE: MomentoDoDia[] = ["manha", "tarde"]

export function idDoChaDerivado(erva: Alimento): string {
  return erva.id.startsWith(PREFIXO_CHA) ? erva.id : `${PREFIXO_CHA}${erva.id}`
}

function nomeDoCha(nome: string): string {
  return nome.startsWith("Chá") ? nome : `Chá de ${nome.toLowerCase()}`
}

const MODELO_POR_PARTE: Record<string, string> = {
  folha: config.textosChas.infusao,
  flor: config.textosChas.infusao,
  semente: config.textosChas.fervura,
  casca: config.textosChas.fervura,
  raiz: config.textosChas.fervura,
  bebida: config.textosChas.bebida,
}

function preparoDoCha(erva: Alimento): string {
  const modelo = MODELO_POR_PARTE[erva.cha?.parte ?? "bebida"] ?? config.textosChas.bebida
  return formatar(modelo, { erva: erva.nome.toLowerCase() })
}

function contraindicacoesDoCha(erva: Alimento): Estado[] {
  if (erva.virya === "quente") return ["com_calor"]
  if (erva.virya === "frio") return ["com_frio"]
  return []
}

function temAlgumaGuna(gunas: readonly Guna[], lista: readonly Guna[]): boolean {
  return lista.some((guna) => gunas.includes(guna))
}

function temAlgumaMarca(marcas: readonly Marca[], lista: readonly Marca[]): boolean {
  return lista.some((marca) => marcas.includes(marca))
}

function estadosFavorecidos(
  erva: Alimento,
  estados: readonly EstadoInfo[],
  contraindicacoes: Estado[],
): Estado[] {
  return ESTADOS.filter((id) => {
    const estado = estados.find((info) => info.id === id)
    return (
      estado !== undefined &&
      !contraindicacoes.includes(id) &&
      temAlgumaGuna(erva.gunas, estado.favorecer) &&
      !temAlgumaGuna(erva.gunas, estado.evitar_gunas) &&
      !temAlgumaMarca(erva.marcas, estado.evitar_marcas)
    )
  })
}

function momentosDoCha(erva: Alimento): MomentoDoDia[] {
  return erva.marcas.includes("estimulante") ? MOMENTOS_DO_ESTIMULANTE : [...MOMENTOS_DO_DIA]
}

function chaDe(erva: Alimento, estados: readonly EstadoInfo[]): Pratica {
  const contraindicacoes = contraindicacoesDoCha(erva)
  return {
    id: idDoChaDerivado(erva),
    tipo: "cha",
    nome: nomeDoCha(erva.nome),
    ingredientes: [erva.id],
    preparo: preparoDoCha(erva),
    gunas: erva.gunas,
    favorece_estados: estadosFavorecidos(erva, estados, contraindicacoes),
    efeito: erva.efeito,
    momento: momentosDoCha(erva),
    contraindicacoes,
    nunca_sugerir_se: erva.restricoes,
    aviso: erva.cha?.aviso ?? "",
    fontes: [
      ...erva.fontes,
      {
        ref: "ritu-regras-da-base",
        campos: ["gunas", "efeito", "favorece_estados", "contraindicacoes", "momento"],
      },
    ],
    confianca: erva.confianca,
  }
}

// Um chá por alimento com `cha`, na ordem de `alimentos`. Pura: sem I/O.
export function derivarChas(
  alimentos: readonly Alimento[],
  estados: readonly EstadoInfo[],
): Pratica[] {
  return alimentos.filter((erva) => erva.cha !== undefined).map((erva) => chaDe(erva, estados))
}
