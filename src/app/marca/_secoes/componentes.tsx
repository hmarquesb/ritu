"use client"

import { Bell, Coffee, DotsThree, Info, Plus, Trash } from "@phosphor-icons/react"
import { Button } from "@/components/base/button"
import { Dialog, DialogTrigger, Sheet } from "@/components/base/dialog"
import { IconButton } from "@/components/base/icon-button"
import { Menu, MenuItem } from "@/components/base/menu"
import { Spinner } from "@/components/base/spinner"
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs"
import { TextLink } from "@/components/base/text-link"
import { toast } from "@/components/base/toast"
import { Tooltip } from "@/components/base/tooltip"
import { Bloco, Linha } from "./componentes-bloco"
import { CamposTexto, Selecao } from "./componentes-campos"

function Botoes() {
  return (
    <>
      <Bloco titulo="Button">
        <Linha>
          <Button variant="primary">Anotar</Button>
          <Button variant="secondary">Agora não</Button>
          <Button variant="quiet">Pular</Button>
          <Button variant="danger">Apagar</Button>
        </Linha>
        <Linha>
          <Button variant="primary" size="sm">
            Anotar
          </Button>
          <Button variant="secondary" size="sm">
            Agora não
          </Button>
          <Button variant="primary" icon={Plus}>
            Adicionar
          </Button>
          <Button variant="primary" isDisabled>
            Indisponível
          </Button>
          <Button variant="primary" isPending>
            Salvando
          </Button>
        </Linha>
        <Button variant="primary" fullWidth>
          Largura toda
        </Button>
      </Bloco>
      <Bloco titulo="IconButton">
        <Linha>
          <IconButton icon={Bell} aria-label="Avisos" />
          <IconButton icon={Bell} aria-label="Avisos" variant="secondary" />
          <IconButton icon={Bell} aria-label="Avisos" size="sm" />
          <IconButton icon={Bell} aria-label="Avisos" variant="secondary" size="sm" />
        </Linha>
      </Bloco>
    </>
  )
}

function Sobreposicoes() {
  return (
    <>
      <Bloco titulo="Menu">
        <Linha>
          <Menu
            trigger={
              <Button data-testid="abrir-menu" icon={DotsThree}>
                Abrir menu
              </Button>
            }
            label="Ações da receita"
            onAction={() => {}}
          >
            <MenuItem id="chas" icon={Coffee}>
              Ver chás parecidos
            </MenuItem>
            <MenuItem id="info" icon={Info}>
              Por que isso?
            </MenuItem>
            <MenuItem id="apagar" icon={Trash} tone="danger">
              Tirar da casa
            </MenuItem>
          </Menu>
        </Linha>
      </Bloco>
      <Bloco titulo="Dialog">
        <DialogTrigger>
          <Button data-testid="abrir-dialogo">Abrir diálogo</Button>
          <Dialog title="Tirar da casa?" description="O gengibre some da sua lista de casa.">
            {(close) => (
              <Linha>
                <Button variant="danger" onPress={close}>
                  Tirar
                </Button>
                <Button variant="quiet" onPress={close}>
                  Manter
                </Button>
              </Linha>
            )}
          </Dialog>
        </DialogTrigger>
      </Bloco>
      <Bloco titulo="Sheet">
        <DialogTrigger>
          <Button data-testid="abrir-folha">Abrir folha</Button>
          <Sheet title="Como ficou?" description="Conte como foi o chá de ontem.">
            {(close) => (
              <Button variant="primary" onPress={close}>
                Pronto
              </Button>
            )}
          </Sheet>
        </DialogTrigger>
      </Bloco>
      <Bloco titulo="Toast">
        <Linha>
          <Button data-testid="mostrar-aviso" onPress={() => toast("Anotei na sua casa.")}>
            Mostrar aviso
          </Button>
          <Button onPress={() => toast("Receita salva.", { tone: "positive" })}>
            Aviso positivo
          </Button>
          <Button onPress={() => toast("Não consegui salvar.", { tone: "danger" })}>
            Aviso de erro
          </Button>
        </Linha>
      </Bloco>
      <Bloco titulo="Tooltip">
        <Tooltip text="Avisos do dia">
          <IconButton
            data-testid="abrir-dica"
            icon={Bell}
            aria-label="Avisos do dia"
            variant="secondary"
          />
        </Tooltip>
      </Bloco>
    </>
  )
}

function Navegacao() {
  return (
    <>
      <Bloco titulo="Tabs">
        <Tabs>
          <TabList aria-label="Momentos do dia">
            <Tab id="manha">Manhã</Tab>
            <Tab id="tarde">Tarde</Tab>
            <Tab id="noite">Noite</Tab>
          </TabList>
          <TabPanel id="manha">Água morna com limão para começar.</TabPanel>
          <TabPanel id="tarde">Um chá de erva-doce depois do almoço.</TabPanel>
          <TabPanel id="noite">Leite morno com cardamomo.</TabPanel>
        </Tabs>
      </Bloco>
      <Bloco titulo="TextLink">
        <p className="max-w-content text-prose">
          Quer entender melhor? Leia <TextLink href="#fontes">as fontes da base</TextLink> antes de
          mudar a rotina.
        </p>
      </Bloco>
      <Bloco titulo="Spinner">
        <Spinner label="Carregando" className="text-ink-muted" />
      </Bloco>
    </>
  )
}

export function SecaoComponentes() {
  return (
    <section aria-labelledby="componentes" className="flex flex-col gap-6">
      <h2 id="componentes" className="font-title text-title text-ink">
        Componentes
      </h2>
      <Botoes />
      <CamposTexto />
      <Selecao />
      <Sobreposicoes />
      <Navegacao />
    </section>
  )
}
