// CDP browser verification for v7.17 Daily Bonus widget
// Drives chrome-headless-shell directly (no playwright). Unregisters SW to dodge stale-cache trap,
// navigates to home + profile, clicks CLAIM, asserts coins/persistence.
import http from 'http';

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9338' + path, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { reject(new Error('bad json from ' + path + ': ' + b.slice(0, 120))); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const list = await getJson('/json/list');
  const page = list.find(t => t.type === 'page');
  if (!page) throw new Error('no page target: ' + JSON.stringify(list));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  await new Promise(r => ws.onopen = r);
  const send = (method, params = {}) => new Promise(res => {
    const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails.text));
    return r.result && r.result.result ? r.result.result.value : undefined;
  };

  let pass = 0, fail = 0;
  const check = (name, cond) => { if (cond) { pass++; console.log('  PASS ' + name); } else { fail++; console.log('  FAIL ' + name); } };

  await send('Page.enable');
  await send('Runtime.enable');

  // Navigate to app first (localStorage requires a real origin)
  await send('Page.navigate', { url: 'http://127.0.0.1:8777/index.html' });
  await new Promise(r => setTimeout(r, 2000));

  // Now clear SW + storage on the actual page
  await evalJs(`(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    localStorage.clear();
    return true;
  })()`);
  // Re-navigate to get a clean load with fresh app.js
  await send('Page.navigate', { url: 'http://127.0.0.1:8777/index.html' });
  // wait for boot
  let booted = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 400));
    booted = await evalJs(`!!document.getElementById('heroVersionText') && document.getElementById('heroVersionText').innerText !== 'LOADING...'`);
    if (booted) break;
  }
  check('app boots (heroVersionText loaded)', booted);
  const ver = await evalJs(`document.getElementById('heroVersionText') && document.getElementById('heroVersionText').innerText`);
  console.log('  hero version text: ' + ver);

  // HOME: daily bonus widget present with CLAIM button (fresh day)
  const heroHtml = await evalJs(`document.getElementById('dailyBonusHero') && document.getElementById('dailyBonusHero').innerHTML`);
  check('home #dailyBonusHero rendered', !!heroHtml && heroHtml.includes('DAILY BONUS'));
  const heroClaimBtn = await evalJs(`(document.getElementById('dailyBonusHero')||{}).innerHTML ? document.getElementById('dailyBonusHero').innerHTML.includes('CLAIM') : false`);
  check('home hero shows CLAIM button (day 1, unclaimed)', heroClaimBtn);
  const day1Amt = await evalJs(`(document.getElementById('dailyBonusHero').innerText.match(/CLAIM ([0-9,]+)/)||[])[1]`);
  console.log('  day1 amount shown: ' + day1Amt);

  // CLICK CLAIM
  const coinsBefore = await evalJs(`JSON.parse(localStorage.getItem('rah_coins'))`);
  console.log('  coins before claim: ' + coinsBefore);
  await evalJs(`document.querySelector('#dailyBonusHero button[onclick*="claimDailyBonus"]').click()`);
  await new Promise(r => setTimeout(r, 500));
  const coinsAfter = await evalJs(`JSON.parse(localStorage.getItem('rah_coins'))`);
  check('claim adds coins (' + coinsBefore + ' -> ' + coinsAfter + ')', coinsAfter === coinsBefore + parseInt(String(day1Amt).replace(/,/g, '')));
  const heroAfter = await evalJs(`document.getElementById('dailyBonusHero').innerHTML.includes('CLAIMED')`);
  check('home hero now shows CLAIMED', heroAfter);
  const storedDb = await evalJs(`JSON.parse(localStorage.getItem('rh_dailyBonus') || 'null')`);
  check('rh_dailyBonus persisted: ' + JSON.stringify(storedDb), !!storedDb && storedDb.day === 1 && !!storedDb.lastClaim);
  // double-click guard: after CLAIMED there is no button; try the widget container only if still visible
  const stillBtn = await evalJs(`!!document.querySelector('#dailyBonusHero button[onclick*="claimDailyBonus"]')`);
  if (stillBtn) {
    await evalJs(`document.querySelector('#dailyBonusHero button[onclick*="claimDailyBonus"]').click()`);
    await new Promise(r => setTimeout(r, 300));
  }
  const coinsNoDouble = await evalJs(`JSON.parse(localStorage.getItem('rah_coins'))`);
  check('no double-claim (coins unchanged)', coinsNoDouble === coinsAfter);

  // PROFILE: widget rendered + claims state synced
  await evalJs(`window.go && go('profile')`);
  await new Promise(r => setTimeout(r, 500));
  const profHtml = await evalJs(`document.getElementById('dailyBonusWidget') && document.getElementById('dailyBonusWidget').innerHTML`);
  check('profile #dailyBonusWidget rendered', !!profHtml && profHtml.includes('DAILY BONUS'));
  const profClaimed = await evalJs(`document.getElementById('dailyBonusWidget').innerHTML.includes('CLAIMED')`);
  check('profile widget shows CLAIMED (synced)', profClaimed);

  // no page errors
  const errs = events.filter(e => e.method === 'Runtime.exceptionThrown');
  check('zero runtime exceptions', errs.length === 0);

  console.log(`\nBROWSER VERIFY: ${pass} passed, ${fail} failed`);
  ws.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('FATAL: ' + e.message); process.exit(1); });