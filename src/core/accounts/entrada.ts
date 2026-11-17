export type AvisoDaEntrada =
  | "demo_limite_ip"
  | "demo_limite_global"
  | "demo_expirou"
  | "erro_google"

const AVISOS: readonly AvisoDaEntrada[] = [
  "demo_limite_ip",
  "demo_limite_global",
  "demo_expirou",
  "erro_google",
]

// Estado da tela de entrada. Teto global atingido força o aviso de limite global; aviso desconhecido é ignorado;
// erro do Auth.js (?error=) vira erro_google.
export function estadoDaEntrada(p: {
  google: boolean
  demosHoje: number
  tetoGlobal: number
  aviso?: string
  erro?: string
}): { demo: boolean; google: boolean; aviso?: AvisoDaEntrada } {
  const demo = p.demosHoje < p.tetoGlobal
  if (!demo) return { demo, google: p.google, aviso: "demo_limite_global" }
  const aviso = AVISOS.find((conhecido) => conhecido === p.aviso)
  if (aviso) return { demo, google: p.google, aviso }
  if (p.erro !== undefined) return { demo, google: p.google, aviso: "erro_google" }
  return { demo, google: p.google }
}
