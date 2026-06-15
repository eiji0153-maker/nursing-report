import { initDB, DB } from './db.js';
import { TEMPLATES, DEFAULT_PHRASES, maskPersonalInfo } from './templates.js';

let currentUser = null;
let currentStep = 1;
let selectedTemplate = null;
let selectedPatient = null;
let generatedText = '';
let editMode = false;

// ===== INIT =====
async function init() {
  await initDB();
  await seedDefaultData();
  setupServiceWorker();
  showScreen('login');
  await renderStaffButtons();
  setupAutoLock();
}

async function seedDefaultData() {
  const phrases = await DB.phrases.getAll();
  if (phrases.length === 0) {
    for (const p of DEFAULT_PHRASES) await DB.phrases.save(p);
  }
  const settings = await DB.settings.get('companyName');
  if (!settings) {
    await DB.settings.set('companyName', '訪問看護ステーション');
    await DB.settings.set('companyTel', '');
    await DB.settings.set('companyFax', '');
    await DB.settings.set('lockTimeout', '5');
  }
}

function setupServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ===== SCREENS =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id)?.classList.add('active');
}

// ===== AUTO LOCK =====
let lockTimer;
function setupAutoLock() {
  const resetTimer = () => {
    clearTimeout(lockTimer);
    if (!currentUser) return;
    DB.settings.get('lockTimeout').then(t => {
      const mins = parseInt(t || '5');
      lockTimer = setTimeout(() => { logout(); showToast('自動ロックされました'); }, mins * 60 * 1000);
    });
  };
  document.addEventListener('touchstart', resetTimer);
  document.addEventListener('click', resetTimer);
}

// ===== LOGIN =====
async function renderStaffButtons() {
  const staff = await DB.staff.getAll();
  const grid = document.getElementById('staff-grid');
  if (staff.length === 0) {
    grid.innerHTML = '<p style="grid-column:span 2;font-size:13px;color:#9ca3af;text-align:center;">管理者設定から職員を登録してください</p>';
    return;
  }
  grid.innerHTML = staff.map(s =>
    `<button class="staff-btn" data-id="${s.id}" onclick="selectStaff(${s.id},'${s.name}')">${s.name}</button>`
  ).join('');
}

let selectedStaffId = null;
window.selectStaff = (id, name) => {
  selectedStaffId = id;
  document.querySelectorAll('.staff-btn').forEach(b => b.classList.toggle('selected', parseInt(b.dataset.id) === id));
  document.getElementById('pin-display').textContent = '　';
  document.getElementById('selected-staff-name').textContent = name + 'さん';
  pinValue = '';
};

let pinValue = '';
window.pinInput = (v) => {
  if (!selectedStaffId) { showToast('職員名を選択してください', 'error'); return; }
  if (v === 'del') { pinValue = pinValue.slice(0, -1); }
  else if (v === 'ok') { doLogin(); return; }
  else if (pinValue.length < 6) { pinValue += v; }
  document.getElementById('pin-display').textContent = '●'.repeat(pinValue.length) || '　';
  if (pinValue.length === 4) doLogin();
};

async function doLogin() {
  const staff = await DB.staff.getAll();
  const found = staff.find(s => s.id === selectedStaffId && s.pin === pinValue);
  if (found) {
    currentUser = found;
    pinValue = '';
    document.getElementById('pin-display').textContent = '　';
    document.getElementById('app-user-name').textContent = found.name;
    await renderApp();
    showScreen('app');
    switchTab('create');
  } else {
    showToast('PINが違います', 'error');
    pinValue = '';
    document.getElementById('pin-display').textContent = '　';
  }
}

function logout() {
  currentUser = null;
  selectedStaffId = null;
  pinValue = '';
  document.getElementById('pin-display').textContent = '　';
  document.querySelectorAll('.staff-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('selected-staff-name').textContent = '職員を選択';
  showScreen('login');
}
window.logout = logout;

// ===== TABS =====
window.switchTab = (tab) => {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
  if (tab === 'history') renderHistory();
  if (tab === 'patients') renderPatients();
  if (tab === 'settings') renderSettings();
  if (tab === 'create') resetCreate();
};

// ===== RENDER APP =====
async function renderApp() {
  resetCreate();
}

// ===== CREATE TAB =====
function resetCreate() {
  currentStep = 1;
  selectedTemplate = null;
  selectedPatient = null;
  generatedText = '';
  editMode = false;
  showStep(1);
}

function showStep(n) {
  currentStep = n;
  document.querySelectorAll('.create-step').forEach(s => s.style.display = 'none');
  const el = document.getElementById('step-' + n);
  if (el) el.style.display = 'block';
  updateStepIndicator(n);
  if (n === 1) renderPatientSelect();
  if (n === 2) renderTemplateSelect();
  if (n === 3) renderInputForm();
  if (n === 4) renderPreview();
}
window.showStep = showStep;

function updateStepIndicator(current) {
  [1,2,3,4].forEach(n => {
    const el = document.getElementById('step-ind-' + n);
    const line = document.getElementById('step-line-' + n);
    if (!el) return;
    el.parentElement.classList.remove('active','done');
    if (n < current) el.parentElement.classList.add('done');
    if (n === current) el.parentElement.classList.add('active');
    if (line) line.classList.toggle('done', n < current);
  });
}

async function renderPatientSelect() {
  const patients = await DB.patients.getAll();
  const sel = document.getElementById('patient-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">利用者を選択してください</option>' +
    patients.map(p => `<option value="${p.id}" ${selectedPatient?.id === p.id ? 'selected' : ''}>${p.name}（${p.careManagerName || 'CM未設定'}）</option>`).join('');
}

window.onPatientSelect = async (id) => {
  if (!id) { selectedPatient = null; return; }
  selectedPatient = await DB.patients.get(parseInt(id));
};

function renderTemplateSelect() {
  const container = document.getElementById('template-grid');
  if (!container) return;
  const icons = { 'sns-rehab': '🏃', 'sns-nursing': '💉', 'fax-status': '📄', 'fax-schedule': '📅', 'fax-emergency': '🚨' };
  container.innerHTML = TEMPLATES.map(t => `
    <div class="template-card ${selectedTemplate?.id === t.id ? 'selected' : ''}" onclick="selectTemplate('${t.id}')">
      <div class="t-icon">${icons[t.id] || '📝'}</div>
      <div class="t-label">${t.label}</div>
      <span class="t-type type-${t.type}">${t.type === 'sns' ? 'SNS' : 'FAX'}</span>
    </div>
  `).join('');
}

window.selectTemplate = (id) => {
  selectedTemplate = TEMPLATES.find(t => t.id === id);
  document.querySelectorAll('.template-card').forEach(c => {
    c.classList.toggle('selected', c.querySelector('.t-label').textContent === selectedTemplate.label);
  });
};

async function renderInputForm() {
  if (!selectedTemplate) return;
  const container = document.getElementById('form-fields');
  if (!container) return;
  const phrases = await DB.phrases.getAll();

  const today = new Date().toLocaleDateString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit' }).replace(/\//g, '/');

  let html = '';

  const fields = selectedTemplate.fields || [];

  if (fields.includes('visitDate')) {
    html += `<div class="form-group">
      <label>訪問日</label>
      <input type="date" id="f-visitDate" value="${new Date().toISOString().split('T')[0]}">
    </div>`;
  }

  if (fields.includes('vitals')) {
    html += `<div class="form-group">
      <label>バイタルサイン</label>
      <div class="vitals-grid">
        <div class="bp-wrap">
          <div class="vital-input-wrap"><label>血圧（上）</label><input type="text" id="f-bpSys" placeholder="110" inputmode="numeric"></div>
          <div class="bp-sep">/</div>
          <div class="vital-input-wrap"><label>血圧（下）</label><input type="text" id="f-bpDia" placeholder="68" inputmode="numeric"></div>
        </div>
        <div class="vital-input-wrap"><label>体温（℃）</label><input type="text" id="f-temp" placeholder="36.8" inputmode="decimal"></div>
        <div class="vital-input-wrap"><label>SpO2（%）</label><input type="text" id="f-spo2" placeholder="98" inputmode="numeric"></div>
        <div class="vital-input-wrap"><label>脈拍（回/分）</label><input type="text" id="f-pulse" placeholder="72" inputmode="numeric"></div>
      </div>
    </div>`;
  }

  if (fields.includes('carepalette')) {
    html += `<div class="form-group">
      <label>記録内容<span style="font-size:11px;color:#9ca3af;margin-left:6px;">（ケアパレットからコピー貼り付け可）</span></label>
      <textarea id="f-carepalette" rows="8" placeholder="ケアパレットの記録をここに貼り付けてください。&#10;&#10;または直接入力してください。" oninput="updateCharCount(this)"></textarea>
      <div class="char-count" id="char-count-main">0文字</div>
    </div>`;
  }

  if (fields.includes('nextVisit')) {
    html += `<div class="form-group">
      <label>次回訪問予定（任意）</label>
      <input type="text" id="f-nextVisit" placeholder="例：来週月曜日 10:00〜">
    </div>`;
  }

  if (fields.includes('action')) {
    html += `<div class="form-group">
      <label>対応内容</label>
      <textarea id="f-action" rows="4" placeholder="実施した対応を入力してください"></textarea>
    </div>`;
  }

  if (fields.includes('reportMonth')) {
    html += `<div class="form-group">
      <label>対象月</label>
      <input type="text" id="f-reportMonth" placeholder="例：2026年5月">
    </div>`;
  }
  if (fields.includes('visitCount')) {
    html += `<div class="form-group">
      <label>訪問回数</label>
      <input type="text" id="f-visitCount" placeholder="例：8" inputmode="numeric" style="width:120px">
    </div>`;
  }
  if (fields.includes('vitalsTrend')) {
    html += `<div class="form-group">
      <label>バイタル傾向</label>
      <textarea id="f-vitalsTrend" rows="3" placeholder="例：血圧110〜120/60〜70台で安定。体温・SpO2は正常範囲内で経過。"></textarea>
    </div>`;
  }
  if (fields.includes('nextPlan')) {
    html += `<div class="form-group">
      <label>今後の方針</label>
      <textarea id="f-nextPlan" rows="3" placeholder="来月以降の訪問方針を入力"></textarea>
    </div>`;
  }

  if (fields.includes('scheduleFrom')) {
    html += `<div class="form-group">
      <label>変更前スケジュール</label>
      <input type="text" id="f-scheduleFrom" placeholder="例：毎週火曜日 14:00〜15:00">
    </div>`;
  }
  if (fields.includes('scheduleTo')) {
    html += `<div class="form-group">
      <label>変更後スケジュール</label>
      <input type="text" id="f-scheduleTo" placeholder="例：毎週月曜日 15:50〜16:30">
    </div>`;
  }
  if (fields.includes('scheduleTime')) {
    html += `<div class="form-group">
      <label>変更開始日</label>
      <input type="text" id="f-scheduleTime" placeholder="例：6/1より">
    </div>`;
  }
  if (fields.includes('scheduleNote')) {
    html += `<div class="form-group">
      <label>備考（任意）</label>
      <textarea id="f-scheduleNote" rows="3" placeholder="その他連絡事項があれば入力"></textarea>
    </div>`;
  }

  // Phrases
  const cats = [...new Set(phrases.map(p => p.category))];
  html += `<div class="form-group">
    <label>定型文を挿入</label>`;
  for (const cat of cats) {
    const catPhrases = phrases.filter(p => p.category === cat);
    html += `<div style="margin-bottom:8px"><div style="font-size:11px;color:#9ca3af;margin-bottom:4px;font-weight:600;">${cat}</div>
      <div class="phrase-chips">${catPhrases.map(p =>
        `<button class="phrase-chip" onclick="insertPhrase('${p.text.replace(/'/g,"\\'")}')">＋ ${p.text}</button>`
      ).join('')}</div></div>`;
  }
  html += '</div>';

  container.innerHTML = html;
}

window.updateCharCount = (el) => {
  const count = el.value.length;
  const counter = document.getElementById('char-count-main');
  if (counter) counter.textContent = count + '文字';
};

window.insertPhrase = (text) => {
  const ta = document.getElementById('f-carepalette') || document.getElementById('f-action') || document.getElementById('f-scheduleNote');
  if (!ta) return;
  const start = ta.selectionStart;
  const before = ta.value.substring(0, start);
  const after = ta.value.substring(ta.selectionEnd);
  ta.value = before + (before && !before.endsWith('\n') ? '\n' : '') + text + after;
  ta.focus();
  window.updateCharCount(ta);
};

function collectFormData() {
  const get = id => document.getElementById(id)?.value || '';
  const data = {};

  const bpSys = get('f-bpSys'), bpDia = get('f-bpDia'), temp = get('f-temp'), spo2 = get('f-spo2'), pulse = get('f-pulse');
  const vitalParts = [];
  if (temp) vitalParts.push(`体温${temp}℃`);
  if (bpSys && bpDia) vitalParts.push(`血圧${bpSys}/${bpDia}mmHg`);
  if (pulse) vitalParts.push(`脈拍${pulse}回/分`);
  if (spo2) vitalParts.push(`SpO2${spo2}%`);
  data.vitals = vitalParts.join('　');

  data.carepalette = get('f-carepalette');
  data.nextVisit = get('f-nextVisit');
  data.action = get('f-action');
  data.scheduleFrom = get('f-scheduleFrom');
  data.scheduleTo = get('f-scheduleTo');
  data.scheduleTime = get('f-scheduleTime');
  data.scheduleNote = get('f-scheduleNote');
  data.visitDate = get('f-visitDate');
  data.reportMonth = get('f-reportMonth');
  data.visitCount = get('f-visitCount');
  data.vitalsTrend = get('f-vitalsTrend');
  data.nextPlan = get('f-nextPlan');

  return data;
}

function renderPreview() {
  if (!selectedTemplate || !selectedPatient) return;
  const data = collectFormData();
  const rawText = selectedTemplate.generate(data);
  generatedText = rawText;

  const previewContainer = document.getElementById('preview-container');
  const isSNS = selectedTemplate.type === 'sns';

  if (isSNS) {
    const masked = maskPersonalInfo(rawText, selectedPatient.name);
    previewContainer.innerHTML = `
      <div class="card">
        <div class="card-title">📱 SNS投稿文（マスキング済み）</div>
        <div class="masked-badge">個人情報マスキング済み</div>
        <div class="preview-area preview-masked" id="preview-text">${escHtml(masked)}</div>
        <div class="char-count">${masked.length}文字</div>
        <div class="btn-group" style="margin-top:12px;">
          <button class="btn btn-success" onclick="copyText()">📋 コピーする</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleEdit()">✏️ 編集</button>
        </div>
        <p style="font-size:11px;color:#9ca3af;margin-top:8px;">コピー後、どこでも連絡帳に貼り付けてください</p>
      </div>
      <div class="card" style="margin-top:0">
        <div class="card-title" style="font-size:13px;color:#9ca3af;">元テキスト（参考）</div>
        <div class="preview-area" style="font-size:12px;">${escHtml(rawText)}</div>
      </div>`;
  } else {
    renderFaxPreview(previewContainer, rawText, data);
  }

  saveToHistory(rawText, data);
}

async function renderFaxPreview(container, text, data) {
  const companyName = await DB.settings.get('companyName') || '訪問看護ステーション';
  const companyTel = await DB.settings.get('companyTel') || '';
  const companyFax = await DB.settings.get('companyFax') || '';
  const now = new Date().toLocaleDateString('ja-JP', {year:'numeric',month:'long',day:'numeric'});

  container.innerHTML = `
    <div class="card">
      <div class="card-title">📄 FAX送付状プレビュー</div>
      <div class="fax-preview" id="print-area">
        <div class="fax-header">
          <h2>FAX送付状</h2>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">${now}</div>
        </div>
        <table class="fax-meta-table">
          <tr><td>宛先</td><td>${escHtml(selectedPatient.careManagerName || '')}　様<br><span style="font-size:12px;color:#6b7280;">FAX: ${escHtml(selectedPatient.careManagerFax || '未設定')}</span></td></tr>
          <tr><td>発信元</td><td>${escHtml(companyName)}<br><span style="font-size:12px;color:#6b7280;">TEL: ${escHtml(companyTel)}　FAX: ${escHtml(companyFax)}</span></td></tr>
          <tr><td>担当</td><td>${escHtml(currentUser?.name || '')}</td></tr>
          <tr><td>利用者</td><td>${escHtml(selectedPatient.name)}　様</td></tr>
          <tr><td>件名</td><td>${escHtml(selectedTemplate.label)}</td></tr>
        </table>
        <div class="fax-body">${escHtml(text)}</div>
      </div>
      <div class="btn-group" style="margin-top:16px;">
        <button class="btn btn-primary" onclick="printFax()">🖨️ 印刷する</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleEdit()">✏️ 編集</button>
      </div>
      <p style="font-size:11px;color:#9ca3af;margin-top:8px;">印刷後、FAX機よりお送りください</p>
    </div>`;
}

window.copyText = () => {
  const text = document.getElementById('preview-text')?.textContent || generatedText;
  navigator.clipboard.writeText(text).then(() => showToast('コピーしました ✓', 'success')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('コピーしました ✓', 'success');
  });
};

window.toggleEdit = () => {
  editMode = !editMode;
  const preview = document.getElementById('preview-text') || document.querySelector('.fax-body');
  if (!preview) return;
  if (editMode) {
    preview.setAttribute('contenteditable', 'true');
    preview.style.background = '#fffbeb';
    preview.focus();
    showToast('編集モードになりました');
  } else {
    preview.setAttribute('contenteditable', 'false');
    preview.style.background = '';
    showToast('編集を確定しました ✓', 'success');
  }
};

window.printFax = () => { window.print(); };

async function saveToHistory(text, data) {
  await DB.history.save({
    patientId: selectedPatient.id,
    patientName: selectedPatient.name,
    templateId: selectedTemplate.id,
    templateLabel: selectedTemplate.label,
    type: selectedTemplate.type,
    staffName: currentUser.name,
    createdAt: new Date().toISOString(),
    text,
    data
  });
}

// ===== HISTORY =====
async function renderHistory() {
  const all = await DB.history.getAll();
  const container = document.getElementById('history-list');
  if (!container) return;

  const searchVal = document.getElementById('history-search')?.value?.toLowerCase() || '';
  const filtered = searchVal ? all.filter(h =>
    h.patientName?.toLowerCase().includes(searchVal) ||
    h.templateLabel?.toLowerCase().includes(searchVal)
  ) : all;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>履歴がありません</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(h => `
    <div class="history-item">
      <div class="history-left">
        <div class="history-patient">${escHtml(h.patientName)}</div>
        <div class="history-meta">${formatDate(h.createdAt)}　${escHtml(h.staffName)}</div>
        <div class="history-preview">${escHtml(h.text?.substring(0, 60))}...</div>
      </div>
      <div class="history-right">
        <span class="badge badge-${h.type}">${h.type === 'sns' ? 'SNS' : 'FAX'}</span>
        <button class="btn btn-secondary btn-sm" onclick="showHistoryDetail(${h.id})">詳細</button>
        <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626" onclick="deleteHistory(${h.id})">削除</button>
      </div>
    </div>
  `).join('');
}

window.historySearch = () => renderHistory();

window.showHistoryDetail = async (id) => {
  const all = await DB.history.getAll();
  const h = all.find(x => x.id === id);
  if (!h) return;
  const modal = document.getElementById('modal-history');
  document.getElementById('modal-history-content').innerHTML = `
    <div style="margin-bottom:12px">
      <div style="font-weight:700;font-size:16px;">${escHtml(h.patientName)}</div>
      <div style="font-size:13px;color:#9ca3af;">${formatDate(h.createdAt)}　${escHtml(h.staffName)}　<span class="badge badge-${h.type}">${h.type==='sns'?'SNS':'FAX'}</span></div>
    </div>
    <div class="preview-area">${escHtml(h.text)}</div>
    <div class="btn-group" style="margin-top:12px;">
      <button class="btn btn-success" onclick="navigator.clipboard.writeText(document.querySelector('#modal-history .preview-area').textContent).then(()=>showToast('コピーしました','success'))">📋 コピー</button>
      <button class="btn btn-primary" onclick="reuseHistory(${h.id})">再利用</button>
    </div>`;
  modal.classList.add('active');
};

window.closeModal = (id) => document.getElementById(id)?.classList.remove('active');

window.reuseHistory = async (id) => {
  const all = await DB.history.getAll();
  const h = all.find(x => x.id === id);
  if (!h) return;
  closeModal('modal-history');
  // switchTab の resetCreate() より後に設定しないとリセットされるため順序を守る
  switchTab('create');
  selectedPatient = await DB.patients.get(h.patientId);
  selectedTemplate = TEMPLATES.find(t => t.id === h.templateId);
  showStep(3);
};

window.deleteHistory = async (id) => {
  if (!confirm('この履歴を削除しますか？')) return;
  await DB.history.delete(id);
  renderHistory();
};

// ===== PATIENTS =====
async function renderPatients() {
  const patients = await DB.patients.getAll();
  const container = document.getElementById('patient-list');
  if (!container) return;

  const searchVal = document.getElementById('patient-search')?.value?.toLowerCase() || '';
  const filtered = searchVal
    ? patients.filter(p => p.name?.toLowerCase().includes(searchVal))
    : patients;

  if (filtered.length === 0) {
    container.innerHTML = searchVal
      ? `<div class="empty-state"><div class="empty-icon">🔍</div><p>「${escHtml(searchVal)}」に該当する利用者が見つかりません</p></div>`
      : `<div class="empty-state"><div class="empty-icon">👤</div><p>利用者が登録されていません</p></div>`;
    return;
  }
  container.innerHTML = filtered.map(p => `
    <div class="patient-item">
      <div>
        <div class="patient-name">${escHtml(p.name)}</div>
        <div class="patient-sub">CM: ${escHtml(p.careManagerName||'未設定')}　Dr: ${escHtml(p.doctorName||'未設定')}</div>
      </div>
      <div class="patient-actions">
        <button class="btn btn-secondary btn-sm" onclick="editPatient(${p.id})">編集</button>
        <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626" onclick="deletePatient(${p.id})">削除</button>
      </div>
    </div>
  `).join('');
}

window.patientSearch = () => renderPatients();

window.openPatientModal = (id) => {
  const modal = document.getElementById('modal-patient');
  document.getElementById('patient-form').reset();
  document.getElementById('patient-id').value = '';
  document.getElementById('modal-patient-title').textContent = '利用者を追加';
  if (id) editPatient(id);
  else modal.classList.add('active');
};

window.editPatient = async (id) => {
  const p = await DB.patients.get(id);
  if (!p) return;
  document.getElementById('patient-id').value = p.id;
  document.getElementById('p-name').value = p.name || '';
  document.getElementById('p-birthday').value = p.birthday || '';
  document.getElementById('p-care-manager').value = p.careManagerName || '';
  document.getElementById('p-care-manager-fax').value = p.careManagerFax || '';
  document.getElementById('p-care-manager-org').value = p.careManagerOrg || '';
  document.getElementById('p-doctor').value = p.doctorName || '';
  document.getElementById('p-doctor-fax').value = p.doctorFax || '';
  document.getElementById('p-doctor-org').value = p.doctorOrg || '';
  document.getElementById('modal-patient-title').textContent = '利用者を編集';
  document.getElementById('modal-patient').classList.add('active');
};

window.savePatient = async () => {
  const id = document.getElementById('patient-id').value;
  const p = {
    name: document.getElementById('p-name').value.trim(),
    birthday: document.getElementById('p-birthday').value,
    careManagerName: document.getElementById('p-care-manager').value.trim(),
    careManagerFax: document.getElementById('p-care-manager-fax').value.trim(),
    careManagerOrg: document.getElementById('p-care-manager-org').value.trim(),
    doctorName: document.getElementById('p-doctor').value.trim(),
    doctorFax: document.getElementById('p-doctor-fax').value.trim(),
    doctorOrg: document.getElementById('p-doctor-org').value.trim(),
  };
  if (!p.name) { showToast('利用者名を入力してください', 'error'); return; }
  if (id) p.id = parseInt(id);
  await DB.patients.save(p);
  closeModal('modal-patient');
  renderPatients();
  showToast('保存しました ✓', 'success');
};

window.deletePatient = async (id) => {
  if (!confirm('この利用者を削除しますか？')) return;
  await DB.patients.delete(id);
  renderPatients();
};

// ===== SETTINGS =====
async function renderSettings() {
  const companyName = await DB.settings.get('companyName') || '';
  const companyTel = await DB.settings.get('companyTel') || '';
  const companyFax = await DB.settings.get('companyFax') || '';
  const lockTimeout = await DB.settings.get('lockTimeout') || '5';
  document.getElementById('s-company-name').value = companyName;
  document.getElementById('s-company-tel').value = companyTel;
  document.getElementById('s-company-fax').value = companyFax;
  document.getElementById('s-lock-timeout').value = lockTimeout;
  renderStaffList();
  renderPhraseList();
}

window.saveSettings = async () => {
  await DB.settings.set('companyName', document.getElementById('s-company-name').value.trim());
  await DB.settings.set('companyTel', document.getElementById('s-company-tel').value.trim());
  await DB.settings.set('companyFax', document.getElementById('s-company-fax').value.trim());
  await DB.settings.set('lockTimeout', document.getElementById('s-lock-timeout').value);
  showToast('設定を保存しました ✓', 'success');
};

async function renderStaffList() {
  const staff = await DB.staff.getAll();
  const container = document.getElementById('staff-list');
  if (!container) return;
  container.innerHTML = staff.map(s => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f3f4f6;gap:8px;">
      <div style="flex:1;min-width:0;"><span style="font-weight:600">${escHtml(s.name)}</span><span style="font-size:12px;color:#9ca3af;margin-left:8px;">PIN: ${'●'.repeat(s.pin?.length||4)}</span></div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-secondary btn-sm" onclick="openPinChangeModal(${s.id},'${escHtml(s.name)}')">PIN変更</button>
        <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626" onclick="deleteStaff(${s.id})">削除</button>
      </div>
    </div>
  `).join('') || '<p style="font-size:13px;color:#9ca3af;padding:8px 0">職員が登録されていません</p>';
}

window.openPinChangeModal = (id, name) => {
  document.getElementById('pin-change-staff-id').value = id;
  document.getElementById('pin-change-staff-name').textContent = name + 'さんのPINを変更';
  document.getElementById('new-pin-value').value = '';
  document.getElementById('modal-pin-change').classList.add('active');
};

window.savePinChange = async () => {
  const id = parseInt(document.getElementById('pin-change-staff-id').value);
  const newPin = document.getElementById('new-pin-value').value.trim();
  if (!/^\d{4,6}$/.test(newPin)) { showToast('PINは4〜6桁の数字で入力してください', 'error'); return; }
  const staff = await DB.staff.getAll();
  const conflict = staff.find(s => s.pin === newPin && s.id !== id);
  if (conflict) { showToast('このPINは既に使用されています', 'error'); return; }
  const target = staff.find(s => s.id === id);
  if (!target) return;
  await DB.staff.save({ ...target, pin: newPin });
  closeModal('modal-pin-change');
  renderStaffList();
  showToast('PINを変更しました ✓', 'success');
};

window.openStaffModal = () => {
  document.getElementById('new-staff-name').value = '';
  document.getElementById('new-staff-pin').value = '';
  document.getElementById('modal-staff').classList.add('active');
};

window.saveStaff = async () => {
  const name = document.getElementById('new-staff-name').value.trim();
  const pin = document.getElementById('new-staff-pin').value.trim();
  if (!name || !pin) { showToast('名前とPINを入力してください', 'error'); return; }
  if (!/^\d{4,6}$/.test(pin)) { showToast('PINは4〜6桁の数字で入力してください', 'error'); return; }
  const existing = await DB.staff.getByPin(pin);
  if (existing) { showToast('このPINは既に使用されています', 'error'); return; }
  await DB.staff.save({ name, pin });
  closeModal('modal-staff');
  renderStaffList();
  renderStaffButtons();
  showToast(name + 'さんを登録しました ✓', 'success');
};

window.deleteStaff = async (id) => {
  if (!confirm('この職員を削除しますか？')) return;
  await DB.staff.delete(id);
  renderStaffList();
  renderStaffButtons();
};

async function renderPhraseList() {
  const phrases = await DB.phrases.getAll();
  const container = document.getElementById('phrase-list');
  if (!container) return;
  container.innerHTML = phrases.map(p => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
      <span style="font-size:11px;color:#9ca3af;min-width:48px;">${escHtml(p.category)}</span>
      <span style="flex:1;font-size:13px;">${escHtml(p.text)}</span>
      <button class="btn btn-secondary btn-sm" style="padding:4px 10px;white-space:nowrap;" onclick="editPhrase(${p.id})">編集</button>
      <button class="btn btn-sm" style="background:#fee2e2;color:#dc2626;padding:4px 10px;" onclick="deletePhrase(${p.id})">削除</button>
    </div>
  `).join('') || '<p style="font-size:13px;color:#9ca3af;">定型文がありません</p>';
}

window.openPhraseModal = (id) => {
  document.getElementById('phrase-edit-id').value = id || '';
  document.getElementById('new-phrase-cat').value = '';
  document.getElementById('new-phrase-text').value = '';
  document.getElementById('modal-phrase-title').textContent = id ? '定型文を編集' : '定型文を追加';
  document.getElementById('modal-phrase').classList.add('active');
};

window.editPhrase = async (id) => {
  const phrases = await DB.phrases.getAll();
  const p = phrases.find(x => x.id === id);
  if (!p) return;
  document.getElementById('phrase-edit-id').value = id;
  document.getElementById('new-phrase-cat').value = p.category;
  document.getElementById('new-phrase-text').value = p.text;
  document.getElementById('modal-phrase-title').textContent = '定型文を編集';
  document.getElementById('modal-phrase').classList.add('active');
};

window.savePhrase = async () => {
  const id = document.getElementById('phrase-edit-id').value;
  const cat = document.getElementById('new-phrase-cat').value.trim() || '共通';
  const text = document.getElementById('new-phrase-text').value.trim();
  if (!text) { showToast('定型文を入力してください', 'error'); return; }
  const obj = { category: cat, text };
  if (id) obj.id = parseInt(id);
  await DB.phrases.save(obj);
  closeModal('modal-phrase');
  renderPhraseList();
  showToast(id ? '定型文を更新しました ✓' : '定型文を追加しました ✓', 'success');
};

window.deletePhrase = async (id) => {
  await DB.phrases.delete(id);
  renderPhraseList();
};

// ===== BACKUP & RESTORE =====
window.exportData = async () => {
  const patients = await DB.patients.getAll();
  const staff = await DB.staff.getAll();
  const phrases = await DB.phrases.getAll();
  const keys = ['companyName', 'companyTel', 'companyFax', 'lockTimeout'];
  const settings = [];
  for (const k of keys) {
    const v = await DB.settings.get(k);
    if (v !== undefined) settings.push({ key: k, value: v });
  }
  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    data: { patients, staff, phrases, settings }
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nursing-report-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('エクスポートしました ✓', 'success');
};

window.importData = () => {
  document.getElementById('import-file-input').click();
};

window.onImportFile = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!payload.data) throw new Error('形式が正しくありません');
    if (!confirm('現在のデータにインポートデータを上書きします。よろしいですか？')) {
      e.target.value = '';
      return;
    }
    const { patients, staff, phrases, settings } = payload.data;
    for (const p of patients || []) {
      const { id: _, ...rest } = p;
      await DB.patients.save(rest);
    }
    for (const s of staff || []) {
      const { id: _, ...rest } = s;
      await DB.staff.save(rest);
    }
    for (const p of phrases || []) {
      const { id: _, ...rest } = p;
      await DB.phrases.save(rest);
    }
    for (const s of settings || []) {
      await DB.settings.set(s.key, s.value);
    }
    e.target.value = '';
    renderSettings();
    showToast('インポートしました ✓', 'success');
  } catch (err) {
    showToast('インポートに失敗しました: ' + err.message, 'error');
    e.target.value = '';
  }
};

// ===== STEP NAVIGATION =====
window.nextStep = () => {
  if (currentStep === 1 && !selectedPatient) { showToast('利用者を選択してください', 'error'); return; }
  if (currentStep === 2 && !selectedTemplate) { showToast('テンプレートを選択してください', 'error'); return; }
  if (currentStep < 4) showStep(currentStep + 1);
};
window.prevStep = () => { if (currentStep > 1) showStep(currentStep - 1); };

// ===== UTILS =====
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ja-JP', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
window.showToast = showToast;

// ===== BOOT =====
init();
