export const APP_NAME = 'Collage Maker for Schools';
export const APP_VERSION = '1.0.0';
export const DEVELOPER = 'Jeevan Varghese';
export const DEVELOPER_LINK = 'https://itsjeevanvarghese.web.app';

export const BACKUP_SCHEMA_VERSION = 1;

// A4 portrait width in millimetres — the collage canvas width is always 210mm.
export const A4_WIDTH_MM = 210;
export const DEFAULT_DPI = 300;
export const MM_PER_INCH = 25.4;

// Student photos always use a 3:4 portrait ratio.
export const PHOTO_RATIO_W = 3;
export const PHOTO_RATIO_H = 4;

export const DEFAULT_CATEGORIES = [
  'Arts',
  'Sports',
  'Work Experience',
  'Full A+',
  '5 A+',
];

export const DEFAULT_ITEM_NAME = 'General';

export const GENDERS = ['Male', 'Female', 'Other'];

export const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  ERROR: 'error',
};

export const MODE = {
  ONLINE: 'online',
  OFFLINE: 'offline',
};

export const STUDENT_CSV_COLUMNS = [
  'Name',
  'Gender',
  'Roll Number',
  'Admission Number',
  'Class',
];

export const RESULT_CSV_COLUMNS = [
  'Student Name',
  'Gender',
  'Roll Number',
  'Admission Number',
  'Class',
  'Category',
  'Item',
  'Grade',
  'Position',
  'Marks',
  'Student ID',
  'Category ID',
  'Item ID',
  'Participation ID',
];

export const COLLAGE_DETAIL_FIELDS = [
  { key: 'photo', label: 'Photo' },
  { key: 'name', label: 'Name' },
  { key: 'className', label: 'Class' },
  { key: 'gender', label: 'Gender' },
  { key: 'admissionNumber', label: 'Admission Number' },
  { key: 'rollNumber', label: 'Roll Number' },
  { key: 'category', label: 'Category' },
  { key: 'item', label: 'Item' },
  { key: 'position', label: 'Position' },
  { key: 'grade', label: 'Grade' },
  { key: 'marks', label: 'Marks' },
];

export const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Sans)' },
  { value: 'Poppins', label: 'Poppins (Display)' },
  { value: 'Georgia', label: 'Georgia (Serif)' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Courier New', label: 'Courier New (Mono)' },
];

export const TEXT_ALIGN_OPTIONS = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

// Maximum canvas dimensions supported by most browsers (safety guard).
export const MAX_CANVAS_DIMENSION = 32767;

// JPEG export quality default.
export const DEFAULT_JPEG_QUALITY = 0.95;

export const LOCAL_BACKUP_KEY = 'cms_last_safety_backup';
