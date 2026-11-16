-- Contadores do limitador de uso (spec 017): uma linha por chave, janela e início.
-- A chave é opaca (hash ou identificador); nada de texto da pessoa.

create table limites (
  chave text not null,
  janela text not null check (janela in ('minuto', 'dia')),
  inicio text not null,
  total int not null default 0,
  primary key (chave, janela, inicio)
);
