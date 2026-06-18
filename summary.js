const api = typeof browser !== 'undefined' ? browser : chrome;

// === ТЕМЫ ===
const themes = {
  dark: {
    '--bg-primary': '#1a1a2e', '--bg-secondary': '#16213e',
    '--text-primary': '#eaeaea', '--text-secondary': '#a0a0a0',
    '--accent': '#0f3460', '--border': '#2a2a4e'
  },
  light: {
    '--bg-primary': '#ffffff', '--bg-secondary': '#f8f9fa',
    '--text-primary': '#212529', '--text-secondary': '#6c757d',
    '--accent': '#e7f5ff', '--border': '#dee2e6'
  },
  space: {
    '--bg-primary': '#050714', '--bg-secondary': '#0b0f2a',
    '--text-primary': '#e0f2fe', '--text-secondary': '#94a3b8',
    '--accent': '#1e3a8a', '--border': '#334155'
  },
  neon: {
    '--bg-primary': '#020617', '--bg-secondary': '#0f172a',
    '--text-primary': '#38bdf8', '--text-secondary': '#7dd3fc',
    '--accent': '#1d4ed8', '--border': '#0ea5e9'
  },
  gray: {
    '--bg-primary': '#2d2d2d', '--bg-secondary': '#3d3d3d',
    '--text-primary': '#e0e0e0', '--text-secondary': '#a0a0a0',
    '--accent': '#4d4d4d', '--border': '#5d5d5d'
  }
};

// === ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ ===
const DEFAULT_THRESHOLDS = [25, 50, 75, 99];
const DEFAULT_COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#7bed9f', '#2ecc71'];

function applyTheme(themeName) {
  const theme = themes[themeName] || themes.dark;
  const root = document.documentElement;
  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  if (themeName === 'neon') {
    root.style.setProperty('--glow-color', '0 0 8px #0ea5e9');
    root.style.setProperty('--glow-text', '0 0 4px #38bdf8');
  } else {
    root.style.setProperty('--glow-color', 'none');
    root.style.setProperty('--glow-text', 'none');
  }
}

// === ОПРЕДЕЛЕНИЕ ЦВЕТА ПО ПРОЦЕНТУ ===
// thresholds: [p1, p2, p3, p4] — 4 порога
// colors: [c0, c1, c2, c3, c4] — 5 цветов
function getCellColor(pct, colors, thresholds) {
  const [p1, p2, p3, p4] = thresholds;
  if (pct >= 100) return colors[4];
  if (pct >= p4) return colors[3];
  if (pct >= p3) return colors[2];
  if (pct >= p2) return colors[1];
  if (pct >= p1) return colors[0];
  return colors[0]; // ниже первого порога — самый "плохой" цвет
}

function hexToArgb(hex) {
  return 'FF' + hex.replace('#', '').toUpperCase();
}

// === ГЛАВНАЯ ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
  const data = await api.storage.local.get([
    'allContestsData', 'theme', 'thresholds', 'colors'
  ]);
  
  const currentTheme = data.theme || 'dark';
  const currentThresholds = data.thresholds || DEFAULT_THRESHOLDS.slice();
  const currentColors = data.colors || DEFAULT_COLORS.slice();
  
  applyTheme(currentTheme);
  
  // Инициализация UI настроек
  document.getElementById('themeSelect').value = currentTheme;
  
  // Загрузка порогов
  document.getElementById('th1').value = currentThresholds[0];
  document.getElementById('th2').value = currentThresholds[1];
  document.getElementById('th3').value = currentThresholds[2];
  document.getElementById('th4').value = currentThresholds[3];
  
  // Загрузка цветов
  document.getElementById('color0').value = currentColors[0];
  document.getElementById('color1').value = currentColors[1];
  document.getElementById('color2').value = currentColors[2];
  document.getElementById('color3').value = currentColors[3];
  document.getElementById('color4').value = currentColors[4];
  
  // Обновление подписей диапазонов
  updateRangeLabels(currentThresholds);
  
  // === ОБРАБОТЧИКИ НАСТРОЕК ===
  
  // Тема
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    applyTheme(e.target.value);
    api.storage.local.set({ theme: e.target.value });
  });
  
  // Пороги
  ['th1', 'th2', 'th3', 'th4'].forEach(id => {
    document.getElementById(id).addEventListener('change', saveThresholds);
  });
  
  // Цвета
  ['color0', 'color1', 'color2', 'color3', 'color4'].forEach(id => {
    document.getElementById(id).addEventListener('input', saveColors);
  });
  
  // Сброс порогов
  document.getElementById('resetThresholds').addEventListener('click', () => {
    document.getElementById('th1').value = DEFAULT_THRESHOLDS[0];
    document.getElementById('th2').value = DEFAULT_THRESHOLDS[1];
    document.getElementById('th3').value = DEFAULT_THRESHOLDS[2];
    document.getElementById('th4').value = DEFAULT_THRESHOLDS[3];
    saveThresholds();
  });
  
  // Сброс цветов
  document.getElementById('resetColors').addEventListener('click', () => {
    document.getElementById('color0').value = DEFAULT_COLORS[0];
    document.getElementById('color1').value = DEFAULT_COLORS[1];
    document.getElementById('color2').value = DEFAULT_COLORS[2];
    document.getElementById('color3').value = DEFAULT_COLORS[3];
    document.getElementById('color4').value = DEFAULT_COLORS[4];
    saveColors();
  });
  
  // Кнопки управления
  document.getElementById('exportBtn').addEventListener('click', () => {
    exportToExcel(getCurrentColors(), getCurrentThresholds());
  });
  document.getElementById('closeBtn').addEventListener('click', () => window.close());
  document.getElementById('settingsBtn').addEventListener('click', () => {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  
  // Рендер данных
  const contests = data.allContestsData || [];
  if (contests.length === 0) {
    document.getElementById('contestsContainer').innerHTML = 
      '<div class="empty">Нет данных. Добавьте задачи в popup и нажмите "Сканировать".</div>';
    return;
  }
  
  render(contests, currentColors, currentThresholds);
});

// === ПОЛУЧЕНИЕ ТЕКУЩИХ ЗНАЧЕНИЙ ИЗ UI ===
function getCurrentThresholds() {
  let t1 = parseInt(document.getElementById('th1').value) || 25;
  let t2 = parseInt(document.getElementById('th2').value) || 50;
  let t3 = parseInt(document.getElementById('th3').value) || 75;
  let t4 = parseInt(document.getElementById('th4').value) || 99;
  
  // Валидация: пороги должны идти по возрастанию
  if (t1 >= t2) t2 = t1 + 1;
  if (t2 >= t3) t3 = t2 + 1;
  if (t3 >= t4) t4 = t3 + 1;
  if (t4 >= 100) t4 = 99;
  
  return [t1, t2, t3, t4];
}

function getCurrentColors() {
  return [
    document.getElementById('color0').value,
    document.getElementById('color1').value,
    document.getElementById('color2').value,
    document.getElementById('color3').value,
    document.getElementById('color4').value
  ];
}

// === СОХРАНЕНИЕ НАСТРОЕК ===
function saveThresholds() {
  const thresholds = getCurrentThresholds();
  // Обновляем поля, если была авто-коррекция
  document.getElementById('th1').value = thresholds[0];
  document.getElementById('th2').value = thresholds[1];
  document.getElementById('th3').value = thresholds[2];
  document.getElementById('th4').value = thresholds[3];
  
  updateRangeLabels(thresholds);
  api.storage.local.set({ thresholds });
  
  // Перерисовка таблицы
  const { allContestsData, colors } = getCurrentData();
  if (allContestsData.length > 0) {
    render(allContestsData, colors, thresholds);
  }
}

function saveColors() {
  const colors = getCurrentColors();
  api.storage.local.set({ colors });
  
  const { allContestsData, thresholds } = getCurrentData();
  if (allContestsData.length > 0) {
    render(allContestsData, colors, thresholds);
  }
}

async function getCurrentData() {
  const data = await api.storage.local.get(['allContestsData', 'thresholds', 'colors']);
  return {
    allContestsData: data.allContestsData || [],
    thresholds: data.thresholds || DEFAULT_THRESHOLDS.slice(),
    colors: data.colors || DEFAULT_COLORS.slice()
  };
}

function updateRangeLabels(thresholds) {
  const [t1, t2, t3, t4] = thresholds;
  document.getElementById('lbl1').textContent = t1;
  document.getElementById('lbl2').textContent = t1;
  document.getElementById('lbl3').textContent = t2;
  document.getElementById('lbl4').textContent = t2;
  document.getElementById('lbl5').textContent = t3;
  document.getElementById('lbl6').textContent = t3;
  document.getElementById('lbl7').textContent = t4;
}

// === РЕНДЕР ТАБЛИЦЫ ===
function render(contests, colors, thresholds) {
  const container = document.getElementById('contestsContainer');
  if (!container) return;
  container.innerHTML = '';
  
  let totalSubmissions = 0, totalProblems = 0, totalScore = 0, totalDelta = 0;
  
  contests.forEach(contest => {
    totalSubmissions += contest.totalSubmissions;
    totalProblems += contest.problems.length;
    
    let contestScore = 0, contestDelta = 0;
    contest.problems.forEach(p => {
      contestScore += Math.max(p.maxTour, p.maxUpsolve);
      contestDelta += p.delta || 0;
    });
    totalScore += contestScore;
    totalDelta += contestDelta;
    
    const section = document.createElement('div');
    section.className = 'contest-section';
    
    const header = document.createElement('div');
    header.className = 'contest-header';
    
    const h2 = document.createElement('h2');
    h2.textContent = contest.title;
    header.appendChild(h2);
    
    const meta = document.createElement('div');
    meta.className = 'contest-meta';
    meta.innerHTML = `
      Задач: ${contest.problems.length} | 
      Сумма баллов: <b>${contestScore}</b> |
      Дельта: <b style="color: #ffa502;">+${contestDelta}</b> |
      Посылок: ${contest.totalSubmissions} |
      Дата: ${new Date(contest.timestamp).toLocaleString('ru-RU')}
    `;
    header.appendChild(meta);
    section.appendChild(header);
    
    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Задача</th>
          <th>Тур (09:00-13:59)</th>
          <th>Дорешка</th>
          <th>Дельта</th>
          <th>Максимум</th>
        </tr>
      </thead>
    `;
    
    const tbody = document.createElement('tbody');
    
    contest.problems.forEach(p => {
      const total = Math.max(p.maxTour, p.maxUpsolve);
      const delta = p.delta || 0;
      
      const tr = document.createElement('tr');
      
      const tdName = document.createElement('td');
      const link = document.createElement('a');
      link.href = p.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = p.name;
      tdName.appendChild(link);
      tr.appendChild(tdName);
      
      const tdTour = document.createElement('td');
      tdTour.className = 'score-tour';
      tdTour.style.background = getCellColor(p.maxTour, colors, thresholds) + '30';
      tdTour.textContent = p.maxTour;
      tr.appendChild(tdTour);
      
      const tdUpsolve = document.createElement('td');
      tdUpsolve.className = 'score-upsolve';
      tdUpsolve.style.background = getCellColor(p.maxUpsolve, colors, thresholds) + '30';
      tdUpsolve.textContent = p.maxUpsolve;
      tr.appendChild(tdUpsolve);
      
      const tdDelta = document.createElement('td');
      tdDelta.className = 'score-delta';
      tdDelta.textContent = delta > 0 ? '+' + delta : delta;
      tr.appendChild(tdDelta);
      
      const tdTotal = document.createElement('td');
      tdTotal.style.background = getCellColor(total, colors, thresholds);
      tdTotal.style.color = 'white';
      tdTotal.style.fontWeight = 'bold';
      tdTotal.style.textAlign = 'center';
      tdTotal.textContent = total;
      tr.appendChild(tdTotal);
      
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    section.appendChild(table);
    container.appendChild(section);
  });
  
  document.getElementById('totalSummary').innerHTML = `
    <strong>Всего туров:</strong> ${contests.length} | 
    <strong>Задач:</strong> ${totalProblems} | 
    <strong>Посылок:</strong> ${totalSubmissions} | 
    <strong>Сумма баллов:</strong> <b>${totalScore}</b> |
    <strong>Общая дельта:</strong> <b style="color: #ffa502;">+${totalDelta}</b>
  `;
  
  window.allContests = contests;
  window.currentColors = colors;
  window.currentThresholds = thresholds;
}

// === ЭКСПОРТ В XLSX ===
async function exportToExcel(colors, thresholds) {
  if (!window.allContests || window.allContests.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }
  
  if (typeof ExcelJS === 'undefined') {
    alert('❌ Библиотека ExcelJS не загружена!\n\nПоложите файл exceljs.min.js в папку расширения.');
    return;
  }
  
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Informatics Analyzer';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('Результаты');
    
    worksheet.columns = [
      { header: 'Тур', key: 'contest', width: 25 },
      { header: 'Задача', key: 'problem', width: 40 },
      { header: 'Ссылка', key: 'url', width: 50 },
      { header: 'Тур (09-14)', key: 'tour', width: 14 },
      { header: 'Дорешка', key: 'upsolve', width: 14 },
      { header: 'Дельта', key: 'delta', width: 12 },
      { header: 'Максимум', key: 'total', width: 14 }
    ];
    
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
    
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
    
    window.allContests.forEach(contest => {
      contest.problems.forEach(p => {
        const total = Math.max(p.maxTour, p.maxUpsolve);
        const delta = p.delta || 0;
        
        const row = worksheet.addRow({
          contest: contest.title,
          problem: p.name,
          url: p.url,
          tour: p.maxTour,
          upsolve: p.maxUpsolve,
          delta: delta,
          total: total
        });
        
        // Тур
        const tourCell = row.getCell('tour');
        tourCell.fill = { type: 'pattern', pattern: 'solid', 
          fgColor: { argb: hexToArgb(getCellColor(p.maxTour, colors, thresholds)) } };
        tourCell.font = { bold: true };
        tourCell.alignment = { horizontal: 'center', vertical: 'middle' };
        tourCell.border = thinBorder;
        
        // Дорешка
        const upsolveCell = row.getCell('upsolve');
        upsolveCell.fill = { type: 'pattern', pattern: 'solid', 
          fgColor: { argb: hexToArgb(getCellColor(p.maxUpsolve, colors, thresholds)) } };
        upsolveCell.font = { bold: true };
        upsolveCell.alignment = { horizontal: 'center', vertical: 'middle' };
        upsolveCell.border = thinBorder;
        
        // Дельта
        const deltaCell = row.getCell('delta');
        deltaCell.font = { bold: true, color: { argb: 'FFFFA500' } };
        deltaCell.alignment = { horizontal: 'center', vertical: 'middle' };
        deltaCell.border = thinBorder;
        
        // Максимум
        const totalCell = row.getCell('total');
        totalCell.fill = { type: 'pattern', pattern: 'solid', 
          fgColor: { argb: hexToArgb(getCellColor(total, colors, thresholds)) } };
        totalCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totalCell.border = thinBorder;
        
        // Обычные ячейки
        ['contest', 'problem', 'url'].forEach(key => {
          const cell = row.getCell(key);
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle' };
        });
        
        const urlCell = row.getCell('url');
        urlCell.value = { text: p.url, hyperlink: p.url };
        urlCell.font = { color: { argb: 'FF0000FF' }, underline: true };
      });
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informatics_${Date.now()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Ошибка экспорта:', error);
    alert('❌ Ошибка при создании Excel файла:\n' + error.message);
  }
}