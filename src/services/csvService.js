import Papa from 'papaparse';
import { STUDENT_CSV_COLUMNS, RESULT_CSV_COLUMNS } from '@/constants';
import { downloadBlob, todayStamp } from '@/utils';

function parse(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => resolve(res),
      error: reject,
    });
  });
}

function serialize(rows, columns) {
  return Papa.unparse({
    fields: columns,
    data: rows.map((r) => columns.map((c) => r[c] ?? '')),
  });
}

// ---------- Students ----------
export async function parseStudentCsv(file) {
  const res = await parse(file);
  const headers = (res.meta.fields || []).map((h) => h.trim());
  const required = STUDENT_CSV_COLUMNS.map((c) => c.toLowerCase());
  const missing = required.filter(
    (r) => !headers.map((h) => h.toLowerCase()).includes(r)
  );
  const valid = [];
  const invalid = [];
  res.data.forEach((row, idx) => {
    const get = (key) => {
      const found = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === key.toLowerCase()
      );
      return found ? (row[found] ?? '').toString().trim() : '';
    };
    const name = get('Name');
    const className = get('Class');
    const rec = {
      name,
      gender: get('Gender'),
      rollNumber: get('Roll Number'),
      admissionNumber: get('Admission Number'),
      className,
    };
    if (!name || !className) {
      invalid.push({ row: idx + 2, data: rec, reason: 'Name and Class are required' });
    } else {
      valid.push(rec);
    }
  });
  return { headers, missing, valid, invalid, rawCount: res.data.length };
}

export function exportStudentsCsv(students) {
  const rows = students.map((s) => ({
    Name: s.name,
    Gender: s.gender,
    'Roll Number': s.rollNumber,
    'Admission Number': s.admissionNumber,
    Class: s.className,
  }));
  const csv = serialize(rows, STUDENT_CSV_COLUMNS);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `students-${todayStamp()}.csv`);
}

export function exportBlankStudentsCsv() {
  const csv = serialize([], STUDENT_CSV_COLUMNS);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `students-blank-template.csv`);
}

// ---------- Results ----------
export async function parseResultsCsv(file) {
  const res = await parse(file);
  const headers = (res.meta.fields || []).map((h) => h.trim());
  const required = RESULT_CSV_COLUMNS.slice(0, 10).map((c) => c.toLowerCase());
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const missing = required.filter((r) => !lowerHeaders.includes(r));
  const valid = [];
  const invalid = [];
  res.data.forEach((row, idx) => {
    const get = (key) => {
      const found = Object.keys(row).find(
        (k) => k.trim().toLowerCase() === key.toLowerCase()
      );
      return found ? (row[found] ?? '').toString().trim() : '';
    };
    const rec = {
      studentName: get('Student Name'),
      gender: get('Gender'),
      rollNumber: get('Roll Number'),
      admissionNumber: get('Admission Number'),
      className: get('Class'),
      category: get('Category'),
      item: get('Item'),
      grade: get('Grade'),
      position: get('Position'),
      marks: get('Marks'),
      studentId: get('Student ID'),
      categoryId: get('Category ID'),
      itemId: get('Item ID'),
      participationId: get('Participation ID'),
    };
    if (!rec.studentName || !rec.className || !rec.category || !rec.item) {
      invalid.push({
        row: idx + 2,
        data: rec,
        reason: 'Student Name, Class, Category and Item are required',
      });
    } else {
      valid.push(rec);
    }
  });
  return { headers, missing, valid, invalid, rawCount: res.data.length };
}

export function exportResultsCsv(rows) {
  const data = rows.map((r) => ({
    'Student Name': r.studentName,
    Gender: r.gender,
    'Roll Number': r.rollNumber,
    'Admission Number': r.admissionNumber,
    Class: r.className,
    Category: r.category,
    Item: r.item,
    Grade: r.grade,
    Position: r.position,
    Marks: r.marks,
    'Student ID': r.studentId,
    'Category ID': r.categoryId,
    'Item ID': r.itemId,
    'Participation ID': r.participationId,
  }));
  const csv = serialize(data, RESULT_CSV_COLUMNS);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `results-${todayStamp()}.csv`);
}

export function exportBlankResultsCsv() {
  const csv = serialize([], RESULT_CSV_COLUMNS);
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `results-blank-template.csv`);
}
