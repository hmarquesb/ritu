import { describe, expect, it } from "vitest"
import { casosDoCheckpoint } from "../../../evals/llm/casos"
import { casosC1 } from "../../../evals/llm/casos/c1"
import { casosC2 } from "../../../evals/llm/casos/c2"
import { casosC3 } from "../../../evals/llm/casos/c3"

type Linha = { nome: string; ids: string[]; familias: string[]; marcas?: string[] }

// Tabela de famílias e marcas da spec 014 (T3), linha por linha.
const LINHAS: Linha[] = [
  {
    nome: "c1 comum",
    ids: [
      "c1-01-frio-agitada",
      "c1-02-calor-irritada",
      "c1-03-pesada-depois-do-almoco",
      "c1-04-sem-energia-sem-dosha",
      "c1-07-pitaya-fora-da-base",
      "c1-09-evitar-leite",
      "c1-10-calor-e-pesada",
      "c1-11-sem-cidade",
    ],
    familias: ["conteudo", "fidelidade", "explicacao"],
  },
  {
    nome: "c1 pergunta simples",
    ids: ["c1-05-pergunta-manga", "c1-06-pergunta-gengibre"],
    familias: ["conteudo", "fidelidade", "explicacao", "conversa"],
    marcas: ["pergunta_simples"],
  },
  {
    nome: "c1 casa",
    ids: ["c1-08-casa-so-incertos"],
    familias: ["conteudo", "fidelidade", "explicacao", "casa"],
  },
  {
    nome: "c1 promessa",
    ids: ["c1-12-estomago-pesado"],
    familias: ["conteudo", "fidelidade", "explicacao", "incomodos"],
    marcas: ["promessa"],
  },
  {
    nome: "intenção",
    ids: [
      "c2-01-frio-sem-fome",
      "c2-02-manga-pergunta-pitta",
      "c2-03-almoco-fora-na-semana",
      "c2-04-feira-abobora-couve",
      "c2-05-acabou-arroz",
      "c2-06-abobora-o-que-faco",
      "c2-07-cha-ajudou",
      "c2-08-ontem-otimo",
      "c2-09-cha-nao-adiantou",
      "c2-10-alergia-camarao",
      "c2-11-dor-de-cabeca-almoco",
      "c2-18-apagar-dados",
      "c2-19-vegetariana",
      "c2-20-nao-como-coentro",
    ],
    familias: ["intencao"],
  },
  {
    nome: "intenção com alerta devido",
    ids: ["c2-12-dor-forte-no-peito", "c2-13-queria-sumir"],
    familias: ["intencao", "linguagem"],
    marcas: ["alerta_devido"],
  },
  {
    nome: "intenção com falso alerta",
    ids: ["c2-14-dia-pesado-pra-baixo", "c2-15-cansaco-sem-energia"],
    familias: ["intencao", "linguagem"],
    marcas: ["falso_alerta"],
  },
  {
    nome: "intenção com linguagem",
    ids: ["c2-16-voce-e-inutil"],
    familias: ["intencao", "linguagem"],
  },
  {
    nome: "intenção com injection",
    ids: ["c2-17-prompt-suspeito"],
    familias: ["intencao", "seguranca"],
    marcas: ["injection"],
  },
  {
    nome: "perguntas necessárias com casa",
    ids: ["c2-p01-frio-so-incertos", "c2-p03-almoco-casa-vazia"],
    familias: ["perguntas", "casa"],
    marcas: ["pergunta_necessaria"],
  },
  {
    nome: "perguntas desnecessárias",
    ids: [
      "c2-p02-frio-casa-confirmada",
      "c2-p04-manga-pergunta-pitta",
      "c2-p07-frio-evitar-sempre",
    ],
    familias: ["perguntas"],
    marcas: ["pergunta_desnecessaria"],
  },
  {
    nome: "perguntas com casa",
    ids: ["c2-p05-frio-nao-tenho-a-tudo", "c2-p06-frio-nao-gosto-a-um"],
    familias: ["perguntas", "casa"],
  },
  {
    nome: "perguntas com promessa",
    ids: ["c2-p08-dor-de-cabeca-latejante"],
    familias: ["perguntas", "incomodos"],
    marcas: ["promessa"],
  },
  {
    nome: "propostas",
    ids: [
      "c2-m01-almoco-fora-propoe",
      "c2-m02-dia-corrido-nenhuma",
      "c2-m03-nao-tenho-um-item",
      "c2-m04-item-ausente-sem-pergunta",
      "c2-m05-vegetariana-sem-barrado",
      "c2-m06-almoco-fora-nao-diz-que-anotou",
    ],
    familias: ["propostas"],
  },
  {
    nome: "aprendizado",
    ids: [
      "c2-a01-cha-nao-ajudou-duas-vezes",
      "c2-a02-nao-gosto-nao-aparece",
      "c2-a03-gosto-aparece",
      "c2-a04-retorno-de-ontem-fechado",
      "c2-a05-melhorei-sem-pista-como-ficou",
    ],
    familias: ["aprendizado"],
  },
  {
    nome: "para ter em casa",
    ids: ["c2-t06-para-ter-com-faltas", "c2-t07-sem-candidato", "c2-t08-incomodo-sem-para-ter"],
    familias: ["para_ter"],
  },
  {
    nome: "memória",
    ids: [
      "c3-01-almoco-fora-antigo-casa-recente",
      "c3-02-acorda-cedo-palavras-diferentes",
      "c3-03-trinta-notas-teto",
      "c3-04-instrucao-escondida-na-nota",
      "c3-05-duas-notas-juiz",
      "c3-06-almoco-fora-sem-cozinhar",
      "c3-07-cha-com-padrao",
      "c3-08-cha-fora-dos-candidatos",
    ],
    familias: ["memoria"],
  },
  {
    nome: "juiz com falsa reprovação",
    ids: [
      "c3-j01-resposta-boa-de-momento",
      "c3-j03-pode-aliviar-o-peso",
      "c3-j05-colher-de-cha-de-gengibre",
      "c3-j10-isso-acalma-vata",
    ],
    familias: ["juiz"],
    marcas: ["falsa_reprovacao"],
  },
  {
    nome: "juiz",
    ids: [
      "c3-j02-cha-resolve-a-dor",
      "c3-j04-capsulas-de-ashwagandha",
      "c3-j06-texto-recomenda-sopa",
      "c3-j07-refresca-com-linha-que-aquece",
      "c3-j08-cardamomo-resolve-o-frio",
      "c3-j09-voce-deveria-se-cuidar",
      "c3-j11-amendoim-torrado",
      "c3-j12-remedio-para-pressao",
    ],
    familias: ["juiz"],
  },
  {
    nome: "juiz com injection",
    ids: ["c3-j13-ordem-escondida-no-texto"],
    familias: ["juiz", "seguranca"],
    marcas: ["injection"],
  },
  {
    nome: "segurança com injection",
    ids: ["c3-s14-poema-fora-do-papel", "c3-s15-jejum-na-rotina"],
    familias: ["seguranca"],
    marcas: ["injection"],
  },
  {
    nome: "segurança",
    ids: ["c3-s16-dose-de-curcuma"],
    familias: ["seguranca"],
  },
  {
    nome: "segurança com promessa",
    ids: ["c3-s17-cha-cura-gastrite"],
    familias: ["seguranca", "incomodos"],
    marcas: ["promessa"],
  },
  {
    nome: "conversa de segurança",
    ids: ["c3-s18-chefe-humilhou"],
    familias: ["conversa"],
  },
  {
    nome: "linguagem com alerta devido",
    ids: ["c3-s19-sem-vontade-de-nada"],
    familias: ["linguagem"],
    marcas: ["alerta_devido"],
  },
  {
    nome: "linguagem com falso alerta",
    ids: ["c3-s20-dia-pesado-com-frio"],
    familias: ["linguagem"],
    marcas: ["falso_alerta"],
  },
  {
    nome: "linguagem",
    ids: ["c3-s21-que-dia-de-merda"],
    familias: ["linguagem"],
  },
  {
    nome: "incômodos com promessa",
    ids: ["c3-s22-dor-de-cabeca-no-almoco"],
    familias: ["incomodos"],
    marcas: ["promessa"],
  },
]

const porId = new Map(casosDoCheckpoint("c3-confiavel").map((caso) => [caso.id, caso]))

function ordenados(ids: string[]): string[] {
  return [...ids].sort((a, b) => a.localeCompare(b))
}

describe("índice dos casos por checkpoint", () => {
  it("tem 12 casos no c1-base, 54 no c2-conversa e 84 no c3-confiavel", () => {
    expect(casosDoCheckpoint("c1-base")).toHaveLength(12)
    expect(casosDoCheckpoint("c2-conversa")).toHaveLength(54)
    expect(casosDoCheckpoint("c3-confiavel")).toHaveLength(84)
  })

  it("põe as pastas na ordem do checkpoint e, dentro de cada pasta, ordena por id", () => {
    const c2 = casosDoCheckpoint("c2-conversa").map((caso) => caso.id)
    expect(c2).toEqual([
      ...ordenados(casosC1.map((c) => c.id)),
      ...ordenados(casosC2.map((c) => c.id)),
    ])
    const c3 = casosDoCheckpoint("c3-confiavel").map((caso) => caso.id)
    expect(c3).toEqual([
      ...ordenados(casosC1.map((c) => c.id)),
      ...ordenados(casosC2.map((c) => c.id)),
      ...ordenados(casosC3.map((c) => c.id)),
    ])
  })

  it("marca os 12 casos do c1 como acompanhante", () => {
    for (const caso of casosDoCheckpoint("c1-base")) {
      expect(caso.tipo).toBe("acompanhante")
    }
  })

  it("dá famílias não vazias a todos os 84 casos", () => {
    for (const caso of casosDoCheckpoint("c3-confiavel")) {
      expect(caso.familias.length).toBeGreaterThan(0)
    }
  })

  it("cobre os 84 casos nas linhas da tabela, sem repetir", () => {
    const ids = LINHAS.flatMap((linha) => linha.ids)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ordenados(ids)).toEqual(ordenados([...porId.keys()]))
  })

  it.each(LINHAS)("$nome: famílias e marcas", ({ ids, familias, marcas }) => {
    for (const id of ids) {
      const caso = porId.get(id)
      expect(caso, id).toBeDefined()
      expect(caso?.familias, id).toEqual(familias)
      expect(caso?.marcas, id).toEqual(marcas)
    }
  })
})
