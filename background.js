let isScanning = false;
let currentGeneration = 0;

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['taskListText', 'allContestsData'], (result) => {
    const defaults = {};
    if (result.taskListText === undefined) defaults.taskListText = '';
    if (!result.allContestsData) defaults.allContestsData = [];
    if (Object.keys(defaults).length > 0) {
      chrome.storage.local.set(defaults);
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startScan') {
    currentGeneration++;
    startScan(request.taskListText, currentGeneration);
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'getStatus') {
    chrome.storage.local.get(['scanStatus', 'allContestsData'], (result) => {
      sendResponse({
        status: result.scanStatus || { isScanning: false, current: 'Готово' },
        contests: result.allContestsData || []
      });
    });
    return true;
  }
  
  if (request.action === 'clearAll') {
    chrome.storage.local.set({ 
      allContestsData: [], 
      scanStatus: { isScanning: false, current: 'Результаты очищены' } 
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

async function setStatus(text, isScanning = true) {
  await chrome.storage.local.set({ 
    scanStatus: { isScanning, current: text } 
  });
}

function parseTaskList(text) {
  const blocks = text.split('=').map(b => b.trim()).filter(b => b);
  const contests = [];
  
  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length < 2) continue;
    
    const title = lines[0];
    const problemIds = [];
    for (let i = 1; i < lines.length; i++) {
      const match = lines[i].match(/(\d+)/);
      if (match) problemIds.push(match[1]);
    }
    
    if (problemIds.length > 0) {
      contests.push({ title, problemIds });
    }
  }
  
  return contests;
}

// Ждёт полной загрузки вкладки
function waitForTabLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Timeout'));
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
    
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('Tab not found'));
        return;
      }
      if (tab && tab.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}

// Создаёт вкладку, ждёт загрузки, инжектит content script
async function prepareTab() {
  console.log('[BG] Creating new tab...');
  
  // Создаём новую вкладку
  const tab = await chrome.tabs.create({ 
    url: 'https://informatics.msk.ru/', 
    active: true 
  });
  
  console.log('[BG] Tab created, id:', tab.id);
  
  // Ждём полной загрузки
  await waitForTabLoad(tab.id);
  console.log('[BG] Tab loaded');
  
  // Даём время на инициализацию страницы
  await new Promise(r => setTimeout(r, 2000));
  
  // Инжектим content script
  console.log('[BG] Injecting content script...');
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
  
  // Ждём инициализации
  await new Promise(r => setTimeout(r, 1000));
  
  // Проверяем ping
  for (let i = 0; i < 5; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      if (response && response.ready) {
        console.log('[BG] ✅ Content script ready');
        return tab.id;
      }
    } catch (e) {
      console.log(`[BG] Ping attempt ${i+1} failed, retrying...`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  
  throw new Error('Content script не ответил. Убедитесь, что вы авторизованы на informatics.msk.ru');
}

async function startScan(taskListText, generation) {
  if (isScanning) {
    await setStatus('Уже сканируется...');
    return;
  }
  
  isScanning = true;
  
  try {
    const contests = parseTaskList(taskListText);
    
    if (contests.length === 0) {
      await setStatus('Список задач пуст или неверный формат', false);
      isScanning = false;
      return;
    }
    
    await setStatus(`Найдено туров: ${contests.length}. Подготовка вкладки...`);
    
    // Готовим вкладку
    const tabId = await prepareTab();
    
    const allContestsData = [];
    
    for (const contest of contests) {
      if (currentGeneration !== generation) {
        await setStatus('Сканирование отменено', false);
        isScanning = false;
        return;
      }
      
      await setStatus(`Тур "${contest.title}": сканирование ${contest.problemIds.length} задач...`);
      
      const problems = [];
      for (let i = 0; i < contest.problemIds.length; i++) {
        if (currentGeneration !== generation) {
          isScanning = false;
          return;
        }
        
        const chapterId = contest.problemIds[i];
        await setStatus(`Тур "${contest.title}": задача ${i+1}/${contest.problemIds.length} (ID: ${chapterId})`);
        
        try {
          const response = await chrome.tabs.sendMessage(tabId, {
            action: 'scanProblem',
            chapterId: chapterId
          });
          
          if (response && response.success && response.result) {
            problems.push(response.result);
            console.log(`[BG] ✅ ${response.result.name}: тур=${response.result.maxTour}, дорешка=${response.result.maxUpsolve}`);
          } else {
            throw new Error(response?.error || 'Неизвестная ошибка');
          }
        } catch (e) {
          console.error(`[BG] Error scanning ${chapterId}:`, e);
          problems.push({
            chapterId,
            name: `Ошибка: ${e.message}`,
            url: `https://informatics.msk.ru/mod/statements/view.php?chapterid=${chapterId}`,
            maxTour: 0,
            maxUpsolve: 0,
            totalSubmissions: 0
          });
        }
        
        await new Promise(r => setTimeout(r, 300));
      }
      
      allContestsData.push({
        title: contest.title,
        timestamp: new Date().toISOString(),
        problems,
        totalSubmissions: problems.reduce((s, p) => s + p.totalSubmissions, 0)
      });
    }
    
    await chrome.storage.local.set({ allContestsData });
    await setStatus(`✅ Готово! Просканировано туров: ${contests.length}`, false);
    
  } catch (error) {
    console.error('[BG] Scan error:', error);
    await setStatus(`❌ Ошибка: ${error.message}`, false);
  }
  
  isScanning = false;
}