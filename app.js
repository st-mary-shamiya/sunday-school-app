'use strict';
/**
 * app.js — المنطق الكامل لتطبيق مدارس الأحد
 * كنيسة السيدة العذراء مريم بالشامية
 * ✅ v2.0 — إضافة: إحصاءات، سجل الحضور، لوحة الشرف، تنبيهات الأعياد
 */

// ============================================================
// التقويم القبطي
// ============================================================
const COPTIC_MONTHS_AR = [
  'توت','بابه','هاتور','كيهك','طوبه','أمشير',
  'برمهات','برمودة','بشنس','بؤونة','أبيب','مسرى','نسيء'
];

function gregorianToCoptic(date) {
  const REF = new Date(2026, 8, 11); // 1 توت 1743
  const diffDays = Math.round((date - REF) / 86400000);
  let year = 1743, remaining = diffDays;
  if (remaining < 0) {
    while (remaining < 0) { year--; remaining += (year % 4 === 3) ? 366 : 365; }
  } else {
    while (true) {
      const diy = (year % 4 === 3) ? 366 : 365;
      if (remaining < diy) break;
      remaining -= diy; year++;
    }
  }
  let month, day;
  if (remaining < 360) { month = Math.floor(remaining / 30) + 1; day = (remaining % 30) + 1; }
  else { month = 13; day = remaining - 360 + 1; }
  return { year, month, day, monthName: COPTIC_MONTHS_AR[month - 1] };
}

function formatCoptic(date) {
  const c = gregorianToCoptic(date);
  return `${c.day} ${c.monthName} ${c.year} م`;
}

function formatDateAr(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function calcAge(birthDate) {
  if (!birthDate) return '—';
  const b = new Date(birthDate + 'T00:00:00');
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age--;
  return age >= 0 ? age + ' سنة' : '—';
}

// ============================================================
// الحالة العامة
// ============================================================
let STATE = {
  tab: 'servants',
  attendanceDate: new Date().toISOString().split('T')[0],
  currentClassId: null,
  currentClassName: '',
  servantSearch: '',
  studentSearch: ''
};

// ============================================================
// تهيئة التطبيق
// ============================================================
// ============================================================
// تهيئة التطبيق
// ============================================================
async function startApp() {
  const ls = document.getElementById('loading-screen');
  const appEl = document.getElementById('app');

  function revealApp() {
    if (ls) {
      ls.style.opacity = '0';
      ls.style.pointerEvents = 'none';
      setTimeout(() => { if (ls.parentNode) ls.remove(); }, 400);
    }
    if (appEl) {
      appEl.style.display = 'flex';
    }
  }

  // 1. ربط مستمعات الأحداث فوراً لتعمل الخانات والتبويبات مباشرة
  try {
    initEventListeners();
    updateDateDisplay();
    setInterval(updateDateDisplay, 60000);
  } catch (err) {
    console.error('خطأ في ربط مستمعات الأحداث:', err);
  }

  // 2. إظهار واجهة التطبيق مباشرة
  revealApp();

  // 3. الاتصال بقاعدة البيانات وتحميل البيانات الأولية
  try {
    await db.open();
    await loadServants();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    setTimeout(() => checkBirthdayAlerts(), 1500);
  } catch (err) {
    console.error('خطأ في الاتصال بقاعدة البيانات:', err);
    showToast('⚠️ خطأ في الاتصال بقاعدة البيانات — تحقق من الإنترنت', 'error');
  }
}

function initEventListeners() {
  // تاريخ الحضور
  const attInput = document.getElementById('attendance-date');
  if (attInput) {
    attInput.value = STATE.attendanceDate;
    attInput.addEventListener('change', async (e) => {
      STATE.attendanceDate = e.target.value;
      await refreshCurrentTab();
    });
  }

  // التبويبات
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // أزرار الخدام
  const addServantBtn = document.getElementById('add-servant-btn');
  if (addServantBtn) addServantBtn.addEventListener('click', () => openServantModal());

  const printServantsBtn = document.getElementById('print-servants-btn');
  if (printServantsBtn) printServantsBtn.addEventListener('click', () => printServantsReport(STATE.attendanceDate));

  const servantSearchInput = document.getElementById('servant-search-input');
  if (servantSearchInput) {
    servantSearchInput.addEventListener('input', (e) => {
      STATE.servantSearch = e.target.value;
      renderServants();
    });
  }

  // أزرار الفصول
  const addClassBtn = document.getElementById('add-class-btn');
  if (addClassBtn) addClassBtn.addEventListener('click', () => openClassModal());

  const printAllClassesBtn = document.getElementById('print-all-classes-btn');
  if (printAllClassesBtn) printAllClassesBtn.addEventListener('click', () => printAllClassesReport(STATE.attendanceDate));

  const backToClassesBtn = document.getElementById('back-to-classes-btn');
  if (backToClassesBtn) backToClassesBtn.addEventListener('click', backToClasses);

  const addStudentBtn = document.getElementById('add-student-btn');
  if (addStudentBtn) addStudentBtn.addEventListener('click', () => openStudentModal());

  const printClassBtn = document.getElementById('print-class-btn');
  if (printClassBtn) {
    printClassBtn.addEventListener('click', () =>
      printClassReport(STATE.currentClassId, STATE.currentClassName, STATE.attendanceDate)
    );
  }

  const studentSearchInput = document.getElementById('student-search-input');
  if (studentSearchInput) {
    studentSearchInput.addEventListener('input', (e) => {
      STATE.studentSearch = e.target.value;
      renderStudents();
    });
  }

  // البحث العام
  document.querySelectorAll('.search-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.search-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.search-input-panel').forEach(p => p.style.display = 'none');
      const panel = document.getElementById(`search-panel-${btn.dataset.type}`);
      if (panel) panel.style.display = 'block';
    });
  });

  const doSearchBtn = document.getElementById('do-search-btn');
  if (doSearchBtn) doSearchBtn.addEventListener('click', doGeneralSearch);

  const genSearchName = document.getElementById('general-search-name');
  if (genSearchName) {
    genSearchName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doGeneralSearch();
    });
  }

  // فورم الخدام
  const servantForm = document.getElementById('servant-form');
  if (servantForm) servantForm.addEventListener('submit', saveServant);

  // فورم الفصول
  const classForm = document.getElementById('class-form');
  if (classForm) classForm.addEventListener('submit', saveClass);

  // فورم المخدومين
  const studentForm = document.getElementById('student-form');
  if (studentForm) studentForm.addEventListener('submit', saveStudent);

  // إغلاق المودالات
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAllModals(); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });

  // مودال التأكيد
  const confirmOkBtn = document.getElementById('confirm-ok-btn');
  if (confirmOkBtn) {
    confirmOkBtn.addEventListener('click', async () => {
      if (_confirmCallback) { await _confirmCallback(); _confirmCallback = null; }
      closeAllModals();
    });
  }

  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  if (confirmCancelBtn) confirmCancelBtn.addEventListener('click', closeAllModals);

  // تصدير / استيراد
  const exportBtn = document.getElementById('export-data-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportData);

  const importInput = document.getElementById('import-data-input');
  if (importInput) importInput.addEventListener('change', importData);

  // تاريخ بحث الحضور
  const attSearchDate = document.getElementById('attendance-search-date');
  if (attSearchDate) attSearchDate.value = STATE.attendanceDate;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}


function updateDateDisplay() {
  const today = new Date();
  document.getElementById('gregorian-date').textContent =
    today.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('coptic-date').textContent = formatCoptic(today);
}

// ============================================================
// التبويبات
// ============================================================
async function switchTab(tabName) {
  STATE.tab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tabName)
  );
  document.querySelectorAll('.tab-content').forEach(s =>
    s.classList.toggle('active', s.id === `tab-${tabName}`)
  );
  if (tabName === 'classes') { showClassesListView(); await loadClasses(); }
  else if (tabName === 'stats') { await loadStats(); }
  else await refreshCurrentTab();
}

async function refreshCurrentTab() {
  switch (STATE.tab) {
    case 'servants': await loadServants(); break;
    case 'classes':
      if (STATE.currentClassId) await loadStudents(STATE.currentClassId);
      else await loadClasses();
      break;
    case 'stats': await loadStats(); break;
  }
}

// ============================================================
// الخدام
// ============================================================
let _servants = [];
let _classes  = [];

async function loadServants() {
  [_servants, _classes] = await Promise.all([db.getAll('servants'), db.getAll('classes')]);
  await renderServants();
}

async function renderServants() {
  const attendanceRecs = await db.getAttendanceForDateAndType(STATE.attendanceDate, 'servant');
  const attMap = {};
  attendanceRecs.forEach(r => attMap[r.personId] = r.status);

  const q = STATE.servantSearch.toLowerCase();
  const classMap = {};
  _classes.forEach(c => classMap[String(c.id)] = c.name);

  const filtered = _servants.filter(s => {
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q) ||
           (classMap[String(s.classId)] || '').toLowerCase().includes(q);
  });

  // إحصائيات
  const present = _servants.filter(s => attMap[String(s.id)] === 'present').length;
  const absent  = _servants.filter(s => attMap[String(s.id)] === 'absent').length;
  document.getElementById('servants-total').textContent   = _servants.length;
  document.getElementById('servants-present').textContent = present;
  document.getElementById('servants-absent').textContent  = absent;

  const tbody = document.getElementById('servants-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <h3>${STATE.servantSearch ? 'لا توجد نتائج' : 'لا يوجد خدام مسجلون'}</h3>
        <p>${STATE.servantSearch ? 'جرّب كلمة بحث مختلفة' : 'اضغط «إضافة خادم» لبدء التسجيل'}</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, i) => {
    const sid    = String(s.id);
    const status = attMap[sid];
    const cls    = classMap[String(s.classId)] || '—';
    return `
      <tr class="clickable-row" onclick="openServantModal('${sid}')">
        <td class="td-num">${i + 1}</td>
        <td class="td-name">${escHtml(s.name)}</td>
        <td>${formatDateAr(s.birthDate)}</td>
        <td>${calcAge(s.birthDate)}</td>
        <td><span style="background:rgba(212,175,55,0.12);padding:3px 10px;border-radius:20px;font-size:12px;">${escHtml(cls)}</span></td>
        <td>
          <button class="att-toggle att-${status || 'none'}"
            onclick="event.stopPropagation();toggleAttendance('${sid}','servant','${status || ''}')"
            title="انقر لتغيير الحضور">
            ${status === 'present' ? '✓ حاضر' : status === 'absent' ? '✗ غائب' : '— سجّل'}
          </button>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn btn-glass btn-sm btn-icon" onclick="event.stopPropagation();showAttendanceHistory('${sid}','servant','${escHtml(s.name)}')" title="سجل الحضور">📅</button>
            <button class="btn btn-glass btn-sm btn-icon" onclick="event.stopPropagation();openServantModal('${sid}')" title="تعديل">✏️</button>
            <button class="btn btn-glass btn-sm btn-icon btn-del" onclick="event.stopPropagation();confirmDeleteServant('${sid}','${escHtml(s.name)}')" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ─── مودال الخادم ───────────────────────────────────────────
async function openServantModal(id = null) {
  const modal = document.getElementById('servant-modal');
  const form  = document.getElementById('servant-form');
  const title = document.getElementById('servant-modal-title');
  form.reset();
  document.getElementById('servant-id').value = '';

  const cls = await db.getAll('classes');
  const sel = document.getElementById('servant-class-select');
  sel.innerHTML = '<option value="">— اختر الفصل المسؤول —</option>' +
    cls.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  if (id) {
    title.textContent = '✏️ تعديل بيانات خادم';
    const servant = await db.get('servants', id);
    if (servant) {
      document.getElementById('servant-id').value     = servant.id;
      document.getElementById('servant-name').value   = servant.name || '';
      document.getElementById('servant-birthdate').value = servant.birthDate || '';
      sel.value = String(servant.classId || '');
      document.getElementById('servant-phone').value  = servant.phone || '';
      document.getElementById('servant-address').value = servant.address || '';
      document.getElementById('servant-notes').value  = servant.notes || '';
    }
  } else {
    title.textContent = '➕ إضافة خادم جديد';
  }
  modal.classList.add('open');
  document.getElementById('servant-name').focus();
}

async function saveServant(e) {
  e.preventDefault();
  const id       = document.getElementById('servant-id').value;
  const name     = document.getElementById('servant-name').value.trim();
  const birthDate= document.getElementById('servant-birthdate').value;
  const classId  = document.getElementById('servant-class-select').value || null;
  const phone    = document.getElementById('servant-phone').value.trim();
  const address  = document.getElementById('servant-address').value.trim();
  const notes    = document.getElementById('servant-notes').value.trim();

  if (!name) { showToast('يرجى إدخال الاسم', 'error'); return; }

  const data = { name, birthDate, classId, phone, address, notes };
  if (id) {
    data.id = id;
    await db.put('servants', data);
    showToast('✅ تم تحديث بيانات الخادم', 'success');
  } else {
    await db.add('servants', data);
    showToast('✅ تم إضافة الخادم بنجاح', 'success');
  }
  closeAllModals();
  await loadServants();
}

async function confirmDeleteServant(id, name) {
  openConfirmModal(
    '⚠️ حذف خادم',
    `هل أنت متأكد من حذف الخادم "${name}"؟`,
    'لا يمكن التراجع عن هذا الإجراء',
    async () => {
      await db.delete('servants', id);
      showToast('🗑️ تم حذف الخادم', 'info');
      await loadServants();
    }
  );
}

// ============================================================
// الفصول
// ============================================================
let _students = [];

async function loadClasses() {
  showClassesListView();
  _classes  = await db.getAll('classes');
  _students = await db.getAll('students');
  const attendanceRecs = await db.getAttendanceForDateAndType(STATE.attendanceDate, 'student');
  const attMap = {};
  attendanceRecs.forEach(r => attMap[r.personId] = r.status);

  const grid = document.getElementById('classes-grid');
  if (_classes.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🏫</div>
        <h3>لا توجد فصول مسجلة</h3>
        <p>اضغط «إضافة فصل» لإنشاء أول فصل</p>
      </div>`;
    return;
  }

  const icons = ['📚','✏️','🎨','🌟','🏆','📖','🎭','🎵','🌈','⭐','🕊️','🙏'];

  grid.innerHTML = _classes.map((cls, idx) => {
    const cid        = String(cls.id);
    const clsStudents= _students.filter(s => String(s.classId) === cid);
    const present    = clsStudents.filter(s => attMap[String(s.id)] === 'present').length;
    const absent     = clsStudents.filter(s => attMap[String(s.id)] === 'absent').length;
    const icon       = icons[idx % icons.length];
    const pct        = clsStudents.length > 0 ? Math.round((present / clsStudents.length) * 100) : 0;
    return `
      <div class="class-card" onclick="openClass('${cid}','${escHtml(cls.name)}')">
        <div class="class-card-actions">
          <button class="btn btn-glass btn-sm btn-icon" onclick="event.stopPropagation();openClassModal('${cid}')" title="تعديل">✏️</button>
          <button class="btn btn-glass btn-sm btn-icon btn-del" onclick="event.stopPropagation();confirmDeleteClass('${cid}','${escHtml(cls.name)}')" title="حذف">🗑️</button>
        </div>
        <div class="class-card-icon">${icon}</div>
        <div class="class-card-name">${escHtml(cls.name)}</div>
        <div class="class-card-age">${cls.ageGroup ? '📅 ' + escHtml(cls.ageGroup) : ''}</div>
        <div class="class-card-stats">
          <span class="class-stat-badge">👥 ${clsStudents.length} مخدوم</span>
          <span class="class-stat-badge" style="color:var(--success)">✓ ${present}</span>
          <span class="class-stat-badge" style="color:var(--danger)">✗ ${absent}</span>
        </div>
        <div class="class-progress-bar">
          <div class="class-progress-fill" style="width:${pct}%"></div>
        </div>
        <div style="font-size:10px;color:var(--text-faint);text-align:center;margin-top:4px">${pct}% حضور</div>
      </div>`;
  }).join('');
}

function showClassesListView() {
  document.getElementById('classes-list-view').style.display = 'block';
  document.getElementById('class-detail-view').style.display = 'none';
  STATE.currentClassId = null;
  STATE.currentClassName = '';
}

async function openClass(classId, className) {
  STATE.currentClassId   = classId;
  STATE.currentClassName = className;
  document.getElementById('classes-list-view').style.display = 'none';
  document.getElementById('class-detail-view').style.display = 'block';
  document.getElementById('class-detail-title').textContent = `🏫 ${className}`;
  STATE.studentSearch = '';
  document.getElementById('student-search-input').value = '';
  await loadStudents(classId);
}

function backToClasses() { showClassesListView(); loadClasses(); }

async function loadStudents(classId) {
  _students = await db.getByIndex('students', 'classId', classId);
  await renderStudents();
}

async function renderStudents() {
  if (!STATE.currentClassId) return;
  const attendanceRecs = await db.getAttendanceForDateAndType(STATE.attendanceDate, 'student');
  const clsAttMap = {};
  attendanceRecs.forEach(r => {
    if (_students.find(s => String(s.id) === String(r.personId))) clsAttMap[r.personId] = r.status;
  });

  const q = STATE.studentSearch.toLowerCase();
  const filtered = _students.filter(s => !q || (s.name || '').toLowerCase().includes(q));

  const present = _students.filter(s => clsAttMap[String(s.id)] === 'present').length;
  const absent  = _students.filter(s => clsAttMap[String(s.id)] === 'absent').length;
  document.getElementById('students-total').textContent   = _students.length;
  document.getElementById('students-present').textContent = present;
  document.getElementById('students-absent').textContent  = absent;

  const tbody = document.getElementById('students-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-icon">🧒</div>
        <h3>${STATE.studentSearch ? 'لا توجد نتائج' : 'لا يوجد مخدومون في هذا الفصل'}</h3>
        <p>${STATE.studentSearch ? 'جرّب كلمة بحث مختلفة' : 'اضغط «إضافة مخدوم» لبدء التسجيل'}</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((s, i) => {
    const sid    = String(s.id);
    const status = clsAttMap[sid];
    return `
      <tr class="clickable-row" onclick="openStudentModal('${sid}')">
        <td class="td-num">${i + 1}</td>
        <td class="td-name">${escHtml(s.name)}</td>
        <td>${formatDateAr(s.birthDate)}</td>
        <td>${calcAge(s.birthDate)}</td>
        <td>${escHtml(s.phone || '—')}</td>
        <td>
          <button class="att-toggle att-${status || 'none'}"
            onclick="event.stopPropagation();toggleAttendance('${sid}','student','${status || ''}')"
            title="انقر لتغيير الحضور">
            ${status === 'present' ? '✓ حاضر' : status === 'absent' ? '✗ غائب' : '— سجّل'}
          </button>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn btn-glass btn-sm btn-icon" onclick="event.stopPropagation();showAttendanceHistory('${sid}','student','${escHtml(s.name)}')" title="سجل الحضور">📅</button>
            <button class="btn btn-glass btn-sm btn-icon" onclick="event.stopPropagation();openStudentModal('${sid}')" title="تعديل">✏️</button>
            <button class="btn btn-glass btn-sm btn-icon btn-del" onclick="event.stopPropagation();confirmDeleteStudent('${sid}','${escHtml(s.name)}')" title="حذف">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ─── مودال الفصل ────────────────────────────────────────────
async function openClassModal(id = null) {
  const modal = document.getElementById('class-modal');
  const form  = document.getElementById('class-form');
  form.reset();
  document.getElementById('class-id').value = '';
  document.getElementById('class-modal-title').textContent = id ? '✏️ تعديل الفصل' : '➕ إضافة فصل جديد';
  if (id) {
    const cls = await db.get('classes', id);
    if (cls) {
      document.getElementById('class-id').value       = cls.id;
      document.getElementById('class-name').value     = cls.name;
      document.getElementById('class-age-group').value= cls.ageGroup || '';
      document.getElementById('class-notes').value    = cls.notes || '';
    }
  }
  modal.classList.add('open');
  document.getElementById('class-name').focus();
}

async function saveClass(e) {
  e.preventDefault();
  const id       = document.getElementById('class-id').value;
  const name     = document.getElementById('class-name').value.trim();
  const ageGroup = document.getElementById('class-age-group').value.trim();
  const notes    = document.getElementById('class-notes').value.trim();
  if (!name) { showToast('يرجى إدخال اسم الفصل', 'error'); return; }
  const data = { name, ageGroup, notes };
  if (id) {
    data.id = id;
    await db.put('classes', data);
    showToast('✅ تم تحديث الفصل', 'success');
  } else {
    await db.add('classes', data);
    showToast('✅ تم إضافة الفصل', 'success');
  }
  closeAllModals();
  await loadClasses();
}

async function confirmDeleteClass(id, name) {
  const students = await db.getByIndex('students', 'classId', id);
  const sub = students.length > 0
    ? `سيتم حذف ${students.length} مخدوم مرتبط بهذا الفصل أيضاً.`
    : 'الفصل فارغ.';
  openConfirmModal('⚠️ حذف فصل', `هل أنت متأكد من حذف فصل "${name}"؟`, sub, async () => {
    for (const st of students) await db.delete('students', st.id);
    await db.delete('classes', id);
    showToast('🗑️ تم حذف الفصل', 'info');
    await loadClasses();
  });
}

// ─── مودال المخدوم (حقول كاملة) ────────────────────────────
async function openStudentModal(id = null) {
  const modal = document.getElementById('student-modal');
  const form  = document.getElementById('student-form');
  form.reset();
  document.getElementById('student-id').value = '';
  document.getElementById('student-modal-title').textContent = id ? '✏️ تعديل بيانات مخدوم' : '➕ إضافة مخدوم جديد';
  if (id) {
    const student = await db.get('students', id);
    if (student) {
      document.getElementById('student-id').value           = student.id;
      document.getElementById('student-name').value         = student.name || '';
      document.getElementById('student-father').value       = student.father || '';
      document.getElementById('student-mother').value       = student.mother || '';
      document.getElementById('student-birthdate').value    = student.birthDate || '';
      document.getElementById('student-phone').value        = student.phone || '';
      document.getElementById('student-father-phone').value = student.fatherPhone || '';
      document.getElementById('student-mother-phone').value = student.motherPhone || '';
      document.getElementById('student-address').value      = student.address || '';
      document.getElementById('student-school').value       = student.school || '';
      document.getElementById('student-grade').value        = student.grade || '';
      document.getElementById('student-confession').value   = student.confessionFather || '';
      document.getElementById('student-notes').value        = student.notes || '';
    }
  }
  modal.classList.add('open');
  document.getElementById('student-name').focus();
}

async function saveStudent(e) {
  e.preventDefault();
  const id           = document.getElementById('student-id').value;
  const name         = document.getElementById('student-name').value.trim();
  const father       = document.getElementById('student-father').value.trim();
  const mother       = document.getElementById('student-mother').value.trim();
  const birthDate    = document.getElementById('student-birthdate').value;
  const phone        = document.getElementById('student-phone').value.trim();
  const fatherPhone  = document.getElementById('student-father-phone').value.trim();
  const motherPhone  = document.getElementById('student-mother-phone').value.trim();
  const address      = document.getElementById('student-address').value.trim();
  const school       = document.getElementById('student-school').value.trim();
  const grade        = document.getElementById('student-grade').value.trim();
  const confessionFather = document.getElementById('student-confession').value.trim();
  const notes        = document.getElementById('student-notes').value.trim();

  if (!name) { showToast('يرجى إدخال اسم المخدوم', 'error'); return; }
  if (!STATE.currentClassId) { showToast('خطأ: لم يتم تحديد الفصل', 'error'); return; }

  const data = {
    name, father, mother, birthDate, phone, fatherPhone, motherPhone,
    address, school, grade, confessionFather, notes,
    classId: STATE.currentClassId
  };
  if (id) {
    data.id = id;
    await db.put('students', data);
    showToast('✅ تم تحديث بيانات المخدوم', 'success');
  } else {
    await db.add('students', data);
    showToast('✅ تم إضافة المخدوم بنجاح', 'success');
  }
  closeAllModals();
  await loadStudents(STATE.currentClassId);
}

async function confirmDeleteStudent(id, name) {
  openConfirmModal(
    '⚠️ حذف مخدوم',
    `هل أنت متأكد من حذف المخدوم "${name}"؟`,
    'لا يمكن التراجع عن هذا الإجراء',
    async () => {
      await db.delete('students', id);
      showToast('🗑️ تم حذف المخدوم', 'info');
      await loadStudents(STATE.currentClassId);
    }
  );
}

// ============================================================
// الحضور
// ============================================================
async function toggleAttendance(personId, personType, currentStatus) {
  const nextStatus = currentStatus === 'present' ? 'absent'
                   : currentStatus === 'absent'  ? null
                   : 'present';
  if (nextStatus === null) {
    const existing = await db.getAttendance(personId, personType, STATE.attendanceDate);
    if (existing) await db.delete('attendance', existing.id);
  } else {
    await db.setAttendance(personId, personType, STATE.attendanceDate, nextStatus);
  }
  if (personType === 'servant') await renderServants();
  else await renderStudents();
}

// ============================================================
// سجل الحضور التاريخي
// ============================================================
async function showAttendanceHistory(personId, personType, personName) {
  const modal = document.getElementById('history-modal');
  const title = document.getElementById('history-modal-title');
  const body  = document.getElementById('history-modal-body');

  title.textContent = `📅 سجل حضور: ${personName}`;
  body.innerHTML = '<div class="search-loading">⏳ جارٍ التحميل...</div>';
  modal.classList.add('open');

  try {
    const records = await db.getAllAttendanceForPerson(personId, personType);
    records.sort((a, b) => b.date.localeCompare(a.date));

    if (records.length === 0) {
      body.innerHTML = `<div class="empty-state" style="padding:40px">
        <div class="empty-icon">📅</div>
        <h3>لا يوجد سجل حضور</h3>
        <p>لم يتم تسجيل أي حضور لهذا الشخص بعد</p>
      </div>`;
      return;
    }

    const presentCount = records.filter(r => r.status === 'present').length;
    const absentCount  = records.filter(r => r.status === 'absent').length;
    const pct          = Math.round((presentCount / records.length) * 100);

    // شريط التقدم
    const progressColor = pct >= 75 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';

    body.innerHTML = `
      <div class="history-stats">
        <div class="history-stat-item">
          <span class="history-stat-num" style="color:var(--gold)">${records.length}</span>
          <span class="history-stat-lbl">إجمالي الأسابيع</span>
        </div>
        <div class="history-stat-item">
          <span class="history-stat-num" style="color:var(--success)">${presentCount}</span>
          <span class="history-stat-lbl">حضر</span>
        </div>
        <div class="history-stat-item">
          <span class="history-stat-num" style="color:var(--danger)">${absentCount}</span>
          <span class="history-stat-lbl">غاب</span>
        </div>
        <div class="history-stat-item">
          <span class="history-stat-num" style="color:${progressColor}">${pct}%</span>
          <span class="history-stat-lbl">نسبة الحضور</span>
        </div>
      </div>
      <div class="history-progress-wrap">
        <div class="history-progress-bar">
          <div class="history-progress-fill" style="width:${pct}%;background:${progressColor}"></div>
        </div>
        <span class="history-progress-label">${pct >= 75 ? '🌟 ممتاز' : pct >= 50 ? '📈 جيد' : '⚠️ يحتاج متابعة'}</span>
      </div>
      <div class="history-list">
        ${records.map(r => {
          const isPresent = r.status === 'present';
          return `
          <div class="history-item ${isPresent ? 'history-present' : 'history-absent'}">
            <span class="history-item-date">${formatDateAr(r.date)}</span>
            <span class="history-item-badge ${isPresent ? 'badge-present' : 'badge-absent'}">
              ${isPresent ? '✓ حاضر' : '✗ غائب'}
            </span>
          </div>`;
        }).join('')}
      </div>`;
  } catch (err) {
    body.innerHTML = `<div style="color:var(--danger);text-align:center;padding:24px">❌ خطأ: ${err.message}</div>`;
  }
}

// ============================================================
// تنبيهات أعياد الميلاد
// ============================================================
async function checkBirthdayAlerts() {
  try {
    const [servants, students] = await Promise.all([db.getAll('servants'), db.getAll('students')]);
    const all = [...servants, ...students];
    const today = new Date();
    const upcoming = [];

    for (const p of all) {
      if (!p.birthDate) continue;
      const bday = new Date(p.birthDate + 'T00:00:00');
      // تعيين عيد ميلاد هذه السنة
      const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      const diffDays = Math.ceil((thisYear - today) / 86400000);
      if (diffDays >= 0 && diffDays <= 7) {
        upcoming.push({ name: p.name, days: diffDays, date: p.birthDate });
      }
    }

    if (upcoming.length === 0) return;

    // عرض التنبيهات في البانر
    const banner = document.getElementById('birthday-banner');
    if (!banner) return;

    const today0 = upcoming.filter(p => p.days === 0);
    const soon   = upcoming.filter(p => p.days > 0);

    let html = '';
    if (today0.length > 0) {
      html += `<div class="bday-alert bday-today">🎂 عيد ميلاد اليوم: ${today0.map(p => `<strong>${escHtml(p.name)}</strong>`).join('، ')} — كل سنة وأنتم بخير! 🎉</div>`;
    }
    if (soon.length > 0) {
      html += `<div class="bday-alert bday-soon">🎈 أعياد ميلاد قريبة: ${soon.map(p => `<strong>${escHtml(p.name)}</strong> (${p.days === 1 ? 'غداً' : 'بعد ' + p.days + ' أيام'})`).join(' | ')}</div>`;
    }
    banner.innerHTML = html;
    banner.style.display = 'block';
  } catch (err) {
    console.warn('birthday check failed:', err);
  }
}

// ============================================================
// تبويب الإحصاءات
// ============================================================
async function loadStats() {
  const [servants, classes, students, attRecs] = await Promise.all([
    db.getAll('servants'),
    db.getAll('classes'),
    db.getAll('students'),
    db.getAttendanceForDateAndType(STATE.attendanceDate, 'student')
  ]);
  const servantAttRecs = await db.getAttendanceForDateAndType(STATE.attendanceDate, 'servant');

  const attMap = {};
  attRecs.forEach(r => attMap[r.personId] = r.status);
  const sAttMap = {};
  servantAttRecs.forEach(r => sAttMap[r.personId] = r.status);

  // إجمالي
  const totalStudents  = students.length;
  const totalServants  = servants.length;
  const presentStudents= students.filter(s => attMap[String(s.id)] === 'present').length;
  const absentStudents = students.filter(s => attMap[String(s.id)] === 'absent').length;
  const presentServants= servants.filter(s => sAttMap[String(s.id)] === 'present').length;
  const absentServants = servants.filter(s => sAttMap[String(s.id)] === 'absent').length;

  // بطاقات الإحصاء العلوية
  document.getElementById('stat-total-students').textContent  = totalStudents;
  document.getElementById('stat-total-servants').textContent  = totalServants;
  document.getElementById('stat-total-classes').textContent   = classes.length;
  document.getElementById('stat-present-today').textContent   = presentStudents + presentServants;

  // رسم دائري للمخدومين
  renderDonutChart('students-donut', presentStudents, absentStudents, totalStudents - presentStudents - absentStudents);
  // رسم دائري للخدام
  renderDonutChart('servants-donut', presentServants, absentServants, totalServants - presentServants - absentServants);

  // جدول أداء الفصول
  const classMap = {};
  classes.forEach(c => classMap[String(c.id)] = c.name);

  const classStats = classes.map(cls => {
    const cid = String(cls.id);
    const clsStudents = students.filter(s => String(s.classId) === cid);
    const present = clsStudents.filter(s => attMap[String(s.id)] === 'present').length;
    const pct = clsStudents.length > 0 ? Math.round((present / clsStudents.length) * 100) : 0;
    return { name: cls.name, total: clsStudents.length, present, pct };
  }).sort((a, b) => b.pct - a.pct);

  const tbody = document.getElementById('stats-classes-tbody');
  if (classStats.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state" style="padding:30px">
      <div class="empty-icon">📊</div><h3>لا توجد بيانات</h3>
    </div></td></tr>`;
  } else {
    tbody.innerHTML = classStats.map((cls, i) => {
      const color = cls.pct >= 75 ? 'var(--success)' : cls.pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      return `<tr>
        <td class="td-num">${i + 1}</td>
        <td class="td-name">${escHtml(cls.name)}</td>
        <td>${cls.total}</td>
        <td style="color:${color};font-weight:700">${cls.present}</td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:rgba(255,255,255,0.1);border-radius:99px;height:6px;overflow:hidden">
              <div style="width:${cls.pct}%;height:100%;background:${color};border-radius:99px;transition:width 0.6s ease"></div>
            </div>
            <span style="color:${color};font-weight:700;font-size:12px;min-width:36px">${cls.pct}%</span>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // لوحة الشرف
  await renderLeaderboard(servants, students, classes);
}

function renderDonutChart(containerId, present, absent, notRecorded) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const total = present + absent + notRecorded;
  if (total === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-faint);padding:30px">لا توجد بيانات</div>`;
    return;
  }

  const pPct = total > 0 ? (present / total) : 0;
  const aPct = total > 0 ? (absent / total) : 0;
  const nPct = 1 - pPct - aPct;

  // SVG Donut
  const r = 60, cx = 80, cy = 80, strokeWidth = 20;
  const circ = 2 * Math.PI * r;

  function arc(pct, offset) {
    return `stroke-dasharray="${(pct * circ).toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="${(-offset * circ).toFixed(2)}"`;
  }

  const pPctLabel = Math.round(pPct * 100);
  const aPctLabel = Math.round(aPct * 100);
  const nPctLabel = 100 - pPctLabel - aPctLabel;

  container.innerHTML = `
    <svg viewBox="0 0 160 160" width="160" height="160" style="transform:rotate(-90deg)">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${strokeWidth}"/>
      ${nPct > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#555" stroke-width="${strokeWidth}" ${arc(nPct, 0)}/>` : ''}
      ${aPct > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#EF5350" stroke-width="${strokeWidth}" ${arc(aPct, nPct)}/>` : ''}
      ${pPct > 0 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#4CAF50" stroke-width="${strokeWidth}" ${arc(pPct, nPct + aPct)}/>` : ''}
    </svg>
    <div class="donut-center-text">
      <span class="donut-big">${pPctLabel}%</span>
      <span class="donut-small">حضور</span>
    </div>
    <div class="donut-legend">
      <div class="legend-item"><span class="legend-dot" style="background:#4CAF50"></span> حاضر ${present} (${pPctLabel}%)</div>
      <div class="legend-item"><span class="legend-dot" style="background:#EF5350"></span> غائب ${absent} (${aPctLabel}%)</div>
      <div class="legend-item"><span class="legend-dot" style="background:#555"></span> لم يسجل ${notRecorded} (${nPctLabel}%)</div>
    </div>`;
}

async function renderLeaderboard(servants, students, classes) {
  const classMap = {};
  classes.forEach(c => classMap[String(c.id)] = c.name);

  // حساب نسبة الحضور من كل السجلات
  async function getPersonRate(id, type) {
    const records = await db.getAllAttendanceForPerson(id, type);
    if (records.length === 0) return { pct: 0, count: 0, total: 0 };
    const present = records.filter(r => r.status === 'present').length;
    return { pct: Math.round((present / records.length) * 100), count: present, total: records.length };
  }

  const servantBoard = document.getElementById('leaderboard-servants');
  const studentBoard = document.getElementById('leaderboard-students');

  if (!servantBoard || !studentBoard) return;

  servantBoard.innerHTML = '<div class="search-loading">⏳ جارٍ الحساب...</div>';
  studentBoard.innerHTML = '<div class="search-loading">⏳ جارٍ الحساب...</div>';

  // أفضل خدام
  const servantRates = await Promise.all(
    servants.map(async s => ({ ...s, ...(await getPersonRate(String(s.id), 'servant')) }))
  );
  const topServants = servantRates
    .filter(s => s.total >= 2)
    .sort((a, b) => b.pct - a.pct || b.count - a.count)
    .slice(0, 5);

  // أفضل مخدومين
  const studentRates = await Promise.all(
    students.map(async s => ({ ...s, ...(await getPersonRate(String(s.id), 'student')) }))
  );
  const topStudents = studentRates
    .filter(s => s.total >= 2)
    .sort((a, b) => b.pct - a.pct || b.count - a.count)
    .slice(0, 5);

  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];

  function boardHTML(items, isServant) {
    if (items.length === 0) {
      return `<div style="text-align:center;color:var(--text-faint);padding:20px;font-size:13px">
        لا توجد بيانات كافية (يلزم تسجيل حضور أسبوعين على الأقل)
      </div>`;
    }
    return items.map((p, i) => {
      const color = p.pct >= 75 ? 'var(--success)' : p.pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      const extra = isServant ? (classMap[String(p.classId)] || '') : (classMap[String(p.classId)] || '');
      return `
        <div class="leaderboard-item">
          <div class="lb-medal">${medals[i]}</div>
          <div class="lb-info">
            <div class="lb-name">${escHtml(p.name)}</div>
            ${extra ? `<div class="lb-sub">${escHtml(extra)}</div>` : ''}
          </div>
          <div class="lb-right">
            <div class="lb-pct" style="color:${color}">${p.pct}%</div>
            <div class="lb-counts">${p.count}/${p.total} أسبوع</div>
          </div>
        </div>`;
    }).join('');
  }

  servantBoard.innerHTML = boardHTML(topServants, true);
  studentBoard.innerHTML = boardHTML(topStudents, false);
}

// ============================================================
// البحث العام
// ============================================================
async function doGeneralSearch() {
  const activeType = document.querySelector('.search-type-btn.active')?.dataset.type || 'name';
  const resultsArea = document.getElementById('search-results-area');
  resultsArea.innerHTML = '<div class="search-loading">⏳ جارٍ البحث...</div>';

  try {
    let results;
    if (activeType === 'name') {
      const q = document.getElementById('general-search-name').value.trim();
      if (!q) { resultsArea.innerHTML = '<div class="search-hint">اكتب اسماً للبحث عنه</div>'; return; }
      const scopeServants = document.getElementById('search-scope-servants').checked;
      const scopeStudents = document.getElementById('search-scope-students').checked;
      results = await db.searchByName(q);
      if (!scopeServants) results.servants = [];
      if (!scopeStudents) results.students = [];
    } else if (activeType === 'birthdate') {
      const q = document.getElementById('general-search-birthdate').value.trim();
      if (!q) { resultsArea.innerHTML = '<div class="search-hint">أدخل جزءاً من تاريخ الميلاد</div>'; return; }
      results = await db.searchByBirthdate(q);
    } else {
      const status = document.getElementById('attendance-search-status').value;
      const date   = document.getElementById('attendance-search-date').value || STATE.attendanceDate;
      results = await db.searchByAttendance(date, status);
    }
    // إضافة classMap لعرض اسم الفصل
    const classes = await db.getAll('classes');
    const classMap = {};
    classes.forEach(c => classMap[String(c.id)] = c.name);
    renderSearchResults(results, activeType, classMap);
  } catch (err) {
    console.error(err);
    resultsArea.innerHTML = `<div class="search-hint" style="color:var(--danger)">❌ خطأ في البحث: ${err.message}</div>`;
  }
}

function renderSearchResults(results, type, classMap = {}) {
  const area = document.getElementById('search-results-area');
  const total = (results.servants?.length || 0) + (results.students?.length || 0);
  if (total === 0) {
    area.innerHTML = `<div class="search-hint">لم يتم العثور على نتائج</div>`;
    return;
  }
  let html = `<div class="search-count">✅ ${total} نتيجة</div>`;
  if (results.servants?.length) {
    html += `<div class="search-section-title">👤 الخدام (${results.servants.length})</div>`;
    html += `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>الاسم</th><th>تاريخ الميلاد</th><th>العمر</th><th>الفصل</th></tr></thead>
      <tbody>${results.servants.map((s, i) => `
        <tr class="clickable-row" onclick="switchTab('servants')">
          <td>${i+1}</td><td class="td-name">${escHtml(s.name)}</td>
          <td>${formatDateAr(s.birthDate)}</td><td>${calcAge(s.birthDate)}</td>
          <td>${escHtml(classMap[String(s.classId)] || '—')}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }
  if (results.students?.length) {
    html += `<div class="search-section-title" style="margin-top:16px">🧒 المخدومون (${results.students.length})</div>`;
    html += `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>الاسم</th><th>تاريخ الميلاد</th><th>العمر</th><th>الفصل</th></tr></thead>
      <tbody>${results.students.map((s, i) => `
        <tr>
          <td>${i+1}</td><td class="td-name">${escHtml(s.name)}</td>
          <td>${formatDateAr(s.birthDate)}</td><td>${calcAge(s.birthDate)}</td>
          <td>${escHtml(classMap[String(s.classId)] || '—')}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }
  area.innerHTML = html;
}

// ============================================================
// مودال التأكيد
// ============================================================
let _confirmCallback = null;

function openConfirmModal(title, text, subText, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent  = text;
  document.getElementById('confirm-sub').textContent   = subText;
  _confirmCallback = callback;
  document.getElementById('confirm-modal').classList.add('open');
}

// ============================================================
// إغلاق المودالات
// ============================================================
function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

// ============================================================
// تصدير / استيراد
// ============================================================
async function exportData() {
  try {
    showToast('⏳ جارٍ تصدير البيانات...', 'info');
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `sunday-school-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ تم تصدير البيانات بنجاح', 'success');
  } catch (err) {
    showToast('❌ خطأ في التصدير: ' + err.message, 'error');
  }
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    showToast('⏳ جارٍ استيراد البيانات...', 'info');
    const text = await file.text();
    const data = JSON.parse(text);
    openConfirmModal(
      '⚠️ استيراد بيانات',
      'سيتم استبدال جميع البيانات الحالية بالملف المستورد',
      'هل أنت متأكد؟',
      async () => {
        await db.importAll(data);
        showToast('✅ تم الاستيراد بنجاح', 'success');
        await refreshCurrentTab();
      }
    );
  } catch (err) {
    showToast('❌ ملف غير صالح: ' + err.message, 'error');
  }
  e.target.value = '';
}

// ============================================================
// Toast إشعارات
// ============================================================
let _toastTimer = null;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ============================================================
// مساعدات
// ============================================================
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// البحث العام (Missing functions added back)
// ============================================================
async function doGeneralSearch() {
  const type = document.querySelector('.search-type-btn.active').dataset.type;
  const resultsArea = document.getElementById('search-results-area');
  resultsArea.innerHTML = '<div class="search-loading">⏳ جارٍ البحث...</div>';
  
  let results = { servants: [], students: [] };
  try {
    if (type === 'name') {
      const q = document.getElementById('general-search-name').value;
      const scopeServants = document.getElementById('search-scope-servants').checked;
      const scopeStudents = document.getElementById('search-scope-students').checked;
      if (scopeServants) results.servants = await db.searchByName('servants', q);
      if (scopeStudents) results.students = await db.searchByName('students', q);
    } else if (type === 'birthdate') {
      const q = document.getElementById('general-search-birthdate').value;
      results.servants = await db.searchByBirthdate('servants', q);
      results.students = await db.searchByBirthdate('students', q);
    } else if (type === 'attendance') {
      const status = document.getElementById('attendance-search-status').value;
      const date   = document.getElementById('attendance-search-date').value || STATE.attendanceDate;
      results = await db.searchByAttendance(date, status);
    }
    const classes = await db.getAll('classes');
    const classMap = {};
    classes.forEach(c => classMap[String(c.id)] = c.name);
    renderSearchResults(results, type, classMap);
  } catch (err) {
    console.error(err);
    resultsArea.innerHTML = `<div class="search-hint" style="color:var(--danger)">❌ خطأ في البحث: ${err.message}</div>`;
  }
}

function renderSearchResults(results, type, classMap = {}) {
  const area = document.getElementById('search-results-area');
  const total = (results.servants?.length || 0) + (results.students?.length || 0);
  if (total === 0) {
    area.innerHTML = `<div class="search-hint">لم يتم العثور على نتائج تطابق بحثك.</div>`;
    return;
  }
  let html = `<div class="search-count">✅ تم العثور على ${total} نتيجة</div>`;
  
  if (results.servants?.length > 0) {
    html += `<div class="search-section-title">👤 الخدام (${results.servants.length})</div>
      <div class="table-wrap" style="margin-bottom:16px"><table aria-label="نتائج بحث الخدام">
      <thead><tr><th style="width:40px">#</th><th>الاسم</th><th>تاريخ الميلاد</th><th>العمر</th><th>الفصل</th></tr></thead><tbody>
      ${results.servants.map((s,i) => `
        <tr class="clickable-row" onclick="switchTab('servants')">
          <td>${i+1}</td><td class="td-name">${escHtml(s.name)}</td>
          <td>${formatDateAr(s.birthDate)}</td><td>${calcAge(s.birthDate)}</td>
          <td>${escHtml(classMap[String(s.classId)] || '—')}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }
  
  if (results.students?.length > 0) {
    html += `<div class="search-section-title">🧒 المخدومون (${results.students.length})</div>
      <div class="table-wrap"><table aria-label="نتائج بحث المخدومين">
      <thead><tr><th style="width:40px">#</th><th>الاسم</th><th>تاريخ الميلاد</th><th>العمر</th><th>الفصل</th></tr></thead><tbody>
      ${results.students.map((s,i) => `
        <tr>
          <td>${i+1}</td><td class="td-name">${escHtml(s.name)}</td>
          <td>${formatDateAr(s.birthDate)}</td><td>${calcAge(s.birthDate)}</td>
          <td>${escHtml(classMap[String(s.classId)] || '—')}</td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }
  area.innerHTML = html;
}

// Global functions for inline HTML event handlers (e.g., onclick)
window.switchTab = switchTab;
window.loadStats = loadStats;
