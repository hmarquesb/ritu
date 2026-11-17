-- Lista "Para ter em casa" (spec 019): o motivo "pessoa" entra para o que a pessoa põe na lista pela tela da casa.
-- O motivo "pessoa" fica com detalhe vazio; nada de texto da pessoa.

alter table lista_ter_em_casa drop constraint lista_ter_em_casa_motivo_check;
alter table lista_ter_em_casa add constraint lista_ter_em_casa_motivo_check
  check (motivo in ('faltou_hoje', 'fez_falta', 'pessoa'));
