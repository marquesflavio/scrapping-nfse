# NFS-e Downloader

Aplicação desktop para baixar XMLs de NFS-e emitidas no Portal Nacional.

## O que o app faz

- Abre o portal oficial: [NFS-e Portal Contribuinte](https://www.nfse.gov.br/EmissorNacional/Login).
- Faz login por:
  - usuário/senha, ou
  - certificado digital (manual assistido).
- Vai para `NFS-e Emitidas`.
- Aplica o período selecionado pelo usuário (`Data inicial` e `Data final`).
- Percorre todas as páginas da lista.
- Em cada linha, clica em `3 pontinhos` e depois `Download XML`.
- Salva os arquivos na pasta escolhida.

## Requisitos

- Windows 10/11
- Node.js 20+

## Instalação

```bash
npm install
```

## Executar em desenvolvimento

```bash
npm start
```

## Gerar executável Windows (portátil)

```bash
npm run build:win
```

Saída em `dist/`.

## Como usar (passo a passo simples)

1. Abra o app.
2. Escolha o tipo de login.
3. Se for usuário/senha, preencha os campos.
4. Clique em `Escolher pasta` para definir onde salvar os XMLs.
5. Escolha `Data inicial` e `Data final`.
6. Clique em `Iniciar`.
7. Se for certificado digital, faça login manualmente na janela aberta.
8. Aguarde o status `Concluído`.
9. Clique em `Abrir pasta` para ver os arquivos.

## Estrutura do projeto

- `src/main.js`: processo principal do Electron e IPC.
- `src/ui/index.html`: interface simples para o usuário.
- `src/ui/renderer.js`: eventos da tela e atualização de status/log.
- `src/automation/nfseBot.js`: automação Playwright (login, filtro, paginação, downloads).
- `src/automation/dateRange.js`: conversão e validação do período informado pelo usuário.
- `src/automation/downloads.js`: salvamento e nomeação dos XMLs.
- `src/core/logger.js`: log técnico em arquivo.

## Observações importantes

- Em login com certificado digital, o app aguarda o usuário concluir o login no navegador.
- O layout do portal pode mudar; se mudar, pode ser necessário ajustar seletores em `src/automation/nfseBot.js`.
- Logs técnicos ficam em `logs/`.
