import { textosAlertas } from "./textos-alertas"

// Textos da página Sobre e da política de privacidade. Itens separados por " · " são arrays; "\n\n" separa parágrafos.
// Marcadores {chave} ficam no texto; quem usa troca (preencher, em src/core/publico/prazos.ts).
export const textosSobre = {
  titulo: "Sobre o Ritu",
  indice: "Nesta página",
  projeto: {
    titulo: "O projeto",
    texto:
      "O Ritu é um agente ayurvédico para o dia a dia. Você conta como está e ele sugere o que fazer agora com o que você tem em casa e com o clima da sua cidade.\n\nÉ um projeto de estudo: mostra como construir um agente de IA que consulta uma base com fontes, pergunta quando falta algo, pede aprovação antes de anotar, confere o próprio trabalho e é medido. Não é um produto comercial e não vende nada.",
  },
  autoria: {
    titulo: "Quem fez",
    texto: "Feito por {nome}.",
    github: "GitHub",
    linkedin: "LinkedIn",
  },
  feito: {
    titulo: "Como foi feito",
    texto:
      "Next.js, TypeScript e Postgres. Modelos Gemini escolhidos por papel, com troca automática quando a cota de um acaba. Evals a cada etapa da construção, com os resultados registrados. As decisões de arquitetura estão no repositório, e os números do agente, em Bastidores.",
    licenca: "O código está sob a licença MIT. A base ayurvédica tem todos os direitos reservados.",
    links: ["Ver o código", "Ver as decisões (ADRs)", "Ver os bastidores"],
  },
  fontes: {
    titulo: "Fontes e créditos",
    texto:
      "Cada linha da base ayurvédica cita a sua fonte; a lista completa está no repositório. O clima vem da Open-Meteo, sob a licença CC BY 4.0. Ícones: Phosphor (MIT). Fontes tipográficas: Cormorant Garamond e Figtree (SIL Open Font License).",
    links: ["Ver as fontes da base", "Open-Meteo"],
  },
  cuidados: {
    titulo: "Cuidados",
    texto:
      "O Ritu sugere conforto com alimentos, ervas de cozinha, óleos comuns e práticas leves. Ele não diagnostica, não trata e não substitui um profissional de saúde.",
    alerta: textosAlertas.fisico,
    emocional: textosAlertas.emocional,
  },
  privacidade: {
    titulo: "Privacidade",
    atualizadaEm: "2026-11-23",
    intro:
      "Esta é a política de privacidade do Ritu. Ela diz o que eu guardo, por quanto tempo, com quem os dados passam e como você vê e apaga tudo.",
    quem: {
      titulo: "Quem cuida dos seus dados",
      texto:
        "{nome}, que mantém o Ritu como projeto pessoal de estudo. Para pedidos sobre seus dados, escreva para {email}.",
    },
    semContato: "Para ver, corrigir ou apagar seus dados, use a aba Você, dentro do Ritu.",
    guardo: {
      titulo: "O que eu guardo",
      itens: [
        "Da conta Google: um identificador e o e-mail, que serve só para entrar. Ele não aparece na tela, não vai para a IA e não recebe mensagens.",
        "Seu perfil: dosha, a cidade que você escolheu (nome e coordenadas aproximadas), o que você evita sempre, restrições e o que você não come.",
        "Sua casa, seus gostos e como ficaram as sugestões.",
        "O que fez falta, por {faltasDias} dias.",
        "Notas sobre a sua rotina e padrões, só os que você aprovou.",
        "As mensagens da conversa, por {mensagensDias} dias. As que falam de um incômodo ou de um sinal de alerta, só até o dia seguinte.",
        "Um registro de cada resposta: o que o Ritu consultou, quanto tempo levou e o que o juiz disse. Ele serve para conferir e medir o agente.",
      ],
    },
    naoGuardo: {
      titulo: "O que eu não guardo",
      itens: [
        "Telefone, foto ou nome da conta Google, nem a localização do seu aparelho.",
        "O seu endereço IP. Para contar os limites de uso, guardo um código calculado a partir dele, que não permite voltar ao IP.",
        "Nada de propaganda nem de rastreamento de outras empresas.",
      ],
    },
    tempo: {
      titulo: "Por quanto tempo",
      texto:
        "Na demonstração, tudo some em {demonstracaoHoras} horas. Com a conta Google, até você apagar, fora os prazos acima. Retornos que ficaram sem resposta somem em {retornosDias} dias.\n\nQuando você apaga seus dados, a conta e tudo dela somem na hora. Os registros das respostas ficam sem ligação com você e sem nenhum texto, só para os números agregados de Bastidores.",
    },
    passa: {
      titulo: "Com quem os dados passam",
      itens: [
        "Google, para você entrar com a sua conta.",
        "Gemini, do Google: suas mensagens e o que ajuda a responder (dosha, casa, gostos, rotina, clima) vão para o modelo de IA. O Ritu usa o plano gratuito. Nele, o Google pode usar esse conteúdo para melhorar os produtos dele, e pessoas revisoras podem lê-lo. Não escreva nada que você não queira que outra pessoa leia. Esses dados podem ser processados fora do Brasil.",
        "Open-Meteo: recebe o nome da cidade buscada e as coordenadas, sem nada que identifique você.",
        "Vercel (hospedagem) e Neon (banco de dados), em São Paulo.",
        "Grafana Cloud: recebe números de funcionamento, como tempo e contagens, nunca texto seu.",
      ],
    },
    cookies: {
      titulo: "Cookies",
      texto:
        "Dois, os dois necessários: o da sessão, que mantém você conectada por até {sessaoDias} dias, e o do tema, que lembra se você prefere claro ou escuro por {temaDias} dias. Nenhum de propaganda ou de análise.",
    },
    direitos: {
      titulo: "Seus direitos",
      texto:
        'Pela LGPD, você pode ver, corrigir e apagar seus dados. No Ritu: "O que sei sobre você" mostra tudo o que ele guarda; cada item pode ser corrigido ou apagado; "Apagar meus dados" apaga tudo de uma vez. Para outros pedidos, como uma cópia dos seus dados, use o contato acima.',
    },
    idade: {
      titulo: "Idade",
      texto: "O Ritu é para maiores de {idadeMinima} anos.",
    },
    mudancas: {
      titulo: "Mudanças",
      texto: "Se esta política mudar, a data no topo muda junto.",
    },
  },
} as const
