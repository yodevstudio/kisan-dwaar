// Single shared Firebase App instance. Every services/ module imports
// `app` from here instead of calling initializeApp itself — Firebase
// throws if initializeApp runs twice for the same config in one page, and
// S1's session.js and S2's upload.js both need an app instance.
import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';

export const app = initializeApp(firebaseConfig);
