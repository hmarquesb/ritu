-- Padrões de chá (spec 025): as chaves "<estados>|pratica:cha-<x>" viram "<estados>|cha".
-- Por (conta, chave nova) fica uma linha: status confirmado > recusado > candidato, ocorrências somadas,
-- criado_em o menor, decidido_em o da linha mantida. A frase é remontada pelos estados da chave.

create temporary table _padroes_cha on commit drop as
with alvo as (
  select id, conta_id, status, ocorrencias, criado_em, decidido_em,
         split_part(chave, '|', 1) || '|cha' as nova
  from padroes
  where tipo = 'ajuda_em_estado' and (chave ~ '\|pratica:cha-' or chave ~ '\|cha$')
),
ordenado as (
  select *,
         row_number() over (
           partition by conta_id, nova
           order by case status when 'confirmado' then 0 when 'recusado' then 1 else 2 end, criado_em
         ) as posicao
  from alvo
)
select conta_id, nova,
       max(status) filter (where posicao = 1) as status,
       sum(ocorrencias)::integer as ocorrencias,
       min(criado_em) as criado_em,
       max(decidido_em) filter (where posicao = 1) as decidido_em
from ordenado
group by conta_id, nova;

delete from padroes
where tipo = 'ajuda_em_estado' and (chave ~ '\|pratica:cha-' or chave ~ '\|cha$');

insert into padroes (conta_id, tipo, chave, frase, ocorrencias, status, criado_em, decidido_em)
select p.conta_id, 'ajuda_em_estado', p.nova,
       'Quando você está ' || case
         when cardinality(r.rotulos) = 1 then r.rotulos[1]
         else array_to_string(r.rotulos[1:cardinality(r.rotulos) - 1], ', ') || ' e ' || r.rotulos[cardinality(r.rotulos)]
       end || ', um chá costuma te ajudar.',
       p.ocorrencias, p.status, p.criado_em, p.decidido_em
from _padroes_cha p
cross join lateral (
  select array_agg(
           case e.estado
             when 'com_frio' then 'com frio'
             when 'com_calor' then 'com calor'
             when 'sem_energia' then 'sem energia'
             else e.estado
           end order by e.ordem
         ) as rotulos
  from unnest(string_to_array(split_part(p.nova, '|', 1), '+')) with ordinality as e(estado, ordem)
) r;
