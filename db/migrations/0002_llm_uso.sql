-- Registro de uso dos modelos de linguagem (spec 006): uma linha por modelo, janela e início.
-- Só números e nomes de modelo; nada de texto da pessoa.

create table llm_uso (
  modelo text not null,
  janela text not null check (janela in ('minuto', 'dia')),
  inicio text not null,
  pedidos int not null default 0,
  tokens int not null default 0,
  rate_limits int not null default 0,
  esgotado boolean not null default false,
  primary key (modelo, janela, inicio)
);
