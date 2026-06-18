const api = typeof browser !== 'undefined' ? browser : chrome;

// Карта тем для popup
const POPUP_THEMES = {
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

function applyPopupTheme(themeName) {
  const theme = POPUP_THEMES[themeName] || POPUP_THEMES.dark;
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  // Применяем сохранённую тему
  const { theme } = await api.storage.local.get(['theme']);
  applyPopupTheme(theme);

  const textarea = document.getElementById('taskList');
  const scanBtn = document.getElementById('scanBtn');
  const summaryBtn = document.getElementById('summaryBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');
  
  const { taskListText } = await api.storage.local.get(['taskListText']);
  if (taskListText) textarea.value = taskListText;
  
  textarea.addEventListener('input', () => {
    api.storage.local.set({ taskListText: textarea.value });
  });
  
  scanBtn.addEventListener('click', () => {
    const text = textarea.value;
    api.storage.local.set({ taskListText: text });
    scanBtn.disabled = true;
    
    api.runtime.sendMessage({ action: 'startScan', taskListText: text }, (response) => {
      if (response?.success) {
        statusDiv.textContent = 'Сканирование запущено...';
        statusDiv.className = 'status scanning';
      }
      setTimeout(() => { scanBtn.disabled = false; }, 1000);
    });
  });
  
  summaryBtn.addEventListener('click', () => {
    api.tabs.create({ url: api.runtime.getURL('summary.html') });
    window.close();
  });
  
  clearBtn.addEventListener('click', () => {
    if (confirm('Удалить все результаты?')) {
      api.runtime.sendMessage({ action: 'clearAll' }, () => {
        statusDiv.textContent = 'Результаты очищены';
        statusDiv.className = 'status';
      });
    }
  });
  
  function updateStatus() {
    api.runtime.sendMessage({ action: 'getStatus' }, (response) => {
      if (response?.status) {
        statusDiv.textContent = response.status.current;
        statusDiv.className = response.status.isScanning ? 'status scanning' : 
                              response.status.current.includes('Ошибка') ? 'status error' : 'status';
      }
    });
  }
  
  updateStatus();
  setInterval(updateStatus, 1000);
});