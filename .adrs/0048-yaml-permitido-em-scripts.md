# ADR 0048: `yaml` permitido em `scripts/`

## Status

Aceito · 2026-11-17

## Contexto

A regra R5 do teste de arquitetura dá a cada pacote uma casa; o `yaml` só podia ser importado em `src/infra/knowledge/`, onde a base é lida. A 022 trouxe ferramentas que leem YAML fora do produto: o teste do workflow da CI (`scripts/ci-workflow.test.ts`) e o `painel:publicar`, que lê as regras de alerta geradas em `observability/grafana/alerting/ritu.yaml`.

## Decisão

1. `scripts/` passa a ser casa permitida do `yaml`, ao lado de `src/infra/knowledge/`.
2. Em `src/`, nada muda: o produto só lê YAML pela base.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Expor um leitor de YAML pelo container | Indireção sem ganho para ler um arquivo de CI ou de configuração do Grafana |
| Escrever as regras de alerta em JSON | Mudaria o formato provisionado pelo Grafana local da 015 |

## Consequências

- Scripts e testes de ferramenta leem YAML direto.
- A regra continua impedindo `yaml` no core e no resto da infra.
