-- Sinais do dia (spec 023): votos e retornos contados pela limpeza diária, antes de apagar as contas
-- vencidas. Os números de Bastidores leem daqui, não de feedback e retornos. Sem texto da pessoa.

create table sinais_dia (
  dia date not null,
  sinal text not null check (sinal in ('feedback_up', 'feedback_down', 'retorno_ajudou', 'retorno_nao_ajudou', 'retorno_nao_fez')),
  total integer not null,
  primary key (dia, sinal)
);
