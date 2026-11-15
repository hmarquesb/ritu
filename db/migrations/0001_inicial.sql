-- Migração inicial do Ritu (spec 004).
-- Os ids vêm de gen_random_uuid(); as datas e horas vêm do código, nunca de default do banco.

create table contas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('google', 'demo')),
  google_sub text unique,
  email text,
  expira_em timestamptz,
  tester boolean not null,
  aviso_aceito_em timestamptz,
  evitar_passo text check (evitar_passo in ('pronto', 'nenhum', 'pulou')),
  evitar_lembrete_em timestamptz,
  dosha_adiado_em timestamptz,
  criado_em timestamptz not null
);

create table perfis (
  conta_id uuid primary key references contas (id) on delete cascade,
  prakriti jsonb,
  origem text check (origem in ('quiz', 'declarado')),
  evitar_sempre jsonb not null,
  restricoes text[] not null,
  nao_come jsonb not null,
  cidade_nome text,
  cidade_lat numeric(5, 2),
  cidade_lon numeric(5, 2),
  cidade_fuso text,
  atualizado_em timestamptz not null
);

create table evitar_temporario (
  conta_id uuid not null references contas (id) on delete cascade,
  tipo text not null,
  valor text not null,
  dia date not null,
  primary key (conta_id, tipo, valor, dia)
);

create table casa (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  alimento_id text,
  nome_livre text,
  nome_normalizado text,
  estado text not null check (estado in ('tem', 'acabou')),
  sempre_tenho boolean not null,
  confirmado_em timestamptz not null,
  origem text not null check (origem in ('conversa', 'tela', 'pergunta')),
  check ((alimento_id is null) <> (nome_livre is null)),
  unique (conta_id, alimento_id),
  unique (conta_id, nome_normalizado)
);

create table alimentos_desconhecidos (
  nome text primary key,
  vezes integer not null
);

create table preferencias (
  conta_id uuid not null references contas (id) on delete cascade,
  item_tipo text not null check (item_tipo in ('alimento', 'pratica', 'preparo')),
  item_id text not null,
  gosto text check (gosto in ('gosta', 'nao_gosta')),
  ajudou integer not null,
  nao_ajudou integer not null,
  nao_fez integer not null,
  ultimos_resultados text[] not null
    check (
      ultimos_resultados <@ array['ajudou', 'nao_ajudou']::text[]
      and cardinality(ultimos_resultados) <= 2
    ),
  ultima_sugestao_em timestamptz,
  primary key (conta_id, item_tipo, item_id)
);

create table retornos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  run_id uuid not null,
  sugestao jsonb not null,
  status text not null check (status in ('aguardando', 'respondido')),
  resultado text check (resultado in ('ajudou', 'nao_ajudou', 'nao_fez')),
  origem text check (origem in ('toque', 'conversa')),
  criado_em timestamptz not null,
  respondido_em timestamptz
);

create table rotina_notas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  texto text not null,
  ativa boolean not null,
  criado_em timestamptz not null
);

create table rotina_resumos (
  conta_id uuid not null references contas (id) on delete cascade,
  versao integer not null,
  texto text not null,
  criado_em timestamptz not null,
  primary key (conta_id, versao)
);

create table padroes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  tipo text not null check (tipo in ('ajuda_em_estado', 'estados_juntos')),
  chave text not null,
  frase text not null,
  ocorrencias integer not null,
  status text not null check (status in ('candidato', 'confirmado', 'recusado')),
  criado_em timestamptz not null,
  decidido_em timestamptz,
  unique (conta_id, tipo, chave)
);

create table mensagens (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references contas (id) on delete cascade,
  run_id uuid,
  autor text not null check (autor in ('pessoa', 'agente')),
  texto text not null,
  com_incomodo boolean not null,
  dia date not null,
  criado_em timestamptz not null
);

create table runs (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid references contas (id) on delete set null,
  caminho text not null,
  intencoes text[] not null,
  status text not null check (
    status in (
      'running',
      'waiting_for_input',
      'waiting_for_approval',
      'done',
      'failed',
      'expired',
      'cancelled'
    )
  ),
  checkpoint jsonb,
  pendencia jsonb,
  momento jsonb,
  com_incomodo boolean not null,
  clima_usado jsonb,
  saida jsonb,
  passos integer not null,
  tokens_entrada integer not null,
  tokens_saida integer not null,
  latencia_ms integer not null,
  modelos jsonb not null,
  trocas_de_modelo integer not null,
  prompt_versao text,
  juiz_tentativas integer not null,
  juiz_aprovado boolean,
  trace_id text,
  dia date not null,
  criado_em timestamptz not null,
  atualizado_em timestamptz not null
);

create unique index runs_uma_aberta_por_conta on runs (conta_id)
  where status in ('running', 'waiting_for_input', 'waiting_for_approval');

create table run_etapas (
  run_id uuid not null references runs (id) on delete cascade,
  ordem integer not null,
  tipo text not null,
  nome text not null,
  resumo text,
  status text not null check (status in ('ok', 'falhou', 'recusado')),
  duracao_ms integer not null,
  modelo text,
  tokens_entrada integer not null,
  tokens_saida integer not null,
  criado_em timestamptz not null,
  primary key (run_id, ordem)
);

create table propostas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  conta_id uuid not null references contas (id) on delete cascade,
  tool text not null,
  conteudo jsonb not null,
  decisao text not null check (decisao in ('pendente', 'aprovada', 'recusada', 'expirada')),
  criado_em timestamptz not null,
  decidida_em timestamptz
);

create table faltas (
  conta_id uuid not null references contas (id) on delete cascade,
  alimento_id text not null,
  dia date not null,
  origem text not null check (origem in ('teria_entrado', 'nao_tenho')),
  run_id uuid,
  primary key (conta_id, alimento_id, dia)
);

create table lista_ter_em_casa (
  conta_id uuid not null references contas (id) on delete cascade,
  alimento_id text not null,
  motivo text not null check (motivo in ('faltou_hoje', 'fez_falta')),
  detalhe text not null,
  criado_em timestamptz not null,
  primary key (conta_id, alimento_id)
);

create table feedback (
  run_id uuid primary key references runs (id) on delete cascade,
  conta_id uuid not null references contas (id) on delete cascade,
  voto text not null check (voto in ('up', 'down')),
  criado_em timestamptz not null
);
