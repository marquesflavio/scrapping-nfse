function formatPtBrDate(date) {
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = `${date.getFullYear()}`;
  return `${day}/${month}/${year}`;
}

function fromIsoInputToPtBr(isoDate) {
  const date = parseIsoInputToDate(isoDate);
  return formatPtBrDate(date);
}

function parseIsoInputToDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error("Data inválida. Use o formato YYYY-MM-DD.");
  }

  const [yyyy, mm, dd] = isoDate.split("-").map(Number);
  const date = new Date(yyyy, mm - 1, dd);

  if (
    date.getFullYear() !== yyyy ||
    date.getMonth() !== mm - 1 ||
    date.getDate() !== dd
  ) {
    throw new Error("Data inválida informada.");
  }

  return date;
}

function diffInCalendarDays(startDate, endDate) {
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endUtc - startUtc) / msPerDay);
}

function getDateRangeFromUserInput(startIsoDate, endIsoDate) {
  const startDate = parseIsoInputToDate(startIsoDate);
  const endDate = parseIsoInputToDate(endIsoDate);

  const daysDiff = diffInCalendarDays(startDate, endDate);
  if (daysDiff < 0) {
    throw new Error("A data final não pode ser anterior à data inicial.");
  }
  if (daysDiff > 30) {
    throw new Error(
      "O período entre a data inicial e a data final não pode ser superior a 30 dias."
    );
  }

  const startFormatted = formatPtBrDate(startDate);
  const endFormatted = formatPtBrDate(endDate);

  return {
    startFormatted,
    endFormatted
  };
}

module.exports = {
  getDateRangeFromUserInput,
  fromIsoInputToPtBr,
  formatPtBrDate
};
