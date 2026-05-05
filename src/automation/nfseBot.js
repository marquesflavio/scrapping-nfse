const { chromium } = require("playwright");
const { getDateRangeFromUserInput } = require("./dateRange");
const {
  ensureDir,
  buildXmlName,
  waitForAndSaveDownload
} = require("./downloads");

const LOGIN_URL = "https://www.nfse.gov.br/EmissorNacional/Login";

async function shortPause(page, ms = 350) {
  await page.waitForTimeout(ms);
}

async function clickIfVisible(locator, timeout = 2500) {
  try {
    await locator.first().waitFor({ state: "visible", timeout });
    await locator.first().click();
    return true;
  } catch {
    return false;
  }
}

async function waitForAuthenticatedArea(page, timeoutMs = 300000) {
  await page.waitForFunction(
    () => {
      const bodyText = (document.body?.innerText || "").toLowerCase();
      const href = (window.location?.href || "").toLowerCase();
      return (
        bodyText.includes("nfs-e emitidas") ||
        bodyText.includes("portal contribuinte") ||
        bodyText.includes("nova nfs-e") ||
        href.includes("/emissornacional/dashboard")
      );
    },
    { timeout: timeoutMs }
  );
}

async function performLogin(page, config, hooks) {
  const { loginType, username, password } = config;

  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
  hooks.onLog("Página de login carregada.");

  if (loginType === "credentials") {
    hooks.onStatus("Preenchendo usuário e senha...");

    const userLocator = page
      .locator("input[type='text'], input[name*='user' i], input[id*='user' i]")
      .first();
    const passLocator = page
      .locator("input[type='password'], input[name*='senha' i], input[id*='senha' i]")
      .first();

    await userLocator.fill(username || "");
    await passLocator.fill(password || "");

    const enterButtonCandidates = [
      page.getByRole("button", { name: /entrar/i }),
      page.getByRole("link", { name: /entrar/i }),
      page.getByText(/entrar/i).first()
    ];

    let clicked = false;
    for (const candidate of enterButtonCandidates) {
      if (await clickIfVisible(candidate)) {
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      throw new Error("Não foi possível localizar o botão de entrar.");
    }
  } else {
    hooks.onStatus("Aguardando login manual por certificado digital...");
    hooks.onLog(
      "Usuário deve concluir o login por certificado no navegador aberto."
    );
  }

  await waitForAuthenticatedArea(page);
  hooks.onStatus("Sessão autenticada.");
}

async function openNfseEmitidas(page, hooks) {
  hooks.onStatus("Navegando para NFS-e Emitidas...");

  const candidates = [
    page.locator("a[href='/EmissorNacional/Notas/Emitidas']").first(),
    page.locator("a[data-original-title='NFS-e Emitidas']").first(),
    page.locator("a[title='NFS-e Emitidas']").first(),
    page.getByRole("link", { name: /NFS-e Emitidas/i }),
    page.getByRole("button", { name: /NFS-e Emitidas/i }),
    page.getByText("NFS-e Emitidas", { exact: false }).first(),
    page.locator("[title*='Emitidas' i]").first(),
    page.locator("[aria-label*='Emitidas' i]").first(),
    page.locator("a[href*='Emitida' i], button[href*='Emitida' i]").first()
  ];

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const candidate = candidates[idx];
    const clicked = await clickIfVisible(candidate, 1500);
    if (clicked) {
      await shortPause(page, 1200);
      break;
    }
  }

  const onEmitidasScreen = await page
    .evaluate(() => {
      const text = document.body?.innerText || "";
      return (
        text.includes("Data Inicial") &&
        text.includes("Data Final") &&
        text.includes("Filtrar")
      );
    })
    .catch(() => false);

  if (onEmitidasScreen) return;

  // Fallback por URL: o portal usa rotas com "Emitida".
  const currentUrl = page.url();
  const origin = new URL(currentUrl).origin;
  const fallbackUrls = [
    `${origin}/EmissorNacional/NfseEmitida`,
    `${origin}/EmissorNacional/NfseEmitidas`,
    `${origin}/EmissorNacional/Emitidas`
  ];

  for (const fallback of fallbackUrls) {
    try {
      await page.goto(fallback, { waitUntil: "domcontentloaded", timeout: 8000 });
      const visible = await page
        .evaluate(() => {
          const text = document.body?.innerText || "";
          return (
            text.includes("Data Inicial") &&
            text.includes("Data Final") &&
            text.includes("Filtrar")
          );
        })
        .catch(() => false);
      if (visible) {
        hooks.onLog(`Tela de Emitidas aberta por fallback: ${fallback}`);
        return;
      }
    } catch {
      // tenta próxima URL fallback
    }
  }
  throw new Error("Não foi possível abrir a página de NFS-e Emitidas.");
}

async function applyDateFilter(page, hooks) {
  hooks.onStatus("Aplicando período escolhido...");

  const { startFormatted, endFormatted } = getDateRangeFromUserInput(
    hooks.config.startDate,
    hooks.config.endDate
  );

  const setDateInField = async (locator, value) => {
    await locator.click({ timeout: 1500 });
    await locator.fill(value);
    await locator.dispatchEvent("input");
    await locator.dispatchEvent("change");
    await locator.blur();
  };

  let fillPath = "label";
  try {
    const startField = page.getByLabel(/Data Inicial/i).first();
    const endField = page.getByLabel(/Data Final/i).first();
    await setDateInField(startField, startFormatted);
    await setDateInField(endField, endFormatted);
  } catch {
    fillPath = "name_id_date_fields";
    const startCandidates = page.locator(
      "input[name*='inicial' i], input[id*='inicial' i], input[name*='dataini' i], input[id*='dataini' i], input[placeholder*='Inicial' i]"
    );
    const endCandidates = page.locator(
      "input[name*='final' i], input[id*='final' i], input[name*='datafim' i], input[id*='datafim' i], input[placeholder*='Final' i]"
    );

    if ((await startCandidates.count()) > 0 && (await endCandidates.count()) > 0) {
      await setDateInField(startCandidates.first(), startFormatted);
      await setDateInField(endCandidates.first(), endFormatted);
    } else {
      fillPath = "fallback_text_inputs";
      const inputs = page.locator("input[type='text']");
      await setDateInField(inputs.nth(0), startFormatted);
      await setDateInField(inputs.nth(1), endFormatted);
    }
  }

  const filterCandidates = [
    page.getByRole("button", { name: /filtrar/i }),
    page.getByRole("link", { name: /filtrar/i }),
    page.getByText(/filtrar/i).first()
  ];

  let filterClicked = false;
  for (let idx = 0; idx < filterCandidates.length; idx += 1) {
    const candidate = filterCandidates[idx];
    if (await clickIfVisible(candidate)) {
      filterClicked = true;
      break;
    }
  }

  if (!filterClicked) {
    throw new Error("Não foi possível clicar no botão Filtrar.");
  }

  await page.waitForTimeout(1200);
  hooks.onLog(`Período aplicado: ${startFormatted} até ${endFormatted}.`);
}

async function getRows(page) {
  const candidates = [
    page.locator("table tbody tr"),
    page.locator(".table tbody tr"),
    page.locator("[role='row']")
  ];

  for (const locator of candidates) {
    const count = await locator.count();
    if (count > 0) return locator;
  }

  return page.locator("table tr");
}

async function clickActionsForRow(row) {
  const actionLocators = [
    row.locator("a.icone-trigger"),
    row.getByRole("button", { name: /ações|acao|opções|opcoes|menu/i }),
    row.locator("button[aria-label*='menu' i], button[title*='menu' i]"),
    row.locator("button:has(i), a:has(i)"),
    row.locator("td:last-child button, td:last-child a"),
    row.locator("i[class*='ellipsis'], i[class*='dots']")
  ];

  for (const locator of actionLocators) {
    const count = await locator.count().catch(() => 0);
    if (count > 0 && (await clickIfVisible(locator, 1200))) {
      return true;
    }
  }

  return false;
}

async function clickDownloadXml(page) {
  const xmlOptions = [
    page.locator("a.list-group-item[href*='/EmissorNacional/Notas/Download/NFSe/']").first(),
    page.getByRole("menuitem", { name: /Download XML/i }),
    page.getByRole("link", { name: /Download XML/i }),
    page.getByText(/Download XML/i).first()
  ];

  for (const option of xmlOptions) {
    const optionCount = await option.count().catch(() => 0);
    if (optionCount > 0 && (await clickIfVisible(option, 1200))) {
      return true;
    }
  }

  return false;
}

async function hasNextPage(page) {
  const nextCandidates = [
    page.getByRole("button", { name: /próxima|proxima|next|>/i }),
    page.getByRole("link", { name: /próxima|proxima|next|>/i }),
    page.locator("a[aria-label*='next' i], button[aria-label*='next' i]")
  ];

  for (const candidate of nextCandidates) {
    if ((await candidate.count()) === 0) continue;
    const first = candidate.first();
    const disabled = await first.getAttribute("disabled");
    const classes = (await first.getAttribute("class")) || "";
    if (!disabled && !/disabled|inactive/i.test(classes)) return true;
  }

  return false;
}

async function goToNextPage(page) {
  const nextCandidates = [
    page.getByRole("button", { name: /próxima|proxima|next|>/i }),
    page.getByRole("link", { name: /próxima|proxima|next|>/i }),
    page.locator("a[aria-label*='next' i], button[aria-label*='next' i]")
  ];

  for (const candidate of nextCandidates) {
    if (await clickIfVisible(candidate, 1500)) {
      await page.waitForTimeout(1400);
      return true;
    }
  }
  return false;
}

async function processAllRows(page, config, hooks) {
  let pageIndex = 1;
  let totalProcessed = 0;
  let totalDownloaded = 0;
  const failures = [];

  while (true) {
    const rows = await getRows(page);
    const rowCount = await rows.count();

    hooks.onLog(`Página ${pageIndex}: ${rowCount} registros encontrados.`);

    for (let i = 0; i < rowCount; i += 1) {
      if (hooks.shouldStop()) {
        hooks.onLog("Execução interrompida pelo usuário.");
        return { totalProcessed, totalDownloaded, failures, interrupted: true };
      }

      const row = rows.nth(i);
      totalProcessed += 1;
      hooks.onProgress({ current: totalProcessed, downloaded: totalDownloaded });
      hooks.onStatus(`Baixando nota ${totalProcessed}...`);

      try {
        const emittedFor = await row.locator("td").nth(1).innerText().catch(() => "");
        const generatedAt = await row.locator("td").nth(0).innerText().catch(() => "");
        const fileName = buildXmlName({
          pageIndex,
          rowIndex: i + 1,
          emittedFor,
          generatedAt
        });

        const actionClicked = await clickActionsForRow(row);
        if (!actionClicked) {
          throw new Error("Botão de ações (3 pontinhos) não encontrado.");
        }

        await shortPause(page, 300);
        await waitForAndSaveDownload({
          page,
          outputDir: config.outputDir,
          fileName,
          triggerDownload: async () => {
            const downloadClicked = await clickDownloadXml(page);
            if (!downloadClicked) {
              throw new Error("Opção 'Download XML' não encontrada.");
            }
          },
          timeoutMs: config.timeoutMs || 30000
        });

        totalDownloaded += 1;
        hooks.onProgress({ current: totalProcessed, downloaded: totalDownloaded });
        hooks.onLog(`XML salvo: ${fileName}`);
      } catch (error) {
        const message = `Falha na linha ${i + 1} da página ${pageIndex}: ${error.message}`;
        failures.push(message);
        hooks.onLog(message);
      }
    }

    if (!(await hasNextPage(page))) break;
    const moved = await goToNextPage(page);
    if (!moved) break;
    pageIndex += 1;
  }

  return { totalProcessed, totalDownloaded, failures, interrupted: false };
}

async function runNfseDownloadFlow(config) {
  const hooks = {
    config,
    onStatus: config.onStatus || (() => {}),
    onProgress: config.onProgress || (() => {}),
    onLog: (entry) => {
      config.logger?.info(entry);
      (config.onLog || (() => {}))(entry);
    },
    shouldStop: config.shouldStop || (() => false)
  };

  await ensureDir(config.outputDir);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 80
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1360, height: 850 }
  });

  const page = await context.newPage();

  try {
    hooks.onStatus("Iniciando navegador...");
    await performLogin(page, config, hooks);
    await openNfseEmitidas(page, hooks);
    await applyDateFilter(page, hooks);
    const result = await processAllRows(page, config, hooks);

    hooks.onStatus(result.interrupted ? "Execução interrompida." : "Concluído.");
    hooks.onLog(
      `Resumo: processadas=${result.totalProcessed}, baixadas=${result.totalDownloaded}, falhas=${result.failures.length}.`
    );
    return {
      ...result,
      logFile: config.logger?.file
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = { runNfseDownloadFlow };
