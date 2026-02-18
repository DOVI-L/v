const firebaseConfig = {
    apiKey: "AIzaSyBRunXdWIFiP8-vZao0WZ6WxItMAUt-ORY",
    authDomain: "ezer--project.firebaseapp.com",
    databaseURL: "https://ezer--project-default-rtdb.firebaseio.com",
    projectId: "ezer--project",
    storageBucket: "ezer--project.firebasestorage.app",
    messagingSenderId: "838086109276",
    appId: "1:838086109276:web:201babf8b31c39a0cc9e99"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);

const SHIURIM_ORDER = ['שיעור א', 'שיעור ב', 'שיעור ג', 'קיבוץ א', 'קיבוץ ב', 'קיבוץ ג', 'קיבוץ ד', 'קיבוץ ה', 'קיבוץ ו', 'קיבוץ ז', 'קיבוץ ח'];
const HEBREW_YEARS_MAPPING = {
    'תש״פ': '5780', 'תשפ״א': '5781', 'תשפ״ב': '5782', 'תשפ״ג': '5783', 
    'תשפ״ד': '5784', 'תשפ״ה': '5785', 'תשפ״ו': '5786', 'תשפ״ז': '5787'
};

const PREDEFINED_FIELDS = {
    students: [
        {k:'firstName', l:'שם פרטי', t:'text', r:true},
        {k:'lastName', l:'שם משפחה', t:'text', r:true},
        {k:'studentNum', l:'מספר מזהה', t:'text'},
        {k:'phone', l:'טלפון', t:'text'},
        {k:'grade', l:'שיעור', t:'select', opts:SHIURIM_ORDER},
        {k:'entryYear', l:'שנת כניסה', t:'text'}, 
        {k:'idNum', l:'תעודת זהות', t:'text'},
        {k:'city', l:'עיר מגורים', t:'text'},
        {k:'fatherName', l:'שם האב', t:'text'},
        {k:'room', l:'מספר חדר', t:'text'}
    ],
    donors: [
        {k:'firstName', l:'שם פרטי', t:'text', r:true},
        {k:'lastName', l:'שם משפחה', t:'text', r:true},
        {k:'city', l:'עיר', t:'text'},
        {k:'neighborhood', l:'שכונה', t:'text'},
        {k:'street', l:'רחוב', t:'text'},
        {k:'floor', l:'קומה', t:'text'},
        {k:'phone', l:'טלפון', t:'text'},
        {k:'email', l:'אימייל', t:'email'},
        {k:'referrerId', l:'בחור מביא', t:'referrer_select'},
        {k:'notes', l:'הערות', t:'textarea'},
        {k:'vip', l:'VIP', t:'checkbox'}
    ]
};

const DEFAULT_ACTIVE_FIELDS = {
    students: ['firstName', 'lastName', 'studentNum', 'phone','grade','entryYear'],
    donors: ['firstName', 'lastName', 'city', 'neighborhood', 'street', 'floor', 'phone', 'notes']
};

window.db = db;
window.auth = auth;
window.firebaseConfig = firebaseConfig;
window.SHIURIM_ORDER = SHIURIM_ORDER;
window.HEBREW_YEARS_MAPPING = HEBREW_YEARS_MAPPING;
window.PREDEFINED_FIELDS = PREDEFINED_FIELDS;
window.DEFAULT_ACTIVE_FIELDS = DEFAULT_ACTIVE_FIELDS;

// --- מפתח AI שיוזרק על ידי גיטהאב ---
window.GEMINI_API_KEY = "__GEMINI_KEY_PLACEHOLDER__";