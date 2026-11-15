import { z } from "zod"

export const GUNAS = [
  "quente",
  "frio",
  "pesado",
  "leve",
  "oleoso",
  "seco",
  "estavel",
  "movel",
  "suave",
  "aspero",
  "intenso",
  "brando",
] as const
export type Guna = (typeof GUNAS)[number]
export const gunaSchema = z.enum(GUNAS)

export const OPOSTO: Record<Guna, Guna> = {
  quente: "frio",
  frio: "quente",
  pesado: "leve",
  leve: "pesado",
  oleoso: "seco",
  seco: "oleoso",
  estavel: "movel",
  movel: "estavel",
  suave: "aspero",
  aspero: "suave",
  intenso: "brando",
  brando: "intenso",
}

export const RASAS = ["doce", "azedo", "salgado", "picante", "amargo", "adstringente"] as const
export type Rasa = (typeof RASAS)[number]
export const rasaSchema = z.enum(RASAS)

export const VIRYAS = ["quente", "frio"] as const
export type Virya = (typeof VIRYAS)[number]
export const viryaSchema = z.enum(VIRYAS)

export const VIPAKAS = ["doce", "azedo", "picante"] as const
export type Vipaka = (typeof VIPAKAS)[number]
export const vipakaSchema = z.enum(VIPAKAS)

export const DOSHAS = ["vata", "pitta", "kapha"] as const
export type Dosha = (typeof DOSHAS)[number]
export const doshaSchema = z.enum(DOSHAS)

export const ESTADOS = [
  "com_frio",
  "com_calor",
  "pesada",
  "seca",
  "agitada",
  "irritada",
  "sem_energia",
] as const
export type Estado = (typeof ESTADOS)[number]
export const estadoSchema = z.enum(ESTADOS)

export const MOMENTOS_DO_DIA = ["manha", "almoco", "tarde", "jantar", "noite"] as const
export type MomentoDoDia = (typeof MOMENTOS_DO_DIA)[number]
export const momentoDoDiaSchema = z.enum(MOMENTOS_DO_DIA)

export const FUNCOES = [
  "base",
  "legume",
  "folha",
  "proteina",
  "gordura",
  "tempero",
  "liquido",
  "fruta",
  "adocante",
] as const
export type Funcao = (typeof FUNCOES)[number]
export const funcaoSchema = z.enum(FUNCOES)

export const GRUPOS = [
  "frutas",
  "folhas",
  "legumes",
  "raizes",
  "graos",
  "leguminosas",
  "laticinios",
  "ovos",
  "oleaginosas",
  "oleos",
  "especiarias",
  "adocantes",
  "bebidas",
] as const
export type Grupo = (typeof GRUPOS)[number]
export const grupoSchema = z.enum(GRUPOS)

export const DURABILIDADES = ["curta", "media", "longa"] as const
export type Durabilidade = (typeof DURABILIDADES)[number]
export const durabilidadeSchema = z.enum(DURABILIDADES)

export const RESTRICOES = ["vegetariana", "vegana", "sem_lactose", "sem_gluten"] as const
export type Restricao = (typeof RESTRICOES)[number]
export const restricaoSchema = z.enum(RESTRICOES)

export const GRUPOS_EVITAR = [
  "amendoim",
  "castanhas",
  "leite",
  "ovo",
  "soja",
  "trigo",
  "gergelim",
  "peixe",
  "frutos_do_mar",
] as const
export type GrupoEvitar = (typeof GRUPOS_EVITAR)[number]
export const grupoEvitarSchema = z.enum(GRUPOS_EVITAR)

export const MARCAS = ["fruta_azeda", "fruta_doce", "fermentado", "estimulante"] as const
export type Marca = (typeof MARCAS)[number]
export const marcaSchema = z.enum(MARCAS)

export const TIPOS_PRATICA = ["cha", "oleo", "pratica"] as const
export type TipoPratica = (typeof TIPOS_PRATICA)[number]
export const tipoPraticaSchema = z.enum(TIPOS_PRATICA)

export const CONFIANCAS = ["alta", "media", "baixa"] as const
export type Confianca = (typeof CONFIANCAS)[number]
export const confiancaSchema = z.enum(CONFIANCAS)

export const TEMAS_QUIZ = [
  "corpo",
  "pele",
  "apetite_digestao",
  "sono",
  "clima",
  "estresse",
  "ritmo_energia",
  "peso",
] as const
export type TemaQuiz = (typeof TEMAS_QUIZ)[number]
export const temaQuizSchema = z.enum(TEMAS_QUIZ)
