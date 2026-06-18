const api = typeof browser !== 'undefined' ? browser : chrome;

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

function getCellColor(pct, colors) {
  if (pct >= 100) return colors[100];
  if (pct > 80) return colors[100];
  if (pct > 60) return colors[80];
  if (pct > 30) return colors[60];
  return colors[30];
}

function hexToArgb(hex) {
  return 'FF' + hex.replace('#', '').toUpperCase();
}

document.addEventListener('DOMContentLoaded', async () => {
  const { allContestsData, theme, colors } = await api.storage.local.get([
    'allContestsData', 'theme', 'colors'
  ]);
  
  const currentTheme = theme || 'dark';
  const currentColors = colors || {
    30: '#e74c3c', 60: '#f39c12', 80: '#7bed9f', 100: '#2ecc71'
  };
  
  applyTheme(currentTheme);
  
  document.getElementById('themeSelect').value = currentTheme;
  document.getElementById('color30').value = currentColors[30];
  document.getElementById('color60').value = currentColors[60];
  document.getElementById('color80').value = currentColors[80];
  document.getElementById('color100').value = currentColors[100];
  
  document.getElementById('exportBtn').addEventListener('click', () => exportToExcel(currentColors));
  document.getElementById('closeBtn').addEventListener('click', () => window.close());
  
  document.getElementById('settingsBtn').addEventListener('click', () => {
    const panel = document.getElementById('settingsPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });
  
  document.getElementById('themeSelect').addEventListener('change', (e) => {
    applyTheme(e.target.value);
    api.storage.local.set({ theme: e.target.value });
  });
  
  ['color30', 'color60', 'color80', 'color100'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      const newColors = {
        30: document.getElementById('color30').value,
        60: document.getElementById('color60').value,
        80: document.getElementById('color80').value,
        100: document.getElementById('color100').value
      };
      api.storage.local.set({ colors: newColors });
      render(allContestsData || [], newColors);
    });
  });
  
  const contests = allContestsData || [];
  if (contests.length === 0) {
    document.getElementById('contestsContainer').innerHTML = 
      '<div class="empty">Нет данных. Добавьте задачи в popup и нажмите "Сканировать".</div>';
    return;
  }
  
  render(contests, currentColors);
});

function render(contests, colors) {
  const container = document.getElementById('contestsContainer');
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
    
    section.innerHTML = `
      <div class="contest-header">
        <h2>${contest.title}</h2>
        <div class="contest-meta">
          Задач: ${contest.problems.length} | 
          Сумма баллов: <b>${contestScore}</b> |
          Дельта: <b style="color: #ffa502;">+${contestDelta}</b> |
          Посылок: ${contest.totalSubmissions} |
          Дата: ${new Date(contest.timestamp).toLocaleString('ru-RU')}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Задача</th>
            <th>Тур (09:00-13:59)</th>
            <th>Дорешка</th>
            <th>Дельта</th>
            <th>Максимум</th>
          </tr>
        </thead>
      </table>
    `;
    
    const table = section.querySelector('table');
    const tbody = document.createElement('tbody');
    
    contest.problems.forEach(p => {
      const total = Math.max(p.maxTour, p.maxUpsolve);
      const delta = p.delta || 0;
      const color = getCellColor(total, colors);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><a href="${p.url}" target="_blank">${p.name}</a></td>
        <td class="score-tour" style="background: ${getCellColor(p.maxTour, colors)}30;">${p.maxTour}</td>
        <td class="score-upsolve" style="background: ${getCellColor(p.maxUpsolve, colors)}30;">${p.maxUpsolve}</td>
        <td class="score-delta">${delta > 0 ? '+' + delta : delta}</td>
        <td style="background: ${color}; color: white; font-weight: bold; text-align: center;">${total}</td>
      `;
      tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
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
}

// === ЭКСПОРТ В XLSX С ЦВЕТАМИ ===
async function exportToExcel(colors) {
  if (!window.allContests || window.allContests.length === 0) {
    alert('Нет данных для экспорта');
    return;
  }
  
  if (typeof ExcelJS === 'undefined') {
    alert('❌ Библиотека ExcelJS не загружена!\n\nПоложите файл exceljs.min.js в папку расширения рядом с summary.html.');
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
    
    // Стили
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
    };
    
    // Заголовок
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell(cell => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
    
    // Данные
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
        tourCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(getCellColor(p.maxTour, colors)) } };
        tourCell.font = { bold: true };
        tourCell.alignment = { horizontal: 'center', vertical: 'middle' };
        tourCell.border = thinBorder;
        
        // Дорешка
        const upsolveCell = row.getCell('upsolve');
        upsolveCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(getCellColor(p.maxUpsolve, colors)) } };
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
        totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(getCellColor(total, colors)) } };
        totalCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
        totalCell.border = thinBorder;
        
        // Обычные ячейки
        ['contest', 'problem', 'url'].forEach(key => {
          const cell = row.getCell(key);
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle' };
        });
        
        // Кликабельная ссылка
        const urlCell = row.getCell('url');
        urlCell.value = { text: p.url, hyperlink: p.url };
        urlCell.font = { color: { argb: 'FF0000FF' }, underline: true };
      });
    });
    
    // Скачивание
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