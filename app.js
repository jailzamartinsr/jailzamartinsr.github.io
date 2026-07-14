const WORKOUTS = {
  upperA: {
    name: "Superior A",
    exercises: [
      "Puxada frente",
      "Supino máquina",
      "Remada baixa",
      "Desenvolvimento máquina",
      "Elevação lateral",
      "Rosca direta",
      "Tríceps corda",
    ],
  },
  lowerA: {
    name: "Inferior A",
    exercises: [
      "Hack",
      "Leg Press",
      "Extensora",
      "Mesa Flexora",
      "Elevação Pélvica",
      "Abdutora",
      "Panturrilha",
    ],
  },
  upperB: {
    name: "Superior B",
    exercises: [
      "Remada máquina",
      "Puxada supinada",
      "Supino inclinado",
      "Crucifixo",
      "Face Pull",
      "Rosca martelo",
      "Tríceps francês",
    ],
  },
  lowerB: {
    name: "Inferior B",
    exercises: [
      "Stiff",
      "Cadeira Flexora",
      "Afundo",
      "Glúteo cabo",
      "Abdutora",
      "Panturrilha sentada",
      "Abdômen polia",
    ],
  },
};

const SETS = [
  { key: "warmup", label: "Leve", target: "12" },
  { key: "feeder", label: "Interm.", target: "6" },
  { key: "work1", label: "Trab. 1", target: "8-10" },
  { key: "work2", label: "Trab. 2", target: "8-10" },
];

const STORAGE_KEY = "treino-upper-lower-v1";
const DRAFT_KEY = "treino-upper-lower-draft-v1";
const WORKOUT_ORDER = ["upperA", "lowerA", "upperB", "lowerB"];

const state = {
  workoutKey: "upperA",
  records: loadRecords(),
};

const els = {
  exerciseList: document.querySelector("#exerciseList"),
  sessionDate: document.querySelector("#sessionDate"),
  sessionFeeling: document.querySelector("#sessionFeeling"),
  sessionNotes: document.querySelector("#sessionNotes"),
  reportName: document.querySelector("#reportName"),
  lastWorkoutName: document.querySelector("#lastWorkoutName"),
  nextWorkoutName: document.querySelector("#nextWorkoutName"),
  saveSession: document.querySelector("#saveSession"),
  clearCurrent: document.querySelector("#clearCurrent"),
  exportDailyReport: document.querySelector("#exportDailyReport"),
  historyList: document.querySelector("#historyList"),
  exportCsv: document.querySelector("#exportCsv"),
  volumeChart: document.querySelector("#volumeChart"),
  workoutChartSelect: document.querySelector("#workoutChartSelect"),
  volumeChartSummary: document.querySelector("#volumeChartSummary"),
  exerciseChartSelect: document.querySelector("#exerciseChartSelect"),
  exerciseChartSummary: document.querySelector("#exerciseChartSummary"),
  exerciseChart: document.querySelector("#exerciseChart"),
  volumeMetric: document.querySelector("#volumeMetric"),
  setsMetric: document.querySelector("#setsMetric"),
  lastMetric: document.querySelector("#lastMetric"),
  installButton: document.querySelector("#installButton"),
};

let deferredInstallPrompt = null;

init();

function init() {
  els.sessionDate.value = today();
  bindEvents();
  loadDraft();
  renderWorkout();
  renderSequence();
  renderHistory();
  renderCharts();
  updateSummary();
  registerServiceWorker();
}

function bindEvents() {
  document.querySelectorAll("[data-workout]").forEach((button) => {
    button.addEventListener("click", () => {
      saveDraft();
      state.workoutKey = button.dataset.workout;
      document.querySelectorAll("[data-workout]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      renderWorkout();
      els.workoutChartSelect.value = state.workoutKey;
      renderCharts();
      updateSummary();
    });
  });

  els.exerciseList.addEventListener("input", () => {
    updateSummary();
    saveDraft();
  });

  els.exerciseList.addEventListener("click", (event) => {
    const header = event.target.closest(".exercise-header");
    if (!header) return;
    const card = header.closest(".exercise-card");
    card.classList.toggle("is-collapsed");
    header.setAttribute("aria-expanded", String(!card.classList.contains("is-collapsed")));
  });

  [els.sessionDate, els.sessionFeeling, els.sessionNotes, els.reportName].forEach((element) => {
    element.addEventListener("input", saveDraft);
  });

  els.saveSession.addEventListener("click", saveSession);
  els.clearCurrent.addEventListener("click", clearCurrentScreen);
  els.exportDailyReport.addEventListener("click", exportDailyReport);
  els.exportCsv.addEventListener("click", exportCsv);
  els.workoutChartSelect.addEventListener("change", renderVolumeChart);
  els.exerciseChartSelect.addEventListener("change", renderExerciseChart);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });

  els.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });
}

function renderWorkout() {
  const template = document.querySelector("#exerciseTemplate");
  els.exerciseList.innerHTML = "";

  WORKOUTS[state.workoutKey].exercises.forEach((exerciseName) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".exercise-card");
    const sets = fragment.querySelector(".sets");
    const last = findLastExerciseRecord(exerciseName);

    card.dataset.exercise = exerciseName;
    fragment.querySelector(".exercise-name").textContent = exerciseName;
    fragment.querySelector(".exercise-structure").textContent =
      "1x12 leve + 1x6 intermediária + 2x8-10 trabalho";

    SETS.forEach((set) => {
      const row = document.createElement("div");
      row.className = "set-grid set-row";
      row.innerHTML = `
        <span class="set-name">${set.label} <small>${set.target}</small></span>
        <input inputmode="decimal" data-set="${set.key}" data-field="weight" aria-label="${exerciseName} ${set.label} carga" placeholder="kg">
        <input inputmode="numeric" data-set="${set.key}" data-field="reps" aria-label="${exerciseName} ${set.label} repetições" placeholder="reps">
      `;
      sets.appendChild(row);
    });

    const hint = fragment.querySelector(".progression-hint");
    if (last) {
      hint.textContent = buildProgressionHint(last);
      hint.classList.toggle("warn", !last.completedAllWorkSets);
    } else {
      hint.textContent = "Primeiro registro deste exercício.";
    }

    els.exerciseList.appendChild(fragment);
  });

  restoreWorkoutDraft();
}

function collectSession() {
  const exercises = [...els.exerciseList.querySelectorAll(".exercise-card")].map((card) => {
    const sets = SETS.map((set) => {
      const weight = card.querySelector(`[data-set="${set.key}"][data-field="weight"]`).value.trim();
      const reps = card.querySelector(`[data-set="${set.key}"][data-field="reps"]`).value.trim();
      return {
        key: set.key,
        label: set.label,
        weight: normalizeNumber(weight),
        reps: normalizeNumber(reps),
      };
    });

    return {
      name: card.dataset.exercise,
      note: card.querySelector(".exercise-note").value.trim(),
      sets,
    };
  });

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    date: els.sessionDate.value || today(),
    workoutKey: state.workoutKey,
    workoutName: WORKOUTS[state.workoutKey].name,
    feeling: els.sessionFeeling.value,
    notes: els.sessionNotes.value.trim(),
    exercises,
    savedAt: new Date().toISOString(),
  };
}

function saveSession() {
  const session = collectSession();
  const hasAnySet = session.exercises.some((exercise) =>
    exercise.sets.some((set) => set.weight > 0 || set.reps > 0)
  );

  if (!hasAnySet) {
    alert("Preencha pelo menos uma carga ou repetição antes de salvar.");
    return;
  }

  state.records.unshift(session);
  persistRecords();
  localStorage.removeItem(DRAFT_KEY);
  renderSequence();
  renderHistory();
  renderCharts();
  updateSummary();
  alert("Treino salvo.");
}

function clearCurrentScreen() {
  els.exerciseList.querySelectorAll("input").forEach((input) => {
    input.value = "";
  });
  els.sessionNotes.value = "";
  els.sessionFeeling.value = "normal";
  saveDraft();
  updateSummary();
}

function exportDailyReport() {
  const reportDate = els.sessionDate.value || today();
  const sessions = getDailyReportSessions(reportDate);

  if (!sessions.length) {
    alert("Não há treino salvo ou preenchido para a data selecionada.");
    return;
  }

  const reportTitle = (els.reportName.value.trim() || `Relatório do treino - ${formatDate(reportDate)}`);
  const html = buildDailyReportWorkbook(reportTitle, reportDate, sessions);
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFilename(reportTitle)}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function updateSummary() {
  const session = collectSession();
  const workSets = session.exercises.flatMap((exercise) =>
    exercise.sets.filter((set) => set.key.startsWith("work"))
  );
  const volume = workSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const completedSets = session.exercises.flatMap((exercise) => exercise.sets).filter(
    (set) => set.weight > 0 || set.reps > 0
  ).length;
  const lastForWorkout = state.records.find((record) => record.workoutKey === state.workoutKey);

  els.volumeMetric.textContent = `${formatNumber(volume)} kg`;
  els.setsMetric.textContent = String(completedSets);
  els.lastMetric.textContent = lastForWorkout ? formatDate(lastForWorkout.date) : "-";
}

function renderHistory() {
  if (!state.records.length) {
    els.historyList.innerHTML = '<p class="empty-state">Nenhum treino salvo ainda.</p>';
    return;
  }

  els.historyList.innerHTML = "";
  state.records.slice(0, 12).forEach((record) => {
    const volume = calculateRecordVolume(record);
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div>
        <strong>${formatDate(record.date)} · ${record.workoutName}</strong>
        <small>${formatNumber(volume)} kg de volume · sensação ${record.feeling}</small>
      </div>
      <div class="history-actions">
        <button class="small-action" type="button" data-action="rename" aria-label="Editar nome do treino">Editar</button>
        <button class="danger" type="button" data-action="delete" aria-label="Excluir treino">×</button>
      </div>
    `;
    item.querySelector('[data-action="rename"]').addEventListener("click", () => renameRecord(record.id));
    item.querySelector('[data-action="delete"]').addEventListener("click", () => deleteRecord(record.id));
    els.historyList.appendChild(item);
  });
}

function renameRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;

  const newName = prompt("Novo nome para este treino salvo:", record.workoutName);
  if (newName === null) return;

  const trimmedName = newName.trim();
  if (!trimmedName) {
    alert("O nome do treino não pode ficar vazio.");
    return;
  }

  record.workoutName = trimmedName;
  persistRecords();
  renderSequence();
  renderHistory();
  renderCharts();
  renderWorkout();
  updateSummary();
}

function deleteRecord(id) {
  if (!confirm("Excluir este treino do histórico?")) return;
  state.records = state.records.filter((record) => record.id !== id);
  persistRecords();
  renderSequence();
  renderHistory();
  renderCharts();
  renderWorkout();
  updateSummary();
}

function renderSequence() {
  const recent = getRecentRecords(1);
  const last = recent[0];
  const nextKey = last ? getNextWorkoutKey(last.workoutKey) : state.workoutKey;

  els.lastWorkoutName.textContent = last ? `${last.workoutName} em ${formatDate(last.date)}` : "-";
  els.nextWorkoutName.textContent = WORKOUTS[nextKey]?.name || "-";
  renderWorkoutMarkers(last?.workoutKey);
}

function renderWorkoutMarkers(lastWorkoutKey) {
  document.querySelectorAll("[data-workout]").forEach((button) => {
    button.classList.toggle("is-last-done", button.dataset.workout === lastWorkoutKey);
  });
}

function renderCharts() {
  renderWorkoutVolumeOptions();
  renderExerciseOptions();
  renderVolumeChart();
  renderExerciseChart();
}

function renderWorkoutVolumeOptions() {
  const selected = els.workoutChartSelect.value || state.workoutKey;

  els.workoutChartSelect.innerHTML = "";
  Object.entries(WORKOUTS).forEach(([key, workout]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = workout.name;
    els.workoutChartSelect.appendChild(option);
  });

  els.workoutChartSelect.value = WORKOUTS[selected] ? selected : state.workoutKey;
}

function renderExerciseOptions() {
  const selected = els.exerciseChartSelect.value;
  const names = new Set();

  Object.values(WORKOUTS).forEach((workout) => {
    workout.exercises.forEach((exercise) => names.add(exercise));
  });

  state.records.forEach((record) => {
    record.exercises.forEach((exercise) => names.add(exercise.name));
  });

  els.exerciseChartSelect.innerHTML = "";
  [...names].sort((a, b) => a.localeCompare(b, "pt-BR")).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.exerciseChartSelect.appendChild(option);
  });

  if ([...names].includes(selected)) {
    els.exerciseChartSelect.value = selected;
  } else {
    els.exerciseChartSelect.value = WORKOUTS[state.workoutKey].exercises[0];
  }
}

function renderVolumeChart() {
  clearElement(els.volumeChart);
  els.volumeChartSummary.textContent = "";

  if (!state.records.length) {
    appendEmpty(els.volumeChart, "Salve alguns treinos para ver o volume aqui.");
    return;
  }

  const workoutKey = els.workoutChartSelect.value || state.workoutKey;
  const sessions = [...state.records]
    .filter((record) => record.workoutKey === workoutKey)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.savedAt || "").localeCompare(b.savedAt || ""))
    .map((record) => ({
      label: formatShortDate(record.date),
      date: record.date,
      workout: record.workoutName,
      volume: calculateRecordVolume(record),
    }));

  if (sessions.length < 2) {
    appendEmpty(els.volumeChart, "Esse treino precisa de pelo menos 2 registros para mostrar a progressão.");
    if (sessions.length === 1) {
      els.volumeChartSummary.textContent = `Registro atual: ${formatNumber(sessions[0].volume)} kg.`;
    }
    return;
  }

  const best = Math.max(...sessions.map((session) => session.volume));
  const last = sessions[sessions.length - 1];
  const first = sessions[0];
  const delta = last.volume - first.volume;
  els.volumeChartSummary.textContent =
    `Maior volume: ${formatNumber(best)} kg. Evolução no período: ${formatSignedNumber(delta)} kg.`;

  drawLineChart(els.volumeChart, pickChartHistoryPoints(sessions.map((session) => ({
    date: session.date,
    value: session.volume,
  }))), "Volume do treino");
}

function renderExerciseChart() {
  clearElement(els.exerciseChart);
  els.exerciseChartSummary.textContent = "";

  const exerciseName = els.exerciseChartSelect.value;
  const points = getExerciseProgress(exerciseName);

  if (points.length < 2) {
    appendEmpty(els.exerciseChart, "Esse exercicio precisa de pelo menos 2 registros para formar um grafico.");
    if (points.length === 1) {
      els.exerciseChartSummary.textContent = `Registro atual: ${formatNumber(points[0].weight)} kg.`;
    }
    return;
  }

  const best = Math.max(...points.map((point) => point.weight));
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.weight - first.weight;
  els.exerciseChartSummary.textContent =
    `Melhor carga: ${formatNumber(best)} kg. Evolucao no periodo: ${formatSignedNumber(delta)} kg.`;

  drawLineChart(els.exerciseChart, pickChartHistoryPoints(points.map((point) => ({
    date: point.date,
    value: point.weight,
  }))), "Carga do exercício");
}

function pickChartHistoryPoints(points) {
  if (points.length <= 3) return points;
  return [points[0], points[points.length - 2], points[points.length - 1]];
}

function drawLineChart(container, points, ariaLabel) {
  const width = 420;
  const height = 188;
  const padding = { top: 28, right: 52, bottom: 42, left: 52 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const spread = Math.max(maxValue - minValue, 1);

  const coords = points.map((point, index) => {
    const x = padding.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth);
    const y = padding.top + chartHeight - ((point.value - minValue) / spread) * chartHeight;
    return { ...point, x, y };
  });

  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const baseY = padding.top + chartHeight;
  const areaPath = `${path} L ${coords[coords.length - 1].x} ${baseY} L ${coords[0].x} ${baseY} Z`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", ariaLabel);

  [0, 0.5, 1].forEach((ratio) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const y = padding.top + chartHeight * ratio;
    line.setAttribute("x1", padding.left);
    line.setAttribute("x2", width - padding.right);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    line.setAttribute("class", "line-grid");
    svg.appendChild(line);
  });

  const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
  area.setAttribute("d", areaPath);
  area.setAttribute("class", "line-area");
  svg.appendChild(area);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", path);
  line.setAttribute("class", "line-path");
  svg.appendChild(line);

  coords.forEach((point, index) => {
    const isFirst = index === 0;
    const isLast = index === coords.length - 1;
    const labelAnchor = isFirst ? "start" : isLast ? "end" : "middle";
    const labelX = isFirst ? point.x + 2 : isLast ? point.x - 2 : point.x;

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", point.x);
    circle.setAttribute("cy", point.y);
    circle.setAttribute("r", "5");
    circle.setAttribute("class", "line-point");
    svg.appendChild(circle);

    const value = document.createElementNS("http://www.w3.org/2000/svg", "text");
    value.setAttribute("x", labelX);
    value.setAttribute("y", Math.max(13, point.y - 10));
    value.setAttribute("text-anchor", labelAnchor);
    value.setAttribute("class", "point-caption");
    value.textContent = `${formatNumber(point.value)}kg`;
    svg.appendChild(value);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", labelX);
    label.setAttribute("y", height - 16);
    label.setAttribute("text-anchor", labelAnchor);
    label.setAttribute("class", "point-caption");
    label.textContent = formatShortDate(point.date);
    svg.appendChild(label);
  });

  container.appendChild(svg);
}

function exportCsv() {
  if (!state.records.length) {
    alert("Ainda não há histórico para exportar.");
    return;
  }

  const rows = [
    ["data", "treino", "sensacao", "exercicio", "serie", "carga_kg", "reps", "nota"],
  ];

  state.records.forEach((record) => {
    record.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        rows.push([
          record.date,
          record.workoutName,
          record.feeling,
          exercise.name,
          set.label,
          set.weight || "",
          set.reps || "",
          exercise.note || "",
        ]);
      });
    });
  });

  const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `treinos-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function getDailyReportSessions(reportDate) {
  const savedSessions = state.records
    .filter((record) => record.date === reportDate)
    .sort((a, b) => (a.savedAt || "").localeCompare(b.savedAt || ""));

  if (savedSessions.length) return savedSessions;

  const draftSession = collectSession();
  const hasAnySet = draftSession.exercises.some((exercise) =>
    exercise.sets.some((set) => set.weight > 0 || set.reps > 0)
  );

  return hasAnySet && draftSession.date === reportDate ? [draftSession] : [];
}

function buildDailyReportWorkbook(reportTitle, reportDate, sessions) {
  const totalVolume = sessions.reduce((sum, session) => sum + calculateRecordVolume(session), 0);
  const totalSets = sessions.reduce((sum, session) => {
    return sum + session.exercises.flatMap((exercise) => exercise.sets).filter(
      (set) => set.weight > 0 || set.reps > 0
    ).length;
  }, 0);

  const detailRows = sessions.flatMap((session) => {
    return session.exercises.map((exercise) => {
      const warmup = findSet(exercise, "warmup");
      const feeder = findSet(exercise, "feeder");
      const work1 = findSet(exercise, "work1");
      const work2 = findSet(exercise, "work2");
      const exerciseVolume = exercise.sets
        .filter((set) => set.key.startsWith("work"))
        .reduce((sum, set) => sum + set.weight * set.reps, 0);

      return `
        <tr>
          <td>${escapeHtml(formatDate(session.date))}</td>
          <td>${escapeHtml(session.workoutName)}</td>
          <td>${escapeHtml(session.feeling)}</td>
          <td>${escapeHtml(exercise.name)}</td>
          <td>${formatCellNumber(warmup.weight)}</td>
          <td>${formatCellNumber(warmup.reps)}</td>
          <td>${formatCellNumber(feeder.weight)}</td>
          <td>${formatCellNumber(feeder.reps)}</td>
          <td>${formatCellNumber(work1.weight)}</td>
          <td>${formatCellNumber(work1.reps)}</td>
          <td>${formatCellNumber(work2.weight)}</td>
          <td>${formatCellNumber(work2.reps)}</td>
          <td>${formatCellNumber(exerciseVolume)}</td>
          <td>${escapeHtml(exercise.note || "")}</td>
        </tr>
      `;
    }).join("");
  }).join("");

  const sessionRows = sessions.map((session) => `
    <tr>
      <td>${escapeHtml(formatDate(session.date))}</td>
      <td>${escapeHtml(session.workoutName)}</td>
      <td>${escapeHtml(session.feeling)}</td>
      <td>${formatCellNumber(calculateRecordVolume(session))}</td>
      <td>${escapeHtml(session.notes || "")}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; color: #172033; }
      h1 { font-size: 22px; margin: 0 0 6px; }
      h2 { font-size: 16px; margin: 22px 0 8px; }
      .meta { color: #667085; margin-bottom: 14px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 18px; }
      th { background: #0f766e; color: #ffffff; font-weight: 700; }
      th, td { border: 1px solid #d8dee8; padding: 8px; text-align: left; }
      .summary th { background: #172033; }
      .number { text-align: right; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(reportTitle)}</h1>
    <div class="meta">Data do relatório: ${escapeHtml(formatDate(reportDate))}</div>

    <h2>Resumo do dia</h2>
    <table class="summary">
      <tr>
        <th>Data</th>
        <th>Treinos no dia</th>
        <th>Séries preenchidas</th>
        <th>Volume total</th>
      </tr>
      <tr>
        <td>${escapeHtml(formatDate(reportDate))}</td>
        <td>${sessions.length}</td>
        <td class="number">${totalSets}</td>
        <td class="number">${formatCellNumber(totalVolume)} kg</td>
      </tr>
    </table>

    <h2>Treinos registrados</h2>
    <table>
      <tr>
        <th>Data</th>
        <th>Treino</th>
        <th>Sensação</th>
        <th>Volume</th>
        <th>Observação</th>
      </tr>
      ${sessionRows}
    </table>

    <h2>Detalhamento por exercício</h2>
    <table>
      <tr>
        <th>Data</th>
        <th>Treino</th>
        <th>Sensação</th>
        <th>Exercício</th>
        <th>Leve kg</th>
        <th>Leve reps</th>
        <th>Interm. kg</th>
        <th>Interm. reps</th>
        <th>Trab. 1 kg</th>
        <th>Trab. 1 reps</th>
        <th>Trab. 2 kg</th>
        <th>Trab. 2 reps</th>
        <th>Volume exercício</th>
        <th>Nota</th>
      </tr>
      ${detailRows}
    </table>
  </body>
</html>`;
}

function saveDraft() {
  const draft = collectSession();
  draft.reportName = els.reportName.value.trim();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    if (draft.workoutKey && WORKOUTS[draft.workoutKey]) {
      state.workoutKey = draft.workoutKey;
      document.querySelectorAll("[data-workout]").forEach((item) => {
        item.classList.toggle("is-active", item.dataset.workout === state.workoutKey);
      });
    }
    els.sessionDate.value = draft.date || today();
    els.sessionFeeling.value = draft.feeling || "normal";
    els.sessionNotes.value = draft.notes || "";
    els.reportName.value = draft.reportName || "";
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function restoreWorkoutDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    if (draft.workoutKey !== state.workoutKey) return;

    draft.exercises.forEach((exercise) => {
      const card = [...els.exerciseList.querySelectorAll(".exercise-card")].find(
        (candidate) => candidate.dataset.exercise === exercise.name
      );
      if (!card) return;

      exercise.sets.forEach((set) => {
        const weight = card.querySelector(`[data-set="${set.key}"][data-field="weight"]`);
        const reps = card.querySelector(`[data-set="${set.key}"][data-field="reps"]`);
        if (weight) weight.value = set.weight || "";
        if (reps) reps.value = set.reps || "";
      });
      card.querySelector(".exercise-note").value = exercise.note || "";
    });
  } catch {
    localStorage.removeItem(DRAFT_KEY);
  }
}

function findLastExerciseRecord(exerciseName) {
  for (const record of state.records) {
    const exercise = record.exercises.find((item) => item.name === exerciseName);
    if (!exercise) continue;

    const workSets = exercise.sets.filter((set) => set.key.startsWith("work"));
    const completedAllWorkSets = workSets.every((set) => set.reps >= 8 && set.weight > 0);
    const allAtTop = workSets.every((set) => set.reps >= 10 && set.weight > 0);
    const topWeight = Math.max(...workSets.map((set) => set.weight || 0));

    return {
      date: record.date,
      topWeight,
      completedAllWorkSets,
      allAtTop,
    };
  }

  return null;
}

function buildProgressionHint(last) {
  if (last.allAtTop) {
    return `Último: ${formatNumber(last.topWeight)} kg. Pode tentar subir a carga.`;
  }

  if (last.completedAllWorkSets) {
    return `Último: ${formatNumber(last.topWeight)} kg. Mantenha e busque 10 reps.`;
  }

  return `Último: ${formatNumber(last.topWeight)} kg. Repita a carga com execução boa.`;
}

function calculateRecordVolume(record) {
  return record.exercises.reduce((total, exercise) => {
    return total + exercise.sets
      .filter((set) => set.key.startsWith("work"))
      .reduce((sum, set) => sum + set.weight * set.reps, 0);
  }, 0);
}

function getExerciseProgress(exerciseName) {
  return [...state.records]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.savedAt || "").localeCompare(b.savedAt || ""))
    .map((record) => {
      const exercise = record.exercises.find((item) => item.name === exerciseName);
      if (!exercise) return null;

      const workWeights = exercise.sets
        .filter((set) => set.key.startsWith("work") && set.weight > 0)
        .map((set) => set.weight);
      if (!workWeights.length) return null;

      return {
        date: record.date,
        workoutName: record.workoutName,
        weight: Math.max(...workWeights),
      };
    })
    .filter(Boolean);
}

function clearElement(element) {
  element.replaceChildren();
}

function appendEmpty(element, message) {
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = message;
  element.appendChild(empty);
}

function findSet(exercise, setKey) {
  return exercise.sets.find((set) => set.key === setKey) || { weight: 0, reps: 0 };
}

function getRecentRecords(limit) {
  return [...state.records]
    .sort((a, b) => {
      const dateOrder = b.date.localeCompare(a.date);
      if (dateOrder) return dateOrder;
      return (b.savedAt || "").localeCompare(a.savedAt || "");
    })
    .slice(0, limit);
}

function getNextWorkoutKey(workoutKey) {
  const currentIndex = WORKOUT_ORDER.indexOf(workoutKey);
  if (currentIndex === -1) return WORKOUT_ORDER[0];
  return WORKOUT_ORDER[(currentIndex + 1) % WORKOUT_ORDER.length];
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function persistRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function normalizeNumber(value) {
  if (!value) return 0;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value || 0);
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split("-");
  return `${day}/${month}/${year}`;
}

function formatShortDate(dateString) {
  if (!dateString) return "-";
  const [, month, day] = dateString.split("-");
  return `${day}/${month}`;
}

function formatSignedNumber(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatNumber(value)}`;
}

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function escapeCsv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCellNumber(value) {
  return value ? String(value).replace(".", ",") : "";
}

function sanitizeFilename(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || `relatorio-treino-${today()}`;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!location.protocol.startsWith("http")) return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
