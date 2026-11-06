'use strict';
// Slide navigation, the controls on each slide, and the render loop.
const $ = id => document.getElementById(id);
const slides = [...document.querySelectorAll('#panel > section')];
const ids = slides.map(s => s.id);
const stage = $('stage'), panel = $('panel'), dotsEl = $('dots'), prevBtn = $('prev'), nextBtn = $('next');
let current = -1;

/* ---------- navigation ---------- */
ids.forEach((id, k) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.title = slides[k].dataset.title;
  b.setAttribute('aria-label', (k + 1) + '. ' + slides[k].dataset.title);
  b.addEventListener('click', () => go(k));
  dotsEl.append(b);
});
const indexOfHash = () => Math.max(0, ids.indexOf(location.hash.slice(1)));
function go(k) {
  k = (k + ids.length) % ids.length;
  if (location.hash.slice(1) !== ids[k]) location.hash = ids[k];
  else show(k);
}
function show(k) {
  if (k === current) return;
  const hadFocus = slides[current] && slides[current].contains(document.activeElement);
  current = k;
  slides.forEach((s, j) => { s.hidden = j !== k; });
  $('count').textContent = (k + 1) + ' / ' + ids.length;
  [...dotsEl.children].forEach((b, j) => { if (j === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
  prevBtn.disabled = k === 0;
  nextBtn.textContent = k === ids.length - 1 ? 'Voltar ao início' : 'Próximo →';
  canvas.setAttribute('aria-label', slides[k].dataset.scene);
  bakeScene(SCENES[ids[k]]);
  panel.scrollTop = 0;
  if (narrow.matches) window.scrollTo(0, 0);
  if (hadFocus) {
    const heading = slides[k].querySelector('h1, h2');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}
addEventListener('hashchange', () => show(indexOfHash()));
prevBtn.addEventListener('click', () => go(current - 1));
nextBtn.addEventListener('click', () => go(current + 1));
document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(ids.indexOf(b.dataset.go))));
document.addEventListener('keydown', e => {
  if (e.altKey || e.ctrlKey || e.metaKey || e.target.closest('input, select, textarea')) return;
  const tabs = e.target.closest('[role="tablist"]');
  if (tabs && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    const list = [...tabs.querySelectorAll('[role="tab"]')], at = list.indexOf(e.target);
    const to = list[(at + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
    to.focus();
    to.click();
    e.preventDefault();
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(current + 1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); if (current > 0) go(current - 1); }
});
function pressed(selector, key, value) {
  document.querySelectorAll(selector).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key] === value)));
}
const listNf = cases => {
  const names = cases.map(k => 'NF ' + CASES[k].nf + ' (' + CASES[k].obs + ')');
  return names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
};
const pct = (a, b) => Math.round(a / b * 100) + '%';

/* ---------- O que é um agente ---------- */
const INSTR = {
  vagas: 'Analise o documento.',
  claras: 'Verifique se o fornecedor tem cadastro e se o valor passa de R$ 10.000,00. Responda Alerta ou OK e diga o motivo.',
};
const ANSWER = {
  vagas: ['O documento parece normal.', 'bad', 'Errado: o fornecedor não tem cadastro e o valor passa do limite'],
  claras: ['Alerta. Fornecedor sem cadastro e valor acima de R$ 10.000,00.', 'ok', 'Certo'],
};
let answerTimer = 0;
function renderInstr() {
  pressed('[data-instr]', 'instr', UI.instr);
  $('instr-text').textContent = 'Instruções: “' + INSTR[UI.instr] + '”';
}
document.querySelectorAll('[data-instr]').forEach(b => b.addEventListener('click', () => {
  if (UI.instr === b.dataset.instr) return;
  UI.instr = b.dataset.instr;
  if (UI.deliverAt >= 0) {
    UI.deliverAt = -1;
    clearTimeout(answerTimer);
    $('answer').innerHTML = '<span class="muted">Instruções trocadas. Entregue o documento de novo para comparar.</span>';
  }
  renderInstr();
}));
$('deliver').addEventListener('click', () => {
  UI.deliverAt = T;
  UI.delivered = UI.instr;
  $('answer').innerHTML = '<span class="muted">O agente está lendo…</span>';
  clearTimeout(answerTimer);
  answerTimer = setTimeout(() => {
    const [text, kind, verdict] = ANSWER[UI.delivered];
    $('answer').innerHTML = '<b>Resposta:</b> ' + text + ' <span class="tag ' + kind + '">' + verdict + '</span>';
  }, STILL ? 0 : ANSWER_AT * 1000);
});

/* ---------- Monte o seu agente ---------- */
const APP = {
  sm: { faz: 'Verifica se uma situação que você quer acompanhar aparece no caso e responde sim ou não, com o motivo.',
    cena: 'Na cena, a lâmpada fica vermelha quando a situação aparece e verde quando não aparece.' },
  cl: { faz: 'Coloca cada caso em uma das categorias que você definiu.',
    cena: 'Na cena, cada caso cai na caixa da sua categoria.' },
};
const INPUT = {
  arquivos: 'Arquivos: PDFs, planilhas e documentos digitalizados.',
  banco: 'Registros que já estão guardados num banco de dados.',
  cnpj: 'O CNPJ de uma empresa, para analisar os dados ligados a ela.',
};
const EXAMPLE = {
  'sm arquivos': ['contrato_017.pdf', 'Sim. O contrato prevê pagamento adiantado sem garantia.'],
  'sm banco': ['pagamentos de março', 'Não. Nenhum pagamento passou do limite.'],
  'sm cnpj': ['12.345.678/0001-95', 'Sim. A empresa foi aberta 12 dias antes do primeiro contrato.'],
  'cl arquivos': ['contrato_017.pdf', 'Categoria: obras e reformas.'],
  'cl banco': ['despesa nº 4.812', 'Categoria: diárias e passagens.'],
  'cl cnpj': ['12.345.678/0001-95', 'Categoria: comércio varejista.'],
};
function renderBuild() {
  pressed('[data-app]', 'app', UI.app);
  pressed('[data-input]', 'input', UI.input);
  $('build-in').textContent = INPUT[UI.input];
  $('build-do').textContent = APP[UI.app].faz;
  const [entrada, saida] = EXAMPLE[UI.app + ' ' + UI.input];
  $('build-ex').innerHTML = '<span class="muted">' + entrada + ' →</span> ' + saida;
  $('build-scene').textContent = APP[UI.app].cena;
}
document.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => { UI.app = b.dataset.app; renderBuild(); }));
document.querySelectorAll('[data-input]').forEach(b => b.addEventListener('click', () => { UI.input = b.dataset.input; renderBuild(); }));

/* ---------- O padrão ouro ---------- */
const casesEl = $('cases');
CASES.forEach((c, k) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'case';
  b.innerHTML = '<b>NF ' + c.nf + '</b><span>' + c.valor + ' · ' + c.obs + '</span>' +
    '<span class="tag ' + (c.alerta ? 'bad' : 'ok') + '">' + (c.alerta ? 'Alerta' : 'OK') + '</span>';
  b.addEventListener('click', () => {
    if (UI.gold.has(k)) UI.gold.delete(k); else UI.gold.add(k);
    UI.toggled = k;
    UI.toggledAt = T;
    renderGold();
  });
  casesEl.append(b);
});
function renderGold() {
  [...casesEl.children].forEach((b, k) => b.setAttribute('aria-pressed', String(UI.gold.has(k))));
  const picked = [...UI.gold].map(k => CASES[k]);
  $('gold-count').textContent = picked.length;
  let tip = 'Ótimo. Casos variados ensinam mais do que muitos casos parecidos.';
  if (picked.length < 4) tip = 'Poucos casos. O app vai ter pouco com o que comparar.';
  else if (!picked.some(c => c.alerta) || picked.every(c => c.alerta)) tip = 'Inclua casos com as duas respostas, Alerta e OK.';
  else if (!picked.some(c => c.obs === 'cancelada')) tip = 'Bom começo, mas falta um caso raro: nenhuma nota cancelada entrou. Sem ela, o agente não aprende essa exceção.';
  $('gold-tip').textContent = tip;
}
$('gold-all').addEventListener('click', () => {
  CASES.forEach((_, k) => UI.gold.add(k));
  UI.toggled = -1;
  renderGold();
});

/* ---------- Otimização ---------- */
function renderOpt() {
  const r = UI.round, round = ROUNDS[r - 1], ok = 12 - round.wrong.length;
  $('opt-status').innerHTML = '<b>Rodada ' + r + ' de ' + ROUNDS.length + '</b> · ' + ok + ' de 12 acertos (' + pct(ok, 12) + ')';
  $('opt-squares').innerHTML = CASES.map((c, k) => '<i class="' + (round.wrong.includes(k) ? 'bad' : 'ok') + '"></i>').join('');
  let change = 'Primeira tentativa, com uma instrução genérica.';
  if (r > 1) {
    const before = ROUNDS[r - 2].wrong;
    const fixed = before.filter(k => !round.wrong.includes(k)), broke = round.wrong.filter(k => !before.includes(k));
    change = (fixed.length ? 'Passou a acertar: ' + listNf(fixed) + '. ' : '') + (broke.length ? 'Passou a errar: ' + listNf(broke) + '.' : '');
  }
  $('opt-change').textContent = change;
  $('opt-instr').innerHTML = ROUNDS.slice(0, r).map((x, j) => '<li>' + (j === r - 1 && r > 1 ? '<mark>' + x.line + '</mark>' : x.line) + '</li>').join('');
  $('opt-run').disabled = r === ROUNDS.length;
  $('opt-note').hidden = r < ROUNDS.length;
}
$('opt-run').addEventListener('click', () => {
  if (UI.round >= ROUNDS.length) return;
  UI.round++;
  UI.roundAt = T;
  renderOpt();
});
$('opt-reset').addEventListener('click', () => { UI.round = 1; UI.roundAt = T; renderOpt(); });

/* ---------- Colocar para trabalhar ---------- */
document.querySelectorAll('[data-use]').forEach(tab => tab.addEventListener('click', () => {
  UI.use = tab.dataset.use;
  UI.useAt = T;
  document.querySelectorAll('[data-use]').forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute('aria-controls')).hidden = !on;
  });
}));
document.querySelectorAll('[data-use]').forEach(t => { t.tabIndex = t.dataset.use === UI.use ? 0 : -1; });
$('use-answer').innerHTML = '<span class="muted">Clique em Analisar.</span>';
$('use-run').addEventListener('click', () => {
  $('use-answer').innerHTML = '<span class="muted">Analisando…</span>';
  setTimeout(() => {
    $('use-answer').innerHTML = '<b>Resposta:</b> valor de R$ 14.200,00 acima do limite de R$ 10.000,00. <span class="tag bad">Alerta</span>';
  }, STILL ? 0 : 900);
});
const DAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const FREQ = { dia: 'Todo dia', semana: 'Toda segunda-feira', mes: 'Todo dia 1º do mês' };
function nextRun(freq, hour) {
  const now = new Date(), d = new Date(now);
  d.setHours(hour, 0, 0, 0);
  if (freq === 'dia') { if (d <= now) d.setDate(d.getDate() + 1); }
  else if (freq === 'semana') { d.setDate(d.getDate() + (8 - d.getDay()) % 7); if (d <= now) d.setDate(d.getDate() + 7); }
  else { d.setDate(1); if (d <= now) d.setMonth(d.getMonth() + 1); }
  return d;
}
function renderAgenda() {
  const freq = $('freq').value, hour = +$('hora').value, hh = String(hour).padStart(2, '0') + ':00', d = nextRun(freq, hour);
  $('agenda-sum').innerHTML = '<span>' + FREQ[freq] + ' às ' + hh + ', o agente analisa as notas fiscais que chegaram desde a última execução.</span>' +
    '<span class="muted">Próxima execução: ' + DAYS[d.getDay()] + ', ' + d.toLocaleDateString('pt-BR') + ' às ' + hh + '.</span>';
}
$('freq').addEventListener('change', renderAgenda);
$('hora').addEventListener('change', renderAgenda);

/* ---------- Qualidade ao longo do tempo ---------- */
const weekEl = $('week');
function renderWeek() {
  const w = UI.week, score = weekScore(w), low = score < LIMIT;
  weekEl.value = w;
  $('week-read').innerHTML = '<b>Semana ' + w + '</b> · nota ' + score + '% ' +
    (low ? '<span class="tag bad">abaixo do limite de ' + LIMIT + '%</span>' : '<span class="tag ok">dentro do limite de ' + LIMIT + '%</span>');
  let event = 'Até aqui a nota fica estável, perto de 92%.';
  if (UI.fixedAt && w > UI.fixedAt) event = 'Na semana ' + UI.fixedAt + ' o agente foi otimizado de novo, já com casos do modelo novo no padrão ouro. A nota voltou a subir.';
  else if (w >= CHANGE_WEEK) event = 'Na semana ' + CHANGE_WEEK + ' chegou um modelo novo de nota fiscal, e a nota começou a cair.';
  $('week-event').textContent = event;
  $('week-alert').hidden = !low;
}
weekEl.addEventListener('input', () => {
  const w = +weekEl.value;
  if (w === UI.week) return;
  UI.week = w;
  UI.weekAt = T;
  if (w < CHANGE_WEEK) UI.fixedAt = 0; // going back before the change replays the story
  renderWeek();
});
$('week-fix').addEventListener('click', () => {
  UI.fixedAt = Math.min(UI.week, 11);
  UI.week = UI.fixedAt + 1;
  UI.weekAt = T;
  renderWeek();
});

/* ---------- canvas size: whole device pixels per canvas pixel ---------- */
const narrow = matchMedia('(max-width: 860px)');
function fitCanvas() {
  const dpr = window.devicePixelRatio || 1;
  // the island floats on white inside the canvas, so a few cropped pixels at the sides cost nothing
  const room = narrow.matches
    ? Math.min((stage.clientWidth + 40) / W, Math.max(1, innerHeight * .5 / H))
    : Math.min((stage.clientWidth + 40) / W, (stage.clientHeight + 30) / H);
  const scale = Math.max(1, Math.floor(room * dpr)) / dpr;
  canvas.style.width = W * scale + 'px';
  canvas.style.height = H * scale + 'px';
  stage.style.height = narrow.matches ? Math.min(H * scale, stage.clientWidth * H / W + 40) + 'px' : '';
}
new ResizeObserver(fitCanvas).observe(stage);
narrow.addEventListener('change', fitCanvas);

/* ---------- boot ---------- */
renderInstr(); renderBuild(); renderGold(); renderOpt(); renderAgenda(); renderWeek();
fitCanvas();
show(indexOfHash());
let lastStop = -1;
const stopItems = [...document.querySelectorAll('#cycle li')];
function frame(now) {
  T = now / 1000;
  drawFrame(SCENES[ids[current]], T);
  if (ids[current] === 'ciclo' && UI.cycleStop !== lastStop) {
    lastStop = UI.cycleStop;
    stopItems.forEach((li, k) => li.classList.toggle('here', k === lastStop));
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
