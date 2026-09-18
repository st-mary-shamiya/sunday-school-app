/**
 * db.js — قاعدة بيانات Firebase Firestore
 * كنيسة السيدة العذراء مريم بالشامية - مدارس الأحد
 * تعمل على جميع الأجهزة مع مزامنة فورية للبيانات السحابية
 */

class SundaySchoolDB {
  constructor() {
    this._db = null;
    this._initialized = false;
  }

  async open() {
    if (this._initialized) return;
    await this._waitForFirebase();
    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    this._db = getFirestore(window.firebaseApp);
    this._initialized = true;
    console.log('✅ Firebase Firestore جاهز');
  }

  _waitForFirebase(timeout = 15000) {
    return new Promise((resolve, reject) => {
      if (window.firebaseApp) { resolve(); return; }
      const start = Date.now();
      const check = setInterval(() => {
        if (window.firebaseApp) { clearInterval(check); resolve(); }
        else if (Date.now() - start > timeout) {
          clearInterval(check);
          reject(new Error('Firebase لم يتهيأ. تحقق من firebase-config.js'));
        }
      }, 100);
    });
  }

  // توليد ID فريد
  _newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ─── CRUD عام ───────────────────────────────────────

  async add(storeName, data) {
    const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const id = data.id || this._newId();
    const record = { ...data, id, createdAt: data.createdAt || new Date().toISOString() };
    await setDoc(doc(this._db, storeName, String(id)), record);
    return id;
  }

  async put(storeName, data) {
    const { setDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const record = { ...data, updatedAt: new Date().toISOString() };
    await setDoc(doc(this._db, storeName, String(data.id)), record, { merge: true });
    return data.id;
  }

  async get(storeName, id) {
    const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDoc(doc(this._db, storeName, String(id)));
    return snap.exists() ? snap.data() : null;
  }

  async getAll(storeName) {
    const { getDocs, collection } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const snap = await getDocs(collection(this._db, storeName));
    return snap.docs.map(d => d.data());
  }

  async delete(storeName, id) {
    const { deleteDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    await deleteDoc(doc(this._db, storeName, String(id)));
  }

  async getByIndex(storeName, indexName, value) {
    const { getDocs, collection, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const q = query(collection(this._db, storeName), where(indexName, '==', value));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }

  async count(storeName) {
    const all = await this.getAll(storeName);
    return all.length;
  }

  // ─── الحضور ─────────────────────────────────────────

  _attendanceId(personId, personType, date) {
    return `${personType}_${personId}_${date}`;
  }

  async getAttendance(personId, personType, date) {
    return this.get('attendance', this._attendanceId(personId, personType, date));
  }

  async setAttendance(personId, personType, date, status, notes = '') {
    const id = this._attendanceId(personId, personType, date);
    const record = {
      id,
      personId: String(personId),
      personType,
      date,
      status,
      notes,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    return this.put('attendance', record);
  }

  async getAttendanceForDateAndType(date, personType) {
    const { getDocs, collection, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const q = query(
      collection(this._db, 'attendance'),
      where('date', '==', date),
      where('personType', '==', personType)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }

  async getAllAttendanceForPerson(personId, personType) {
    const { getDocs, collection, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const q = query(
      collection(this._db, 'attendance'),
      where('personId', '==', String(personId)),
      where('personType', '==', personType)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data());
  }

  // ─── تصدير واستيراد ─────────────────────────────────

  async exportAll() {
    const [servants, classes, students, attendance] = await Promise.all([
      this.getAll('servants'),
      this.getAll('classes'),
      this.getAll('students'),
      this.getAll('attendance')
    ]);
    return {
      version: 2,
      exportDate: new Date().toISOString(),
      servants, classes, students, attendance
    };
  }

  async importAll(data) {
    const stores = ['servants', 'classes', 'students', 'attendance'];
    for (const storeName of stores) {
      if (!data[storeName]) continue;
      const existing = await this.getAll(storeName);
      for (const item of existing) await this.delete(storeName, item.id);
      for (const item of data[storeName]) await this.add(storeName, item);
    }
  }

  // ─── بحث ────────────────────────────────────────────

  async searchByName(queryStr) {
    const q = queryStr.trim().toLowerCase();
    const [servants, students] = await Promise.all([this.getAll('servants'), this.getAll('students')]);
    return {
      servants: servants.filter(s => s.name && s.name.toLowerCase().includes(q)),
      students: students.filter(s => s.name && s.name.toLowerCase().includes(q))
    };
  }

  async searchByBirthdate(queryStr) {
    const q = queryStr.trim();
    const [servants, students] = await Promise.all([this.getAll('servants'), this.getAll('students')]);
    return {
      servants: servants.filter(s => s.birthDate && s.birthDate.includes(q)),
      students: students.filter(s => s.birthDate && s.birthDate.includes(q))
    };
  }

  async searchByAttendance(date, status) {
    const { getDocs, collection, query, where } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const [servants, students, attSnap] = await Promise.all([
      this.getAll('servants'),
      this.getAll('students'),
      getDocs(query(collection(this._db, 'attendance'), where('date', '==', date)))
    ]);

    const attendanceRecs = attSnap.docs.map(d => d.data());
    const servantAtt = attendanceRecs.filter(r => r.personType === 'servant');
    const studentAtt = attendanceRecs.filter(r => r.personType === 'student');

    if (status === 'not-recorded') {
      const recSIds  = new Set(servantAtt.map(r => String(r.personId)));
      const recStIds = new Set(studentAtt.map(r => String(r.personId)));
      return {
        servants: servants.filter(s => !recSIds.has(String(s.id))),
        students: students.filter(s => !recStIds.has(String(s.id)))
      };
    }

    const sIds  = new Set(servantAtt.filter(r => r.status === status).map(r => String(r.personId)));
    const stIds = new Set(studentAtt.filter(r => r.status === status).map(r => String(r.personId)));
    return {
      servants: servants.filter(s => sIds.has(String(s.id))),
      students: students.filter(s => stIds.has(String(s.id)))
    };
  }
}

const db = new SundaySchoolDB();
