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
  gear: (s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 13.09H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  photo: (s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="0"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`
};

const POSITION_IMAGE_SIZE = 200;

const DEFAULT_SETTINGS = { fatMaxPercent: 15, proteinMinPercent: 30, caPMinRatio: 1, caloriesMin: 50, caloriesMax: '' };

const state = {
  screen: 'main', // main | addPicker | positions | edit | history | settings | feedback
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
  feedbackText: '',
  feedbackSending: false
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

// Каждый переход на новый экран кладёт запись в history, поэтому системный жест
// «назад» (свайп на Android/iOS) прилетает как popstate и возвращает на предыдущий
// экран приложения, а не закрывает PWA — браузеру есть куда идти назад. Обратные
// переходы (кнопка «назад» в шапке, отмена, сохранение и т.п.) не трогают
// state.screen напрямую, а вызывают history.back(): так жест и кнопка идут по
// одному и тому же пути и никогда не расходятся.
function pushScreen(screen) {
  state.screen = screen;
  history.pushState({ screen }, '', '');
  render();
}

function goTo(screen) { state.confirm = null; pushScreen(screen); }

function openAddPicker() { state.addSearch = ''; pushScreen('addPicker'); }

function openPositionNew() {
  state.editingId = null; state.editErrors = {};
  state.editForm = { name: '', unitWeight: '', caloriesPerGram: '', proteinPercent: '', fatPercent: '', calciumPercent: '', phosphorusPercent: '', note: '', image: null };
  pushScreen('edit');
}

function openPositionEdit(id) {
  const p = state.positions.find((x) => x.id === id);
  if (!p) return;
  state.editingId = id; state.editErrors = {};
  state.editForm = {
    name: p.name, unitWeight: String(p.unitWeight), caloriesPerGram: String(p.caloriesPerGram),
    proteinPercent: String(p.proteinPercent), fatPercent: String(p.fatPercent),
    calciumPercent: String(p.calciumPercent), phosphorusPercent: String(p.phosphorusPercent), note: p.note || '',
    image: p.image || null
  };
  pushScreen('edit');
}

// Даунскейлит и центрирует по кадру любую загруженную фотографию до
// POSITION_IMAGE_SIZE — так в IndexedDB не оседают многомегабайтные исходники
// с телефона, а все превью в списках получают одинаковый квадратный кроп.
function resizeImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = POSITION_IMAGE_SIZE;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('image decode failed'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

async function pickPositionImage(file) {
  try {
    state.editForm.image = await resizeImageFile(file);
    render();
  } catch (e) {
    showToast('Не удалось загрузить фото');
  }
}

function clearPositionImage() {
  state.editForm.image = null;
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
    note: (f.note || '').trim(),
    image: f.image || null
  };
  if (state.editingId) state.positions = state.positions.map((p) => (p.id === record.id ? record : p));
  else state.positions = [...state.positions, record];
  DB.put('positions', record);
  history.back();
}

function cancelEdit() {
  history.back();
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
  const wasEditingDeleted = c.type === 'position' && state.screen === 'edit';
  if (c.type === 'position') {
    state.positions = state.positions.filter((p) => p.id !== c.id);
    delete state.draftItems[c.id];
    state.calcPositionIds = state.calcPositionIds.filter((x) => x !== c.id);
    DB.del('positions', c.id);
    DB.setMeta('draftItems', state.draftItems);
    DB.setMeta('calcPositionIds', state.calcPositionIds);
  } else if (c.type === 'saved') {
    state.savedCalcs = state.savedCalcs.filter((s) => s.id !== c.id);
    DB.del('savedCalcs', c.id);
  }
  if (wasEditingDeleted) {
    history.back();
  } else {
    state.confirm = null;
    render();
  }
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

async function sendFeedback() {
  const text = state.feedbackText.trim();
  if (!text) { showToast('Введите текст'); return; }
  state.feedbackSending = true;
  render();
  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) throw new Error('bad status');
    state.feedbackText = '';
    showToast('Отправлено', 'light');
    history.back();
  } catch (e) {
    showToast('Не удалось отправить');
  } finally {
    state.feedbackSending = false;
    render();
  }
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
  history.back();
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
        <button class="kbz-iconbtn" data-action="back" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">Добавить в расчёт</span>
      </div>`;
    case 'positions':
      return `<div class="kbz-nav">
        <button class="kbz-iconbtn" data-action="back" aria-label="Назад">${ICONS.back()}</button>
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
        <button class="kbz-iconbtn" data-action="back" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">История</span>
      </div>`;
    case 'settings':
      return `<div class="kbz-nav">
        <button class="kbz-iconbtn" data-action="back" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">Настройки</span>
      </div>`;
    case 'feedback':
      return `<div class="kbz-nav">
        <button class="kbz-iconbtn" data-action="goto" data-screen="settings" aria-label="Назад">${ICONS.back()}</button>
        <span class="kbz-navtitle">Доработка</span>
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
  const proteinLimit = numOrNull(s.proteinMinPercent);
  const caPLimit = numOrNull(s.caPMinRatio);
  const calMin = numOrNull(s.caloriesMin);
  const calMax = numOrNull(s.caloriesMax);

  const fatWarn = fatLimit !== null && totals.fatPercentOfMass > fatLimit;
  const proteinWarn = proteinLimit !== null && totals.proteinPercentOfMass < proteinLimit;
  const caPWarn = caPLimit !== null && totals.caPRatio !== null && totals.caPRatio < caPLimit;
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
          <input class="kbz-stepqty" id="f-qty-${p.id}" data-field="qty.${p.id}" type="text" inputmode="numeric" pattern="[0-9]*" value="${qty}" aria-label="Количество">
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

function listThumb(p) {
  return p.image ? `<img class="kbz-thumb" src="${p.image}" alt="">` : '';
}

function renderAddPicker() {
  const search = state.addSearch.trim().toLowerCase();
  const candidates = state.positions.filter((p) => !search || p.name.toLowerCase().includes(search));
  const rows = candidates.map((p) => {
    const qty = state.draftItems[p.id] || 0;
    return `<div class="kbz-listrow" style="cursor:default">
      <div class="kbz-listrow-main">
        ${listThumb(p)}
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
      ${listThumb(p)}
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
  // type="number" inputs don't support setSelectionRange, so the focus/caret
  // restore in rerenderPreservingFocus silently fails on them (the browser is
  // then free to put the caret wherever it likes after refocus — sometimes
  // the start, which reverses digit order as you type, e.g. "50" -> "05").
  // text + inputmode keeps a numeric keypad on mobile without that failure.
  const attrs = type === 'decimal' ? 'type="text" inputmode="decimal"' : `type="${type}"`;
  return `<div class="field ${err ? 'kbz-fielderr' : ''}">
    <label>${label}</label>
    <input class="input" ${attrs} id="f-${key}" data-field="${key}" value="${esc(state.editForm[key])}">
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
      <div class="field">
        <label>Фото</label>
        <div class="kbz-photo-row">
          ${f.image
            ? `<img class="kbz-photo-preview" src="${f.image}" alt="" data-action="pickPositionImage">`
            : `<div class="kbz-photo-placeholder" data-action="pickPositionImage">${ICONS.photo()}</div>`}
          <div class="kbz-photo-actions">
            <button type="button" class="btn btn-secondary" data-action="pickPositionImage">${f.image ? 'Заменить' : 'Загрузить'}</button>
            ${f.image ? `<button type="button" class="btn btn-ghost" data-action="clearPositionImage">Удалить</button>` : ''}
          </div>
        </div>
        <input type="file" accept="image/*" id="f-image-file" style="display:none">
      </div>
      ${editField('Название', 'name', 'text')}
      ${editField('Вес 1 шт (г)', 'unitWeight', 'decimal')}
      ${editField('Калории — ккал на 1 г', 'caloriesPerGram', 'decimal')}
      ${editField('Белки — % от веса', 'proteinPercent', 'decimal')}
      ${editField('Жиры — % от веса', 'fatPercent', 'decimal')}
      ${editField('Кальций — % от веса', 'calciumPercent', 'decimal')}
      ${editField('Фосфор — % от веса', 'phosphorusPercent', 'decimal')}
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
      ${settingsField('Белок ниже, % от массы расчёта', 'proteinMinPercent')}
      ${settingsField('Соотношение Ca:P ниже', 'caPMinRatio')}
      <div class="field">
        <label>Норма калорий, ккал</label>
        <div class="kbz-range-row">
          <input class="input" type="number" id="f-settings-caloriesMin" data-field="settings.caloriesMin" placeholder="От" value="${esc(state.settings.caloriesMin)}">
          <input class="input" type="number" id="f-settings-caloriesMax" data-field="settings.caloriesMax" placeholder="До" value="${esc(state.settings.caloriesMax)}">
        </div>
      </div>
    </div>
    <div class="kbz-section-title" style="margin-top:16px">Доработка</div>
    <div class="kbz-section-hint">Опишите, что поправить или добавить — попадёт в задачи разработки.</div>
    <button class="btn btn-secondary btn-block" data-action="goto" data-screen="feedback">Сообщить о доработке</button>
  </div>`;
}

function renderFeedback() {
  return `<div class="kbz-body">
    <div class="field">
      <label>Текст доработки</label>
      <textarea class="input" rows="10" id="f-feedbackText" data-field="feedbackText" placeholder="Опишите, что нужно доработать или исправить…">${esc(state.feedbackText)}</textarea>
    </div>
  </div>
  <div class="kbz-actionbar">
    <button class="btn btn-primary btn-block" data-action="sendFeedback" ${state.feedbackSending ? 'disabled' : ''}>${state.feedbackSending ? 'Отправка…' : 'Отправить'}</button>
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

// Тост живёт вне appEl.innerHTML (собственный узел в document.body), чтобы
// его показ/скрытие никогда не пересоздавал остальную разметку — иначе полю
// с фокусом (например, в настройках) каждый раз сбрасывался бы курсор.
const toastEl = document.createElement('div');
toastEl.style.display = 'none';
document.body.appendChild(toastEl);

let toastTimeout = null;
function showToast(text, variant = 'dark') {
  toastEl.textContent = text;
  toastEl.className = variant === 'light' ? 'kbz-toast kbz-toast-light' : 'kbz-toast';
  toastEl.style.display = 'block';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toastEl.style.display = 'none'; }, 1500);
}

function render() {
  const body = state.screen === 'main' ? renderMain()
    : state.screen === 'addPicker' ? renderAddPicker()
    : state.screen === 'positions' ? renderPositions()
    : state.screen === 'edit' ? renderEdit()
    : state.screen === 'settings' ? renderSettings()
    : state.screen === 'feedback' ? renderFeedback()
    : renderHistory();
  appEl.innerHTML = renderNav() + body + renderDialog();
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

// Срабатывает и на системный жест «назад» (Android/iOS), и на любой другой откат
// history — в паре с pushScreen() это единственное место, применяющее экран из
// history.state, так что жест и явный "назад" в приложении всегда синхронны.
window.addEventListener('popstate', (e) => {
  state.screen = (e.state && e.state.screen) || 'main';
  state.confirm = null;
  if (state.screen !== 'edit') { state.editForm = null; state.editErrors = {}; state.editingId = null; }
  render();
});

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
    case 'back': history.back(); break;
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
    case 'sendFeedback': sendFeedback(); break;
    case 'pickPositionImage': document.getElementById('f-image-file').click(); break;
    case 'clearPositionImage': clearPositionImage(); break;
  }
});

appEl.addEventListener('change', (e) => {
  const el = e.target;
  if (el.id !== 'f-image-file' || !el.files || !el.files[0]) return;
  pickPositionImage(el.files[0]);
});

appEl.addEventListener('input', (e) => {
  const el = e.target.closest('[data-field]');
  if (!el) return;
  const field = el.dataset.field;
  if (field.startsWith('settings.')) {
    // No re-render here: the settings screen has nothing else that depends on
    // these values, and re-rendering would recreate the focused input,
    // dropping the caret (that was the "50" -> "05" bug).
    state.settings[field.slice('settings.'.length)] = el.value;
    DB.setMeta('settings', state.settings);
    showToast('Сохранено');
    return;
  }
  if (field === 'addSearch') state.addSearch = el.value;
  else if (field === 'positionsSearch') state.positionsSearch = el.value;
  else if (field === 'feedbackText') state.feedbackText = el.value;
  else if (field.startsWith('qty.')) {
    const id = field.slice('qty.'.length);
    const digits = el.value.replace(/[^0-9]/g, '');
    state.draftItems = { ...state.draftItems, [id]: digits === '' ? 0 : parseInt(digits, 10) };
    DB.setMeta('draftItems', state.draftItems);
  } else state.editForm[field] = el.value;
  rerenderPreservingFocus();
});

// ————————————————————————————————————————— init —————————————————————————————————————————

const SEED_BY_ID = new Map(SEED_POSITIONS.map((p) => [p.id, p]));

// Сид-позиции, существовавшие до того, как появился ensureSeedPositions ниже.
// Нужны, чтобы на уже проинициализированных устройствах (старый булев флаг
// 'seeded') новые виды из SEED_POSITIONS добавились, а эти восемь — нет, если
// пользователь их удалил.
const ORIGINAL_SEED_IDS = [
  'p_cricket_domesticus', 'p_cricket_bimaculatus', 'p_cricket_banana',
  'p_roach_marbled', 'p_roach_turkmen', 'p_bsf_larva', 'p_mealworm', 'p_zoophobas'
];

function migratePosition(p) {
  if (p.calciumPercent !== undefined) return p;
  const migrated = { ...p, calciumPercent: p.fiberPercent ?? 0, phosphorusPercent: p.chitinPercent ?? 0 };
  delete migrated.fiberPercent;
  delete migrated.chitinPercent;
  DB.put('positions', migrated);
  return migrated;
}

// Сид-позиции, сохранённые до появления дефолтных фото, не подхватывают их сами —
// добавление image в SEED_POSITIONS трогает только позиции, которых ещё нет в
// IndexedDB. Подтягиваем фото задним числом, но только один раз (флаг в meta),
// чтобы не переписывать фото, если пользователь потом сам его удалит.
async function backfillSeedImages(positions) {
  const done = await DB.getMeta('seedImagesBackfilled', false);
  if (done) return positions;
  const updated = positions.map((p) => {
    if (p.image) return p;
    const seed = SEED_BY_ID.get(p.id);
    if (!seed || !seed.image) return p;
    const next = { ...p, image: seed.image };
    DB.put('positions', next);
    return next;
  });
  await DB.setMeta('seedImagesBackfilled', true);
  return updated;
}

// Добавляет в справочник виды из SEED_POSITIONS, которых устройство ещё не видело
// — не только при самом первом запуске, но и когда в SEED_POSITIONS появляются
// новые виды в последующих обновлениях. 'seededIds' — множество id, которые уже
// были предложены устройству (независимо от того, оставил их пользователь или
// удалил), чтобы удалённые вручную позиции не воскресали.
async function ensureSeedPositions(positions) {
  let seededIds = await DB.getMeta('seededIds', null);
  if (seededIds === null) {
    const wasSeeded = await DB.getMeta('seeded', false);
    seededIds = wasSeeded ? [...ORIGINAL_SEED_IDS] : [];
  }
  const seededSet = new Set(seededIds);
  const existingIds = new Set(positions.map((p) => p.id));
  const toAdd = SEED_POSITIONS.filter((p) => !seededSet.has(p.id) && !existingIds.has(p.id));
  for (const p of toAdd) await DB.put('positions', p);
  SEED_POSITIONS.forEach((p) => { if (existingIds.has(p.id) || toAdd.includes(p)) seededSet.add(p.id); });
  await DB.setMeta('seededIds', [...seededSet]);
  await DB.setMeta('seeded', true);
  return toAdd.length ? [...positions, ...toAdd] : positions;
}

// Разовое обновление данных для исходных 8 сид-позиций: вес/калорийность/Б/Ж/Ca/P
// заменены на значения из таблицы поставщика (см. seed-data.js). Трогает только
// эти шесть числовых полей у позиций с уже известными id — name/note/image и любые
// пользовательские позиции не затрагиваются.
async function refreshSeedNutrition(positions) {
  const done = await DB.getMeta('seedNutritionRefreshedV2', false);
  if (done) return positions;
  const FIELDS = ['unitWeight', 'caloriesPerGram', 'proteinPercent', 'fatPercent', 'calciumPercent', 'phosphorusPercent'];
  const updated = positions.map((p) => {
    const seed = SEED_BY_ID.get(p.id);
    if (!seed || !ORIGINAL_SEED_IDS.includes(p.id)) return p;
    const next = { ...p };
    FIELDS.forEach((f) => { next[f] = seed[f]; });
    DB.put('positions', next);
    return next;
  });
  await DB.setMeta('seedNutritionRefreshedV2', true);
  return updated;
}

async function init() {
  history.replaceState({ screen: 'main' }, '', '');
  state.positions = (await DB.getAll('positions')).map(migratePosition);
  state.savedCalcs = await DB.getAll('savedCalcs');
  state.draftItems = await DB.getMeta('draftItems', {});
  state.calcPositionIds = await DB.getMeta('calcPositionIds', []);
  const storedSettings = await DB.getMeta('settings', {});
  state.settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (storedSettings[key] !== undefined && storedSettings[key] !== '') state.settings[key] = storedSettings[key];
  }

  state.positions = await ensureSeedPositions(state.positions);
  state.positions = await backfillSeedImages(state.positions);
  state.positions = await refreshSeedNutrition(state.positions);

  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

init();
