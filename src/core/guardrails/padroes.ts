// Padrões do guardrail de entrada. O texto chega normalizado (minúsculas, sem acento,
// espaços juntos), exceto TAGS, que é testado no texto original.

export const ALERTA_EMOCIONAL: RegExp[] = [
  /\b(quero|queria|vou|penso em|pensando em|vontade de) (morrer|sumir|desaparecer|me matar|me machucar|me cortar|acabar com tudo|nao existir|nao acordar)\b/,
  /\b(me matar|me machucar de proposito|suicid\w*|tirar (a )?minha (propria )?vida|acabar com (a )?minha vida)\b/,
  /\bnao quero mais viver\b/,
  /\bnao vale (mais )?a pena viver\b/,
  /\bsem (motivo|razao) (pra|para) viver\b/,
  /\bmelhor (se eu|eu) (nao existisse|morresse|sumisse)\b/,
  /\bnao aguento mais( viver| a vida| nada| isso tudo)?\s*([.!?]|$)/,
]

export const ALERTA_FISICO: RegExp[] = [
  /\b(dor|aperto|pressao) (muito )?(forte )?no peito\b/,
  /\b(falta de ar|nao consigo respirar|dificuldade (de|para|pra) respirar)\b/,
  /\bdesmai\w+/,
  /\bfebre (muito )?alta\b/,
  /\bfebre de (39|40|41)\b/,
  /\b(39|40|41) (graus )?de febre\b/,
  /\b(sangramento|sangrando|vomit\w+ sangue|sangue (nas fezes|na urina|no vomito))\b/,
  /\bdor (muito forte|insuportavel|subita|de repente)\b/,
  /\b(convuls\w+|confusao mental)\b/,
]

export const INJECTION: RegExp[] = [
  /\b(ignor\w+|esquec\w+|desconsider\w+) (todas |tudo |de )?(as |os |suas |seus |o |a )?(instrucoes|regras|ordens|comandos|prompt|orientacoes)\b/,
  /\b(instrucoes|regras) (anteriores|acima|de antes)\b/,
  /\b(prompt (do|de) sistema|system prompt|jailbreak|modo (desenvolvedor|dev|dan))\b/,
  /\b(voce agora e|a partir de agora voce e|finja (ser|que e)|aja como)\b/,
  /\b(revele|mostre|repita|quais sao) ((o |a |as |os )?(seu|sua|suas|seus) (prompt|instrucoes|regras)|(o )?prompt)\b/,
  /\b(ignore|disregard|forget) (all |any |the |your )?(previous |prior |above )?(instructions|rules|prompt)\b/,
]

export const TAGS: RegExp = /<\/?\s*(mensagem_da_pessoa|contexto|sistema|system|instrucoes)\b/i
