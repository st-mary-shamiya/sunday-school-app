/**
 * pdf-export.js — تصدير تقارير PDF عبر نافذة الطباعة
 */

const CHURCH_HEADER_HTML = `
  <div class="print-header">
    <div class="print-cross">✝</div>
    <div class="print-church-info">
      <p class="print-blessing">بسم الثالوث القدوس</p>
      <h1>كنيسة السيدة العذراء مريم بالشامية</h1>
      <p>خدمة مدارس الأحد الابتدائي</p>
      <p>السنة القبطية 1743 للشهداء</p>
    </div>
  </div>
`;

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; color: #1a1a2e; background: #fff; padding: 20px; }
  .print-header { text-align: center; padding: 20px; border-bottom: 3px solid #D4AF37; margin-bottom: 20px; background: linear-gradient(135deg, #0B1628 0%, #1A2A4A 100%); color: white; border-radius: 10px; }
  .print-cross { font-size: 40px; color: #D4AF37; margin-bottom: 8px; }
  .print-blessing { font-size: 14px; color: #D4AF37; margin-bottom: 4px; }
  .print-church-info h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; color: #fff; }
  .print-church-info p { font-size: 13px; color: rgba(255,255,255,0.85); line-height: 1.5; }
  .report-title { text-align: center; margin: 20px 0 10px; font-size: 22px; font-weight: 800; color: #0B1628; }
  .report-meta { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 20px; padding: 10px 15px; background: #f8f8f8; border-radius: 8px; border: 1px solid #e0e0e0; }
  .stats-row { display: flex; gap: 15px; margin-bottom: 20px; }
  .stat-box { flex: 1; text-align: center; padding: 12px; border-radius: 8px; border: 2px solid; }
  .stat-box.total { border-color: #D4AF37; background: #FFF9E6; }
  .stat-box.present { border-color: #4CAF50; background: #F1F8F1; }
  .stat-box.absent { border-color: #E53935; background: #FFF1F0; }
  .stat-box .num { font-size: 28px; font-weight: 800; display: block; }
  .stat-box .lbl { font-size: 12px; }
  .stat-box.total .num { color: #B8960C; }
  .stat-box.present .num { color: #2E7D32; }
  .stat-box.absent .num { color: #C62828; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #0B1628; color: #D4AF37; padding: 10px 8px; text-align: center; font-weight: 700; border: 1px solid #1A2A4A; }
  td { padding: 8px 10px; text-align: center; border: 1px solid #e0e0e0; }
  tr:nth-child(even) { background: #f9f9f9; }
  tr:hover { background: #FFF9E6; }
  .badge-present { background: #E8F5E9; color: #2E7D32; padding: 2px 10px; border-radius: 20px; font-weight: 700; font-size: 11px; border: 1px solid #4CAF50; }
  .badge-absent { background: #FFEBEE; color: #C62828; padding: 2px 10px; border-radius: 20px; font-weight: 700; font-size: 11px; border: 1px solid #E53935; }
  .badge-unknown { background: #F5F5F5; color: #757575; padding: 2px 10px; border-radius: 20px; font-size: 11px; border: 1px solid #bdbdbd; }
  .section-group { margin-top: 25px; }
  .section-group h3 { background: #1A2A4A; color: #D4AF37; padding: 8px 15px; border-radius: 6px; margin-bottom: 10px; font-size: 15px; }
  .print-footer { text-align: center; margin-top: 30px; padding-top: 15px; border-top: 2px solid #D4AF37; font-size: 11px; color: #888; }
  @media print { body { padding: 10px; } .no-print { display: none; } }
`;

function openPrintWindow(htmlContent, title) {
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>${PRINT_STYLES}</style>
    </head>
    <body>
      <div class="no-print" style="text-align:center;padding:15px;background:#f0f0f0;margin-bottom:20px;border-radius:8px;">
        <button onclick="window.print()" style="background:#D4AF37;color:#0B1628;border:none;padding:10px 30px;font-family:Cairo,Arial,sans-serif;font-size:16px;font-weight:700;border-radius:8px;cursor:pointer;margin-left:10px;">🖨️ طباعة / حفظ PDF</button>
        <button onclick="window.close()" style="background:#555;color:white;border:none;padding:10px 20px;font-family:Cairo,Arial,sans-serif;font-size:14px;border-radius:8px;cursor:pointer;">✕ إغلاق</button>
      </div>
      ${htmlContent}
    </body>
    </html>
  `);
  win.document.close();
}

function formatDateAr(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function calcAge(birthDate) {
  if (!birthDate) return '—';
  const birth = new Date(birthDate + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age + ' سنة';
}

// --- تقرير الخدام ---
async function printServantsReport(attendanceDate) {
  const [servants, classes, attendanceRecs] = await Promise.all([
    db.getAll('servants'),
    db.getAll('classes'),
    db.getAttendanceForDateAndType(attendanceDate, 'servant')
  ]);

  const classMap = {};
  classes.forEach(c => classMap[c.id] = c.name);

  const attMap = {};
  attendanceRecs.forEach(r => attMap[r.personId] = r.status);

  const present = servants.filter(s => attMap[s.id] === 'present').length;
  const absent = servants.filter(s => attMap[s.id] === 'absent').length;
  const notRecorded = servants.length - present - absent;

  const rows = servants.map((s, i) => {
    const status = attMap[s.id];
    const badge = status === 'present'
      ? `<span class="badge-present">✓ حاضر</span>`
      : status === 'absent'
        ? `<span class="badge-absent">✗ غائب</span>`
        : `<span class="badge-unknown">— لم يسجل</span>`;
    return `
      <tr>
        <td>${i + 1}</td>
        <td style="text-align:right;font-weight:600">${s.name}</td>
        <td>${formatDateAr(s.birthDate)}</td>
        <td>${calcAge(s.birthDate)}</td>
        <td>${classMap[s.classId] || '—'}</td>
        <td>${badge}</td>
        <td style="font-size:11px;color:#666">${s.notes || '—'}</td>
      </tr>`;
  }).join('');

  const html = `
    ${CHURCH_HEADER_HTML}
    <div class="report-title">📋 تقرير الخدام</div>
    <div class="report-meta">
      <span>📅 تاريخ التقرير: ${formatDateAr(attendanceDate)}</span>
      <span>🕐 وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG')}</span>
    </div>
    <div class="stats-row">
      <div class="stat-box total"><span class="num">${servants.length}</span><span class="lbl">إجمالي الخدام</span></div>
      <div class="stat-box present"><span class="num">${present}</span><span class="lbl">حاضر</span></div>
      <div class="stat-box absent"><span class="num">${absent}</span><span class="lbl">غائب</span></div>
      <div class="stat-box" style="border-color:#9E9E9E;background:#f5f5f5"><span class="num" style="color:#555">${notRecorded}</span><span class="lbl">لم يسجل</span></div>
    </div>
    <table>
      <thead>
        <tr><th>#</th><th>الاسم</th><th>تاريخ الميلاد</th><th>العمر</th><th>الفصل المسؤول</th><th>الحضور</th><th>ملاحظات</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="print-footer">
      كنيسة السيدة العذراء مريم بالشامية — خدمة مدارس الأحد الابتدائي — السنة القبطية 1743 للشهداء
    </div>
  `;

  openPrintWindow(html, 'تقرير الخدام');
}

// --- تقرير فصل ---
async function printClassReport(classId, className, attendanceDate) {
  const [students, attendanceRecs] = await Promise.all([
    db.getByIndex('students', 'classId', classId),
    db.getAttendanceForDateAndType(attendanceDate, 'student')
  ]);

  const classAttRecs = attendanceRecs.filter(r => {
    const st = students.find(s => s.id === r.personId);
    return st != null;
  });

  const attMap = {};
  classAttRecs.forEach(r => attMap[r.personId] = r.status);

  const present = students.filter(s => attMap[s.id] === 'present').length;
  const absent = students.filter(s => attMap[s.id] === 'absent').length;

  const rows = students.map((s, i) => {
    const status = attMap[s.id];
    const badge = status === 'present'
      ? `<span class="badge-present">✓ حاضر</span>`
      : status === 'absent'
        ? `<span class="badge-absent">✗ غائب</span>`
        : `<span class="badge-unknown">— لم يسجل</span>`;
    return `
      <tr>
        <td>${i + 1}</td>
        <td style="text-align:right;font-weight:600">${s.name}</td>
        <td>${formatDateAr(s.birthDate)}</td>
        <td>${calcAge(s.birthDate)}</td>
        <td>${badge}</td>
        <td style="font-size:11px;color:#666">${s.notes || '—'}</td>
      </tr>`;
  }).join('');

  const html = `
    ${CHURCH_HEADER_HTML}
    <div class="report-title">🏫 تقرير فصل: ${className}</div>
    <div class="report-meta">
      <span>📅 تاريخ التقرير: ${formatDateAr(attendanceDate)}</span>
      <span>🕐 وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG')}</span>
    </div>
    <div class="stats-row">
      <div class="stat-box total"><span class="num">${students.length}</span><span class="lbl">إجمالي المخدومين</span></div>
      <div class="stat-box present"><span class="num">${present}</span><span class="lbl">حاضر</span></div>
      <div class="stat-box absent"><span class="num">${absent}</span><span class="lbl">غائب</span></div>
      <div class="stat-box" style="border-color:#9E9E9E;background:#f5f5f5"><span class="num" style="color:#555">${students.length - present - absent}</span><span class="lbl">لم يسجل</span></div>
    </div>
    <table>
      <thead>
        <tr><th>#</th><th>الاسم</th><th>تاريخ الميلاد</th><th>العمر</th><th>الحضور</th><th>ملاحظات</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="print-footer">
      كنيسة السيدة العذراء مريم بالشامية — خدمة مدارس الأحد الابتدائي — السنة القبطية 1743 للشهداء
    </div>
  `;

  openPrintWindow(html, `تقرير فصل ${className}`);
}

// --- تقرير شامل لجميع الفصول ---
async function printAllClassesReport(attendanceDate) {
  const [classes, students, attendanceRecs] = await Promise.all([
    db.getAll('classes'),
    db.getAll('students'),
    db.getAttendanceForDateAndType(attendanceDate, 'student')
  ]);

  const attMap = {};
  attendanceRecs.forEach(r => attMap[r.personId] = r.status);

  let totalStudents = 0, totalPresent = 0, totalAbsent = 0;
  let sectionsHtml = '';

  for (const cls of classes) {
    const clsStudents = students.filter(s => s.classId === cls.id);
    const present = clsStudents.filter(s => attMap[s.id] === 'present').length;
    const absent = clsStudents.filter(s => attMap[s.id] === 'absent').length;

    totalStudents += clsStudents.length;
    totalPresent += present;
    totalAbsent += absent;

    const rows = clsStudents.map((s, i) => {
      const status = attMap[s.id];
      const badge = status === 'present'
        ? `<span class="badge-present">✓ حاضر</span>`
        : status === 'absent'
          ? `<span class="badge-absent">✗ غائب</span>`
          : `<span class="badge-unknown">— لم يسجل</span>`;
      return `<tr><td>${i + 1}</td><td style="text-align:right">${s.name}</td><td>${formatDateAr(s.birthDate)}</td><td>${calcAge(s.birthDate)}</td><td>${badge}</td></tr>`;
    }).join('');

    sectionsHtml += `
      <div class="section-group">
        <h3>🏫 ${cls.name} — (${clsStudents.length} مخدوم | حضر: ${present} | غاب: ${absent})</h3>
        ${clsStudents.length > 0 ? `<table><thead><tr><th>#</th><th>الاسم</th><th>تاريخ الميلاد</th><th>العمر</th><th>الحضور</th></tr></thead><tbody>${rows}</tbody></table>` : '<p style="padding:10px;color:#888;text-align:center">لا يوجد مخدومون مسجلون في هذا الفصل</p>'}
      </div>`;
  }

  const html = `
    ${CHURCH_HEADER_HTML}
    <div class="report-title">📚 التقرير الشامل للمخدومين</div>
    <div class="report-meta">
      <span>📅 تاريخ التقرير: ${formatDateAr(attendanceDate)}</span>
      <span>🕐 وقت الطباعة: ${new Date().toLocaleTimeString('ar-EG')}</span>
    </div>
    <div class="stats-row">
      <div class="stat-box total"><span class="num">${totalStudents}</span><span class="lbl">إجمالي المخدومين</span></div>
      <div class="stat-box present"><span class="num">${totalPresent}</span><span class="lbl">حاضر</span></div>
      <div class="stat-box absent"><span class="num">${totalAbsent}</span><span class="lbl">غائب</span></div>
      <div class="stat-box" style="border-color:#1A2A4A;background:#EEF0F8"><span class="num" style="color:#1A2A4A">${classes.length}</span><span class="lbl">عدد الفصول</span></div>
    </div>
    ${sectionsHtml}
    <div class="print-footer">
      كنيسة السيدة العذراء مريم بالشامية — خدمة مدارس الأحد الابتدائي — السنة القبطية 1743 للشهداء
    </div>
  `;

  openPrintWindow(html, 'التقرير الشامل للمخدومين');
}
