(function() {
  'use strict';
  
  window.__informaticsAnalyzerReady = true;

  function parseScore(scoreStr) {
    if (!scoreStr) return 0;
    scoreStr = scoreStr.trim();
    if (/^(ok|зачтено|accepted)$/i.test(scoreStr)) return 100;
    const fractionMatch = scoreStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*\d+/);
    if (fractionMatch) return parseFloat(fractionMatch[1]);
    const numMatch = scoreStr.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) return parseFloat(numMatch[1]);
    return 0;
  }

  function getSubmissionType(dateStr) {
    const date = new Date(dateStr + '+00:00');
    if (isNaN(date.getTime())) return 'Неизвестно';
    const mskHours = (date.getUTCHours() + 3) % 24;
    return (mskHours >= 9 && mskHours < 14) ? 'На туре' : 'Дорешка';
  }

  function extractProblemName(doc) {
    const text = doc.body?.innerText || '';
    const match = text.match(/Задача\s*№\s*(\d+)[.\s]+([^\n]+)/i);
    if (match) {
      return `Задача №${match[1]}. ${match[2].trim()}`;
    }
    return null;
  }

  function parseTableFromDoc(doc) {
    const tables = doc.querySelectorAll('table');
    let targetTable = null;
    let targetHeaders = [];

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const headers = Array.from(table.querySelectorAll('th, tr:first-child td'))
        .map(th => th.innerText.trim().toLowerCase());
      
      const hasDate = headers.some(h => h.includes('дата') || h.includes('время'));
      const hasScore = headers.some(h => h.includes('балл') || h.includes('результат'));
      const hasId = headers.some(h => h.includes('id'));
      
      if (hasDate && hasScore && hasId) {
        targetTable = table;
        targetHeaders = headers;
        break;
      }
    }

    if (!targetTable) return [];

    const colId = targetHeaders.findIndex(h => h.includes('id'));
    const colDate = targetHeaders.findIndex(h => h.includes('дата') || h.includes('время'));
    const colScore = targetHeaders.findIndex(h => h.includes('балл') || h.includes('результат'));

    if (colDate === -1 || colScore === -1) return [];

    const rows = targetTable.querySelectorAll('tbody tr, tr');
    const submissions = [];

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].querySelectorAll('td');
      if (cells.length <= Math.max(colDate, colScore)) continue;

      const idStr = colId !== -1 ? cells[colId]?.innerText.trim() : '';
      const dateStr = cells[colDate]?.innerText.trim();
      const scoreStr = cells[colScore]?.innerText.trim() || '0';

      if (!dateStr) continue;

      submissions.push({
        id: idStr,
        date: dateStr,
        type: getSubmissionType(dateStr),
        score: parseScore(scoreStr)
      });
    }

    return submissions;
  }

  function loadInIframe(url) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      
      const separator = url.includes('?') ? '&' : '?';
      const cacheBuster = `_t=${Date.now()}_${Math.random()}`;
      iframe.src = `${url}${separator}${cacheBuster}`;
      
      const timeout = setTimeout(() => {
        try { iframe.remove(); } catch(_) {}
        reject(new Error('Timeout loading iframe'));
      }, 15000);
      
      iframe.onload = () => {
        clearTimeout(timeout);
        setTimeout(() => {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            resolve({ doc, iframe });
          } catch (e) {
            try { iframe.remove(); } catch(_) {}
            reject(new Error('Cannot access iframe: ' + e.message));
          }
        }, 2500);
      };
      
      iframe.onerror = () => {
        clearTimeout(timeout);
        try { iframe.remove(); } catch(_) {}
        reject(new Error('Iframe load error'));
      };
      
      document.body.appendChild(iframe);
    });
  }

  async function scanProblem(chapterId) {
    const baseUrl = `https://informatics.msk.ru/mod/statements/view.php?chapterid=${chapterId}`;
    
    const { doc, iframe } = await loadInIframe(baseUrl);
    
    try {
      const name = extractProblemName(doc) || `Задача ${chapterId}`;
      
      let allSubmissions = parseTableFromDoc(doc);
      let seenIds = new Set(allSubmissions.map(s => s.id).filter(id => id));
      
      iframe.remove();
      
      if (allSubmissions.length === 0) {
        return {
          chapterId, name, url: baseUrl,
          maxTour: 0, maxUpsolve: 0, delta: 0, totalSubmissions: 0
        };
      }
      
      for (let page = 2; page <= 20; page++) {
        const pageUrl = `${baseUrl}#${page}`;
        
        try {
          const { doc: pageDoc, iframe: pageIframe } = await loadInIframe(pageUrl);
          const pageSubmissions = parseTableFromDoc(pageDoc);
          pageIframe.remove();
          
          if (pageSubmissions.length === 0) break;
          
          let newCount = 0;
          for (const sub of pageSubmissions) {
            if (sub.id && !seenIds.has(sub.id)) {
              seenIds.add(sub.id);
              allSubmissions.push(sub);
              newCount++;
            } else if (!sub.id) {
              allSubmissions.push(sub);
              newCount++;
            }
          }
          
          if (newCount === 0) break;
          
        } catch (e) {
          break;
        }
        await new Promise(r => setTimeout(r, 300));
      }
      
      let maxTour = 0, maxUpsolve = 0;
      allSubmissions.forEach(sub => {
        if (sub.type === 'На туре') {
          maxTour = Math.max(maxTour, sub.score);
        } else if (sub.type === 'Дорешка') {
          maxUpsolve = Math.max(maxUpsolve, sub.score);
        }
      });
      
      const delta = Math.max(maxUpsolve - maxTour, 0);
      
      return {
        chapterId, name, url: baseUrl,
        maxTour, maxUpsolve, delta,
        totalSubmissions: allSubmissions.length
      };
    } catch (e) {
      try { iframe.remove(); } catch(_) {}
      throw e;
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'ping') {
      sendResponse({ ready: true });
      return true;
    }

    if (request.action === 'scanProblem') {
      scanProblem(request.chapterId)
        .then(result => sendResponse({ success: true, result: result }))
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;
    }
  });
})();