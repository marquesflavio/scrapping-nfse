const { ipcRenderer } = require("electron");

const loginType = document.getElementById("loginType");
const username = document.getElementById("username");
const password = document.getElementById("password");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");
const outputDir = document.getElementById("outputDir");
const status = document.getElementById("status");
const progress = document.getElementById("progress");
const log = document.getElementById("log");

const selectFolderBtn = document.getElementById("selectFolderBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const openFolderBtn = document.getElementById("openFolderBtn");

function setStatus(message) {
  status.textContent = message;
}

function appendLog(message) {
  log.textContent += `${new Date().toLocaleTimeString()} - ${message}\n`;
  log.scrollTop = log.scrollHeight;
}

function updateAuthFields() {
  const credentials = loginType.value === "credentials";
  username.disabled = !credentials;
  password.disabled = !credentials;
}

selectFolderBtn.addEventListener("click", async () => {
  const selected = await ipcRenderer.invoke("select-folder");
  if (selected) outputDir.value = selected;
});

openFolderBtn.addEventListener("click", async () => {
  if (!outputDir.value) {
    setStatus("Selecione uma pasta antes.");
    return;
  }
  await ipcRenderer.invoke("open-folder", outputDir.value);
});

startBtn.addEventListener("click", async () => {
  if (!outputDir.value) {
    setStatus("Selecione uma pasta de destino para continuar.");
    return;
  }

  if (loginType.value === "credentials" && (!username.value || !password.value)) {
    setStatus("Preencha usuário e senha.");
    return;
  }

  if (!startDate.value || !endDate.value) {
    setStatus("Selecione a data inicial e final.");
    return;
  }

  if (startDate.value > endDate.value) {
    setStatus("A data inicial não pode ser maior que a data final.");
    return;
  }

  setStatus("Iniciando...");
  log.textContent = "";
  progress.textContent = "Processadas: 0 | Baixadas: 0";

  const result = await ipcRenderer.invoke("run-bot", {
    loginType: loginType.value,
    username: username.value,
    password: password.value,
    startDate: startDate.value,
    endDate: endDate.value,
    outputDir: outputDir.value
  });

  if (!result.ok) {
    setStatus(`Erro: ${result.message}`);
  }
});

stopBtn.addEventListener("click", async () => {
  const result = await ipcRenderer.invoke("stop-bot");
  setStatus(result.ok ? "Parada solicitada..." : result.message);
});

loginType.addEventListener("change", updateAuthFields);
updateAuthFields();

(() => {
  const now = new Date();
  const firstDayCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const toInputDate = (date) => {
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, "0");
    const dd = `${date.getDate()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };
  startDate.value = toInputDate(firstDayCurrentMonth);
  endDate.value = toInputDate(now);
})();

ipcRenderer.on("bot-status", (_event, message) => setStatus(message));
ipcRenderer.on("bot-progress", (_event, data) => {
  progress.textContent = `Processadas: ${data.current || 0} | Baixadas: ${data.downloaded || 0}`;
});
ipcRenderer.on("bot-log", (_event, entry) => appendLog(entry));
ipcRenderer.on("bot-finished", (_event, payload) => {
  if (!payload.ok) {
    appendLog(`Execução encerrada com erro: ${payload.message}`);
    return;
  }

  const result = payload.result;
  appendLog("Execução finalizada.");
  appendLog(
    `Resumo final: processadas=${result.totalProcessed}, baixadas=${result.totalDownloaded}, falhas=${result.failures.length}`
  );

  if (result.failures.length) {
    appendLog("Falhas:");
    result.failures.forEach((f) => appendLog(`- ${f}`));
  }

  if (result.logFile) {
    appendLog(`Log técnico salvo em: ${result.logFile}`);
  }
});
