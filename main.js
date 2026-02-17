/**
 * Main Entry Point
 * רוב הלוגיקה של האתחול מתבצעת באופן אוטומטי כאשר Firebase Auth מזהה משתמש ב-auth.js.
 * קובץ זה משמש ללוגיקה גלובלית שצריכה לרוץ בסוף הטעינה, אם יש כזו.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('System Loaded: Waiting for Auth...');
    
    // טיפול בטעינת תמונות שנכשלה (למשל הלוגו) באופן גלובלי
    window.addEventListener('error', function(e) {
        if(e.target.tagName === 'IMG') {
            e.target.style.display = 'none';
            // אם זו תמונת לוגו, אפשר להציג טקסט חלופי
            if(e.target.classList.contains('logo-img-login') || e.target.classList.contains('logo-img-sidebar')) {
                const parent = e.target.parentElement;
                if(parent && !parent.querySelector('.fallback-text')) {
                    const text = document.createElement('h2');
                    text.className = 'fallback-text font-bold text-xl text-indigo-700';
                    text.innerText = 'עזר חתנים';
                    parent.appendChild(text);
                }
            }
        }
    }, true);
});