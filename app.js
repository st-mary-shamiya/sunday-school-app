'use strict';
/**
 * app.js — المنطق الكامل لتطبيق مدارس الأحد
 * كنيسة السيدة العذراء مريم بالشامية
 * ✅ Fixed: string IDs quoted in onclick, removed Number() casts, full student fields
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
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await db.open();
    await initApp();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  } catch (err) {
    console.error('خطأ في تهيئة التطبيق:', err);
    showToast('خطأ في تحميل التطبيق — تحقق من الاتصال بالإنترنت', 'error');
  }
});

async function initApp() {
  updateDateDisplay();
  setInterval(updateDateDisplay, 60000);

  // تاريخ الحضور
  const attInput = document.getElementById('attendance-date');
  attInput.value = STATE.attendanceDate;
  attInput.addEventListener('change', async (e) => {
    STATE.attendanceDate = e.target.value;
    await refreshCurrentTab();
  });

  // التبويبات
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // أزرار الخدام
  document.getElementById('add-servant-btn').addEventListener('click', () => openServantModal());
  document.getElementById('print-servants-btn').addEventListener('click', () => printServantsReport(STATE.attendanceDate));
  document.getElementById('servant-search-input').addEventListener('input', (e) => {
    STATE.servantSearch = e.target.value;
    renderServants();
  });

  // أزرار الفصول
  document.getElementById('add-class-btn').addEventListener('click', () => openClassModal());
  document.getElementById('print-all-classes-btn').addEventListener('click', () => printAllClassesReport(STATE.attendanceDate));
  document.getElementById('back-to-classes-btn').addEventListener('click', backToClasses);
  document.getElementById('add-student-btn').addEventListener('click', () => openStudentModal());
  document.getElementById('print-class-btn').addEventListener('click', () =>
    printClassReport(STATE.currentClassId, STATE.currentClassName, STATE.attendanceDate)
  );
  document.getElementById('student-search-input').addEventListener('input', (e) => {
    STATE.studentSearch = e.target.value;
    renderStudents();
  });

  // البحث العام
  document.querySelectorAll('.search-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.search-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.search-input-panel').forEach(p => p.style.display = 'none');
      document.getElementById(`search-panel-${btn.dataset.type}`).style.display = 'block';
    });
  });
  document.getElementById('do-search-btn').addEventListener('click', doGeneralSearch);
  document.getElementById('general-search-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doGeneralSearch();
  });

  // فورم الخدام
  document.getElementById('servant-form').addEventListener('submit', saveServant);
  // فورم الفصول
  document.getElementById('class-form').addEventListener('submit', saveClass);
  // فورم المخدومين
  document.getElementById('student-form').addEventListener('submit', saveStudent);

  // إغلاق المودالات
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAllModals(); });
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAllModals(); });

  // مودال التأكيد
  document.getElementById('confirm-ok-btn').addEventListener('click', async () => {
    if (_confirmCallback) { await _confirmCallback(); _confirmCallback = null; }
    closeAllModals();
  });
  document.getElementById('confirm-cancel-btn').addEventListener('click', closeAllModals);

  // تصدير / استيراد
  document.getElementById('export-data-btn').addEventListener('click', exportData);
  document.getElementById('import-data-input').addEventListener('change', importData);

  // تاريخ بحث الحضور
  const attSearchDate = document.getElementById('attendance-search-date');
  if (attSearchDate) attSearchDate.value = STATE.attendanceDate;

  // تحميل أول بيانات
  await loadServants();

  // إخفاء شاشة التحميل
  setTimeout(() => {
    const ls = document.getElementById('loading-screen');
    if (ls) { ls.style.opacity = '0'; setTimeout(() => ls.remove(), 400); }
  }, 800);
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
  else await refreshCurrentTab();
}

async function refreshCurrentTab() {
  switch (STATE.tab) {
    case 'servants': await loadServants(); break;
    case 'classes':
      if (STATE.currentClassId) await loadStudents(STATE.currentClassId);
      else await loadClasses();
      break;
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
    data.id = id; // ✅ string ID — لا Number()
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
    data.id = id; // ✅ string ID
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
    data.id = id; // ✅ string ID
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
    renderSearchResults(results, activeType);
  } catch (err) {
    console.error(err);
    resultsArea.innerHTML = `<div class="search-hint" style="color:var(--danger)">❌ خطأ في البحث: ${err.message}</div>`;
  }
}

function renderSearchResults(results, type) {
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
          <td>${escHtml(s.classId || '—')}</td>
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
          <td>${escHtml(s.classId || '—')}</td>
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
// طباعة التقارير
// ============================================================
async function printServantsReport(date) {
  const [servants, classes, attendanceRecs] = await Promise.all([
    db.getAll('servants'), db.getAll('classes'),
    db.getAttendanceForDateAndType(date, 'servant')
  ]);
  const attMap = {}; attendanceRecs.forEach(r => attMap[r.personId] = r.status);
  const classMap = {}; classes.forEach(c => classMap[String(c.id)] = c.name);
  const rows = servants.map((s, i) => `
    <tr>
      <td>${i+1}</td><td>${escHtml(s.name)}</td>
      <td>${formatDateAr(s.birthDate)}</td><td>${calcAge(s.birthDate)}</td>
      <td>${escHtml(classMap[String(s.classId)] || '—')}</td>
      <td>${escHtml(s.phone || '—')}</td>
      <td class="${attMap[String(s.id)] === 'present' ? 'att-p' : attMap[String(s.id)] === 'absent' ? 'att-a' : 'att-n'}">
        ${attMap[String(s.id)] === 'present' ? '✓ حاضر' : attMap[String(s.id)] === 'absent' ? '✗ غائب' : '—'}
      </td>
    </tr>`).join('');
  openPrintWindow('تقرير الخدام', date, rows,
    '<th>#</th><th>الاسم</th><th>تاريخ الميلاد</th><th>العمر</th><th>الفصل</th><th>التليفون</th><th>الحضور</th>',
    servants.length, servants.filter(s => attMap[String(s.id)] === 'present').length,
    servants.filter(s => attMap[String(s.id)] === 'absent').length);
}

async function printClassReport(classId, className, date) {
  const [students, attendanceRecs] = await Promise.all([
    db.getByIndex('students', 'classId', classId),
    db.getAttendanceForDateAndType(date, 'student')
  ]);
  const attMap = {}; attendanceRecs.forEach(r => attMap[r.personId] = r.status);
  const rows = students.map((s, i) => `
    <tr>
      <td>${i+1}</td><td>${escHtml(s.name)}</td><td>${escHtml(s.father || '—')}</td>
      <td>${formatDateAr(s.birthDate)}</td><td>${calcAge(s.birthDate)}</td>
      <td>${escHtml(s.phone || s.fatherPhone || '—')}</td>
      <td class="${attMap[String(s.id)] === 'present' ? 'att-p' : attMap[String(s.id)] === 'absent' ? 'att-a' : 'att-n'}">
        ${attMap[String(s.id)] === 'present' ? '✓ حاضر' : attMap[String(s.id)] === 'absent' ? '✗ غائب' : '—'}
      </td>
    </tr>`).join('');
  openPrintWindow(`تقرير فصل: ${className}`, date, rows,
    '<th>#</th><th>الاسم</th><th>اسم الأب</th><th>تاريخ الميلاد</th><th>العمر</th><th>التليفون</th><th>الحضور</th>',
    students.length, students.filter(s => attMap[String(s.id)] === 'present').length,
    students.filter(s => attMap[String(s.id)] === 'absent').length);
}

async function printAllClassesReport(date) {
  const classes = await db.getAll('classes');
  for (const cls of classes) await printClassReport(String(cls.id), cls.name, date);
}

function openPrintWindow(title, date, rows, headers, total, present, absent) {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head>
  <meta charset="UTF-8"><title>${title}</title>
  <style>
    body{font-family:'Cairo',sans-serif;margin:20px;direction:rtl;color:#111}
    h1{text-align:center;color:#8B5E0A;font-size:18px}
    .sub{text-align:center;color:#555;font-size:12px;margin-bottom:16px}
    .stats{display:flex;gap:20px;justify-content:center;margin:12px 0}
    .stat{background:#f5f5f5;padding:8px 20px;border-radius:8px;text-align:center}
    .stat b{font-size:22px;display:block}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#8B5E0A;color:#fff;padding:8px;text-align:center}
    td{padding:6px;border:1px solid #ddd;text-align:center}
    tr:nth-child(even){background:#fafaf0}
    .att-p{color:green;font-weight:bold} .att-a{color:red;font-weight:bold}
    @media print{button{display:none}}
  </style></head><body>
  <h1>✝ بسم الثالوث القدوس</h1>
  <div class="sub">كنيسة السيدة العذراء مريم بالشامية — خدمة مدارس الأحد الابتدائي</div>
  <div class="sub">${title} — ${formatDateAr(date)}</div>
  <div class="stats">
    <div class="stat"><b>${total}</b>الإجمالي</div>
    <div class="stat" style="color:green"><b>${present}</b>حاضر</div>
    <div class="stat" style="color:red"><b>${absent}</b>غائب</div>
  </div>
  <table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
  <br><button onclick="window.print()" style="width:100%;padding:12px;background:#8B5E0A;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;font-family:Cairo,sans-serif">🖨️ طباعة / حفظ PDF</button>
  </body></html>`);
  w.document.close();
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
