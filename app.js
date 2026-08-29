// КБЖКХ калькулятор — состояние, бизнес-логика и рендеринг.
// Полный ре-рендер экрана на каждое изменение состояния (приложение небольшое,
// это проще и надёжнее, чем частичные DOM-патчи); фокус/курсор в полях ввода
// сохраняются явно через rerenderPreservingFocus().

const ICONS = {
  plus: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
  trash: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`,
  back: (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`,
  list: (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>`,
  history: (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>`,
  save: (s = 11) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
  clear: (s = 11) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`,
  gear: (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`
};

const DEFAULT_SETTINGS = { fatMaxPercent: '', proteinMaxPercent: '', caPMaxRatio: '', caloriesMin: '', caloriesMax: '' };

const state = {
  screen: 'main', // main | addPicker | positions | edit | history | settings
  positions: [],
  draftItems: {},
  calcPositionIds: [],
  savedCalcs: [],
  settings: { ...DEFAULT_SETTINGS },
  editForm: null,
  editErrors: {},
  editingId: null,
  confirm: null,
  addSearch: '',
  positionsSearch: '',
  toast: null
};

function numOrNull(v) {
  return v === '' || v === undefined || v === null ? null : Number(v);
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(n) {
  const d = 1;
  const r = Math.round((n || 0) * 10 ** d) / 10 ** d;
  return r.toFixed(d);
}

function genId() {
  return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function formatDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function itemTotals(pos, qty) {
  const w = qty * pos.unitWeight;
  return {
    mass: w,
    calories: w * pos.caloriesPerGram,
    protein: w * (pos.proteinPercent / 100),
    fat: w * (pos.fatPercent / 100),
    calcium: w * (pos.calciumPercent / 100),
    phosphorus: w * (pos.phosphorusPercent / 100)
  };
}

function draftTotals() {
  const t = { mass: 0, calories: 0, protein: 0, fat: 0, calcium: 0, phosphorus: 0 };
  state.positions.forEach((p) => {
    const qty = state.draftItems[p.id] || 0;
    if (qty > 0) {
      const it = itemTotals(p, qty);
      t.mass += it.mass; t.calories += it.calories; t.protein += it.protein; t.fat += it.fat;
      t.calcium += it.calcium; t.phosphorus += it.phosphorus;
    }
  });
  t.proteinPercentOfMass = t.mass > 0 ? (t.protein / t.mass) * 100 : 0;
  t.fatPercentOfMass = t.mass > 0 ? (t.fat / t.mass) * 100 : 0;
  t.caPRatio = t.phosphorus > 0 ? t.calcium / t.phosphorus : null;
  return t;
}

// ————————————————————————————————————————— actions —————————————————————————————————————————

function goTo(screen) { state.screen = screen; state.confirm = null; render(); }

function openAddPicker() { state.screen = 'addPicker'; state.addSearch = ''; render(); }

function openPositionNew() {
  state.screen = 'edit'; state.editingId = null; state.editErrors = {};
  state.editForm = { name: '', unitWeight: '', caloriesPerGram: '', proteinPercent: '', fatPercent: '', calciumPercent: '', phosphorusPercent: '', note: '' };
  render();
}

function openPositionEdit(id) {
  const p = state.positions.find((x) => x.id === id);
  if (!p) return;
  state.screen = 'edit'; state.editingId = id; state.editErrors = {};
  state.editForm = {
    name: p.name, unitWeight: String(p.unitWeight), caloriesPerGram: String(p.caloriesPerGram),
    proteinPercent: String(p.proteinPercent), fatPercent: String(p.fatPercent),
    calciumPercent: String(p.calciumPercent), phosphorusPercent: String(p.phosphorusPercent), note: p.note || ''
  };
  render();
}

function validateEdit(form) {
  const errors = {};
  const num = (v) => (v === '' || v === undefined ? NaN : Number(v));
  if (!form.name || !form.name.trim()) errors.name = 'Введите название';
  if (!(num(form.unitWeight) > 0)) errors.unitWeight = 'Число больше 0';
  if (!(num(form.caloriesPerGram) >= 0)) errors.caloriesPerGram = 'Число от 0';
  ['proteinPercent', 'fatPercent', 'calciumPercent', 'phosphorusPercent'].forEach((k) => {
    const v = num(form[k]);
    if (!(v >= 0 && v <= 100)) errors[k] = 'От 0 до 100';
  });
  return errors;
}

function savePosition() {
  const errors = validateEdit(state.editForm);
  if (Object.keys(errors).length) { state.editErrors = errors; render(); return; }
  const f = state.editForm;
  const record = {
    id: state.editingId || genId(),
    name: f.name.trim(),
    unitWeight: Number(f.unitWeight),
    caloriesPerGram: Number(f.caloriesPerGram),
    proteinPercent: Number(f.proteinPercent),
    fatPercent: Number(f.fatPercent),
    calciumPercent: Number(f.calciumPercent),
    phosphorusPercent: Number(f.phosphorusPercent),
    note: (f.note || '').trim()
  };
  if (state.editingId) state.positions = state.positions.map((p) => (p.id === record.id ? record : p));
  else state.positions = [...state.positions, record];
  DB.put('positions', record);
  state.screen = 'positions'; state.editForm = null; state.editErrors = {}; state.editingId = null;
  render();
}

function cancelEdit() {
  state.screen = 'positions'; state.editForm = null; state.editErrors = {}; state.editingId = null;
  render();
}

function askDeletePosition(id) {
  const p = state.positions.find((x) => x.id === id);
  state.confirm = { type: 'position', id, label: p ? p.name : '' };
  render();
}

function askDeleteSaved(id) {
  const s = state.savedCalcs.find((x) => x.id === id);
  state.confirm = { type: 'saved', id, label: s ? formatDate(s.createdAt) : '' };
  render();
}

function confirmDelete() {
  const c = state.confirm;
  if (!c) return;
  if (c.type === 'position') {
    state.positions = state.positions.filter((p) => p.id !== c.id);
    delete state.draftItems[c.id];
    state.calcPositionIds = state.calcPositionIds.filter((x) => x !== c.id);
    DB.del('positions', c.id);
    DB.setMeta('draftItems', state.draftItems);
    DB.setMeta('calcPositionIds', state.calcPositionIds);
    if (state.screen === 'edit') { state.screen = 'positions'; state.editForm = null; }
  } else if (c.type === 'saved') {
    state.savedCalcs = state.savedCalcs.filter((s) => s.id !== c.id);
    DB.del('savedCalcs', c.id);
  }
  state.confirm = null;
  render();
}

function removeFromCalc(id) {
  state.calcPositionIds = state.calcPositionIds.filter((x) => x !== id);
  delete state.draftItems[id];
  DB.setMeta('calcPositionIds', state.calcPositionIds);
  DB.setMeta('draftItems', state.draftItems);
  render();
}

function setQtyMain(id, delta) {
  const cur = state.draftItems[id] || 0;
  const next = Math.max(0, cur + delta);
  state.draftItems = { ...state.draftItems, [id]: next };
  DB.setMeta('draftItems', state.draftItems);
  render();
}

function incWithCalc(id) {
  const cur = state.draftItems[id] || 0;
  state.draftItems = { ...state.draftItems, [id]: cur + 1 };
  if (!state.calcPositionIds.includes(id)) state.calcPositionIds = [...state.calcPositionIds, id];
  DB.setMeta('draftItems', state.draftItems);
  DB.setMeta('calcPositionIds', state.calcPositionIds);
  render();
}

function decWithCalc(id) {
  const cur = state.draftItems[id] || 0;
  const next = Math.max(0, cur - 1);
  state.draftItems = { ...state.draftItems, [id]: next };
  if (next === 0) state.calcPositionIds = state.calcPositionIds.filter((x) => x !== id);
  DB.setMeta('draftItems', state.draftItems);
  DB.setMeta('calcPositionIds', state.calcPositionIds);
  render();
}

function saveCalculation() {
  const items = [];
  state.positions.forEach((p) => {
    const qty = state.draftItems[p.id] || 0;
    if (qty > 0) {
      items.push({
        positionId: p.id, positionNameSnapshot: p.name, unitWeightSnapshot: p.unitWeight, quantity: qty,
        caloriesPerGramSnapshot: p.caloriesPerGram, proteinPercentSnapshot: p.proteinPercent,
        fatPercentSnapshot: p.fatPercent, calciumPercentSnapshot: p.calciumPercent, phosphorusPercentSnapshot: p.phosphorusPercent
      });
    }
  });
  if (!items.length) return;
  const record = { id: 's_' + Date.now(), createdAt: Date.now(), items, totals: draftTotals() };
  state.savedCalcs = [record, ...state.savedCalcs];
  DB.put('savedCalcs', record);
  showToast('Сохранено', 'light');
  render();
}

function clearDraft() {
  state.draftItems = {};
  DB.setMeta('draftItems', {});
  showToast('Очищено', 'light');
  render();
}

function loadSaved(id) {
  const s = state.savedCalcs.find((x) => x.id === id);
  if (!s) return;
  const draftItems = {};
  const calcIds = [];
  s.items.forEach((it) => {
    draftItems[it.positionId] = it.quantity;
    if (state.positions.some((p) => p.id === it.positionId)) calcIds.push(it.positionId);
  });
  state.draftItems = draftItems;
  state.calcPositionIds = calcIds;
  DB.setMeta('draftItems', draftItems);
  DB.setMeta('calcPositionIds', calcIds);
  state.screen = 'main';
  render();
}

// ————————————————————————————————————————— rendering —————————————————————————————————————————

function renderNav() {
  switch (state.screen) {
    case 'main':
      return `<div class="kbz-nav">
        <span class="kbz-navtitle">Расчёт</span>
        <button class="kbz-iconbtn" data-action="goto" data-screen="settings" aria-label="Настройки">${ICONS.gear()}</button>
        <button class="kbz-iconbtn" data-action="goto" data-screen="positions" aria-label="Позиции">${ICONS.list()}</button>
        <button class="kbz-iconbtn" data-action="goto" data-screen="history" aria-label="История">${ICONS.history()}</button>
      </div>`;
    case 'addPicker':
      return `<div class="kbz-nav">
        <button class="kbz-iconbtn" data-action="goto" data-screen="main" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">Добавить в расчёт</span>
      </div>`;
    case 'positions':
      return `<div class="kbz-nav">
        <button class="kbz-iconbtn" data-action="goto" data-screen="main" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">Позиции</span>
        <button class="kbz-iconbtn" data-action="newPosition" aria-label="Добавить">${ICONS.plus()}</button>
      </div>`;
    case 'edit':
      return `<div class="kbz-nav">
        <button class="kbz-iconbtn" data-action="cancelEdit" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">${state.editingId ? 'Позиция' : 'Новая позиция'}</span>
        ${state.editingId ? `<button class="kbz-iconbtn" data-action="deleteCurrentPosition" aria-label="Удалить">${ICONS.trash()}</button>` : ''}
      </div>`;
    case 'history':
      return `<div class="kbz-nav">
        <button class="kbz-iconbtn" data-action="goto" data-screen="main" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">История</span>
      </div>`;
    case 'settings':
      return `<div class="kbz-nav">
        <button class="kbz-iconbtn" data-action="goto" data-screen="main" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">Настройки</span>
      </div>`;
    default:
      return '';
  }
}

function summaryCell(label, value, warn) {
  return `<div class="kbz-summary-cell"><div class="kbz-summary-label">${label}</div><div class="kbz-summary-value${warn ? ' kbz-alert' : ''}">${value}</div></div>`;
}

function fmtCaP(ratio) {
  return ratio === null ? '—' : `${fmt(ratio)} : 1`;
}

function renderMain() {
  const totals = draftTotals();
  const calcPositions = state.calcPositionIds
    .map((id) => state.positions.find((p) => p.id === id))
    .filter(Boolean);

  const s = state.settings;
  const fatLimit = numOrNull(s.fatMaxPercent);
  const proteinLimit = numOrNull(s.proteinMaxPercent);
  const caPLimit = numOrNull(s.caPMaxRatio);
  const calMin = numOrNull(s.caloriesMin);
  const calMax = numOrNull(s.caloriesMax);

  const fatWarn = fatLimit !== null && totals.fatPercentOfMass > fatLimit;
  const proteinWarn = proteinLimit !== null && totals.proteinPercentOfMass > proteinLimit;
  const caPWarn = caPLimit !== null && totals.caPRatio !== null && totals.caPRatio > caPLimit;
  const calWarn = (calMin !== null && totals.calories < calMin) || (calMax !== null && totals.calories > calMax);

  const rows = calcPositions.map((p) => {
    const qty = state.draftItems[p.id] || 0;
    const it = itemTotals(p, qty);
    return `<div class="kbz-posrow">
      <div class="kbz-posrow-top">
        <span class="kbz-posname" data-action="editPosition" data-id="${p.id}">${esc(p.name)}</span>
        <div class="kbz-stepper">
          <button class="kbz-stepbtn" data-action="removeFromCalc" data-id="${p.id}" aria-label="Убрать из расчёта">${ICONS.trash()}</button>
          <button class="kbz-stepbtn" data-hold="dec" data-scope="main" data-id="${p.id}" aria-label="Минус, удержать для быстрого счёта">${ICONS.minus()}</button>
          <span class="kbz-stepqty">${qty}</span>
          <button class="kbz-stepbtn" data-hold="inc" data-scope="main" data-id="${p.id}" aria-label="Плюс, удержать для быстрого счёта">${ICONS.plus()}</button>
        </div>
      </div>
      <div class="kbz-metrics">
        <span class="tag tag-accent">${fmt(it.calories)} ккал</span>
        <span class="tag tag-neutral">Б ${fmt(it.protein)}г</span>
        <span class="tag tag-neutral">Ж ${fmt(it.fat)}г</span>
        <span class="tag tag-neutral">Ca ${fmt(it.calcium)}г</span>
        <span class="tag tag-neutral">P ${fmt(it.phosphorus)}г</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="kbz-body">
    <div class="card" style="padding:8px 10px">
      <div class="kbz-summary">
        ${summaryCell('Калории', fmt(totals.calories) + ' ккал', calWarn)}
        ${summaryCell('Белки', fmt(totals.protein) + ' г')}
        ${summaryCell('Жиры', fmt(totals.fat) + ' г')}
        ${summaryCell('Кальций', fmt(totals.calcium) + ' г')}
        ${summaryCell('Фосфор', fmt(totals.phosphorus) + ' г')}
      </div>
      <div class="kbz-summary-extra">Ca:P <span class="${caPWarn ? 'kbz-alert' : ''}">${fmtCaP(totals.caPRatio)}</span> · Белки <span class="${proteinWarn ? 'kbz-alert' : ''}">${fmt(totals.proteinPercentOfMass)}%</span> от массы · Жиры <span class="${fatWarn ? 'kbz-alert' : ''}">${fmt(totals.fatPercentOfMass)}%</span> от массы</div>
    </div>
    ${state.positions.length === 0 ? `<div class="kbz-empty"><span>Справочник позиций пуст</span><button class="btn btn-primary" data-action="goto" data-screen="positions">Добавить позицию</button></div>` : ''}
    <button class="kbz-addcalc" data-action="openAddPicker">${ICONS.plus()} Добавить позицию в расчёт</button>
    ${calcPositions.length === 0 ? `<div class="kbz-empty"><span>В расчёте пока нет позиций</span></div>` : `<div>${rows}</div>`}
    <div class="kbz-version">${esc(APP_VERSION)}</div>
  </div>
  <div class="kbz-actionbar">
    <button class="kbz-actbtn kbz-actbtn-primary" data-action="saveCalculation">${ICONS.save(14)} Сохранить</button>
    <button class="kbz-actbtn kbz-actbtn-secondary" data-action="clearDraft">${ICONS.clear(14)} Очистить</button>
  </div>`;
}

function renderAddPicker() {
  const search = state.addSearch.trim().toLowerCase();
  const candidates = state.positions.filter((p) => !search || p.name.toLowerCase().includes(search));
  const rows = candidates.map((p) => {
    const qty = state.draftItems[p.id] || 0;
    return `<div class="kbz-listrow" style="cursor:default">
      <div class="kbz-listrow-main">
        <span class="kbz-listrow-title">${esc(p.name)}</span>
        <span class="kbz-listrow-sub">${p.unitWeight} г · ${p.caloriesPerGram} ккал/г</span>
      </div>
      <div class="kbz-stepper">
        <button class="kbz-stepbtn" data-hold="dec" data-scope="picker" data-id="${p.id}" aria-label="Минус, удержать для быстрого счёта">${ICONS.minus()}</button>
        <span class="kbz-stepqty">${qty}</span>
        <button class="kbz-stepbtn" data-hold="inc" data-scope="picker" data-id="${p.id}" aria-label="Плюс, удержать для быстрого счёта">${ICONS.plus()}</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="kbz-body">
    <div class="field"><input class="input" type="text" id="f-addSearch" data-field="addSearch" placeholder="Поиск позиции" value="${esc(state.addSearch)}"></div>
    ${candidates.length === 0 ? `<div class="kbz-empty"><span>Ничего не найдено</span></div>` : rows}
  </div>`;
}

function renderPositions() {
  const search = state.positionsSearch.trim().toLowerCase();
  const filtered = state.positions.filter((p) => !search || p.name.toLowerCase().includes(search));
  const rows = filtered.map((p) => `<div class="kbz-listrow" data-action="editPosition" data-id="${p.id}">
    <div class="kbz-listrow-main">
      <span class="kbz-listrow-title">${esc(p.name)}</span>
      <span class="kbz-listrow-sub">${p.unitWeight} г · ${p.caloriesPerGram} ккал/г</span>
    </div>
    <button class="kbz-iconbtn" data-action="askDeletePosition" data-id="${p.id}" aria-label="Удалить">${ICONS.trash()}</button>
  </div>`).join('');

  return `<div class="kbz-body">
    <div class="field"><input class="input" type="text" id="f-positionsSearch" data-field="positionsSearch" placeholder="Поиск позиции" value="${esc(state.positionsSearch)}"></div>
    ${state.positions.length === 0
      ? `<div class="kbz-empty"><span>Пока нет ни одной позиции</span><button class="btn btn-primary" data-action="newPosition">Добавить позицию</button></div>`
      : (filtered.length === 0 ? `<div class="kbz-empty"><span>Ничего не найдено</span></div>` : rows)}
  </div>`;
}

function editField(label, key, type) {
  const err = state.editErrors[key];
  return `<div class="field ${err ? 'kbz-fielderr' : ''}">
    <label>${label}</label>
    <input class="input" type="${type}" id="f-${key}" data-field="${key}" value="${esc(state.editForm[key])}">
    ${err ? `<div class="kbz-err">${esc(err)}</div>` : ''}
  </div>`;
}

function renderEdit() {
  const f = state.editForm;
  const percentSum = ['proteinPercent', 'fatPercent', 'calciumPercent', 'phosphorusPercent']
    .reduce((s, k) => s + (Number(f[k]) || 0), 0);

  return `<div class="kbz-body">
    <div class="kbz-form">
      ${percentSum > 100 ? `<div class="kbz-warning">Сумма Белки+Жиры+Кальций+Фосфор превышает 100% — проверьте значения (в реальности это невозможно).</div>` : ''}
      ${editField('Название', 'name', 'text')}
      ${editField('Вес 1 шт (г)', 'unitWeight', 'number')}
      ${editField('Калории — ккал на 1 г', 'caloriesPerGram', 'number')}
      ${editField('Белки — % от веса', 'proteinPercent', 'number')}
      ${editField('Жиры — % от веса', 'fatPercent', 'number')}
      ${editField('Кальций — % от веса', 'calciumPercent', 'number')}
      ${editField('Фосфор — % от веса', 'phosphorusPercent', 'number')}
      <div class="field">
        <label>Заметка</label>
        <textarea class="input" rows="3" id="f-note" data-field="note" placeholder="Например, ключевые особенности вида">${esc(f.note)}</textarea>
      </div>
    </div>
  </div>
  <div class="kbz-actionbar">
    <button class="btn btn-primary btn-block" data-action="savePosition">Сохранить</button>
    <button class="btn btn-secondary btn-block" data-action="cancelEdit">Отмена</button>
  </div>`;
}

function renderHistory() {
  const saved = state.savedCalcs.slice().sort((a, b) => b.createdAt - a.createdAt);
  const rows = saved.map((s) => `<div class="kbz-listrow" data-action="loadSaved" data-id="${s.id}">
    <div class="kbz-listrow-main">
      <span class="kbz-listrow-title">${formatDate(s.createdAt)}</span>
      <span class="kbz-listrow-sub">${fmt(s.totals.calories)} ккал</span>
    </div>
    <button class="kbz-iconbtn" data-action="askDeleteSaved" data-id="${s.id}" aria-label="Удалить">${ICONS.trash()}</button>
  </div>`).join('');

  return `<div class="kbz-body">
    ${saved.length === 0 ? `<div class="kbz-empty"><span>Сохранённых расчётов пока нет</span></div>` : rows}
  </div>`;
}

function settingsField(label, key, placeholder) {
  return `<div class="field">
    <label>${label}</label>
    <input class="input" type="number" id="f-settings-${key}" data-field="settings.${key}" placeholder="${placeholder || ''}" value="${esc(state.settings[key])}">
  </div>`;
}

function renderSettings() {
  return `<div class="kbz-body">
    <div class="kbz-section-title">Предупреждения</div>
    <div class="kbz-section-hint">Если значение в расчёте выходит за рамки — оно подсвечивается красным на главном экране. Пустое поле — без ограничения.</div>
    <div class="kbz-form">
      ${settingsField('Жир выше, % от массы расчёта', 'fatMaxPercent')}
      ${settingsField('Белок выше, % от массы расчёта', 'proteinMaxPercent')}
      ${settingsField('Соотношение Ca:P выше', 'caPMaxRatio')}
      <div class="field">
        <label>Норма калорий, ккал</label>
        <div class="kbz-range-row">
          <input class="input" type="number" id="f-settings-caloriesMin" data-field="settings.caloriesMin" placeholder="От" value="${esc(state.settings.caloriesMin)}">
          <input class="input" type="number" id="f-settings-caloriesMax" data-field="settings.caloriesMax" placeholder="До" value="${esc(state.settings.caloriesMax)}">
        </div>
      </div>
    </div>
  </div>`;
}

function renderDialog() {
  if (!state.confirm) return '';
  const noun = state.confirm.type === 'position' ? 'Удалить позицию?' : 'Удалить расчёт?';
  return `<div class="dialog-backdrop">
    <div class="dialog">
      <div class="dialog-title">${noun}</div>
      <div class="dialog-body">«${esc(state.confirm.label)}» будет удалена без возможности восстановления.</div>
      <div class="dialog-actions">
        <button class="btn btn-ghost" data-action="cancelConfirm">Отмена</button>
        <button class="btn btn-primary" data-action="confirmDelete">Удалить</button>
      </div>
    </div>
  </div>`;
}

function renderToast() {
  if (!state.toast) return '';
  const cls = state.toast.variant === 'light' ? 'kbz-toast kbz-toast-light' : 'kbz-toast';
  return `<div class="${cls}">${esc(state.toast.text)}</div>`;
}

let toastTimeout = null;
function showToast(text, variant = 'dark') {
  state.toast = { text, variant };
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { state.toast = null; render(); }, 1500);
}

function render() {
  const body = state.screen === 'main' ? renderMain()
    : state.screen === 'addPicker' ? renderAddPicker()
    : state.screen === 'positions' ? renderPositions()
    : state.screen === 'edit' ? renderEdit()
    : state.screen === 'settings' ? renderSettings()
    : renderHistory();
  appEl.innerHTML = renderNav() + body + renderDialog() + renderToast();
}

function rerenderPreservingFocus() {
  const active = document.activeElement;
  let restore = null;
  if (active && active.id && active.id.startsWith('f-')) {
    restore = { id: active.id, start: active.selectionStart, end: active.selectionEnd };
  }
  render();
  if (restore) {
    const el = document.getElementById(restore.id);
    if (el) {
      el.focus();
      if (typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(restore.start, restore.end); } catch (e) { /* not a text-selectable input type */ }
      }
    }
  }
}

// ————————————————————————————————————————— events —————————————————————————————————————————

const appEl = document.getElementById('app');

let holdTimeout = null;
let holdInterval = null;
function startHold(fn) {
  stopHold();
  fn();
  holdTimeout = setTimeout(() => { holdInterval = setInterval(fn, 110); }, 400);
}
function stopHold() {
  clearTimeout(holdTimeout);
  clearInterval(holdInterval);
  holdTimeout = null;
  holdInterval = null;
}

appEl.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-hold]');
  if (!el) return;
  e.preventDefault();
  const { hold, scope, id } = el.dataset;
  const dir = hold === 'inc' ? 1 : -1;
  const fn = scope === 'main'
    ? () => setQtyMain(id, dir)
    : () => (dir === 1 ? incWithCalc(id) : decWithCalc(id));
  startHold(fn);
});
window.addEventListener('pointerup', stopHold);
window.addEventListener('pointercancel', stopHold);
window.addEventListener('pointerleave', stopHold);

appEl.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const { action, id, screen } = el.dataset;
  switch (action) {
    case 'goto': goTo(screen); break;
    case 'openAddPicker': openAddPicker(); break;
    case 'newPosition': openPositionNew(); break;
    case 'editPosition': openPositionEdit(id); break;
    case 'removeFromCalc': removeFromCalc(id); break;
    case 'askDeletePosition': askDeletePosition(id); break;
    case 'askDeleteSaved': askDeleteSaved(id); break;
    case 'cancelConfirm': state.confirm = null; render(); break;
    case 'confirmDelete': confirmDelete(); break;
    case 'savePosition': savePosition(); break;
    case 'cancelEdit': cancelEdit(); break;
    case 'deleteCurrentPosition': askDeletePosition(state.editingId); break;
    case 'saveCalculation': saveCalculation(); break;
    case 'clearDraft': clearDraft(); break;
    case 'loadSaved': loadSaved(id); break;
  }
});

appEl.addEventListener('input', (e) => {
  const el = e.target.closest('[data-field]');
  if (!el) return;
  const field = el.dataset.field;
  if (field === 'addSearch') state.addSearch = el.value;
  else if (field === 'positionsSearch') state.positionsSearch = el.value;
  else if (field.startsWith('settings.')) {
    state.settings[field.slice('settings.'.length)] = el.value;
    DB.setMeta('settings', state.settings);
    showToast('Сохранено');
  } else state.editForm[field] = el.value;
  rerenderPreservingFocus();
});

// ————————————————————————————————————————— init —————————————————————————————————————————

function migratePosition(p) {
  if (p.calciumPercent !== undefined) return p;
  const migrated = { ...p, calciumPercent: p.fiberPercent ?? 0, phosphorusPercent: p.chitinPercent ?? 0 };
  delete migrated.fiberPercent;
  delete migrated.chitinPercent;
  DB.put('positions', migrated);
  return migrated;
}

async function init() {
  state.positions = (await DB.getAll('positions')).map(migratePosition);
  state.savedCalcs = await DB.getAll('savedCalcs');
  state.draftItems = await DB.getMeta('draftItems', {});
  state.calcPositionIds = await DB.getMeta('calcPositionIds', []);
  state.settings = { ...DEFAULT_SETTINGS, ...(await DB.getMeta('settings', {})) };

  const seeded = await DB.getMeta('seeded', false);
  if (!seeded) {
    const existingIds = new Set(state.positions.map((p) => p.id));
    const toAdd = SEED_POSITIONS.filter((p) => !existingIds.has(p.id));
    for (const p of toAdd) await DB.put('positions', p);
    state.positions = [...state.positions, ...toAdd];
    await DB.setMeta('seeded', true);
  }

  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
