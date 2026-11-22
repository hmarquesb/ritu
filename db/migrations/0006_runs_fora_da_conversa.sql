-- Runs fora da conversa (spec 020): quando a pessoa apaga um dia, os runs fechados dele saem da conversa
-- e ficam só no rastro. Sem texto da pessoa.

alter table runs add column fora_da_conversa boolean not null default false;
