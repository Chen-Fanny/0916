/**
 * Personal Page Dashboard Engine
 * Handles live clock, date, dynamic greetings, user personalization, and widgets.
 */

(function () {
  'use strict';

  const storedName = localStorage.getItem('personal_user_name');
  const initialName = (storedName && storedName !== 'Alex') ? storedName : 'Fanny';

  // --- State & Defaults ---
  const STATE = {
    name: initialName,
    tagline: localStorage.getItem('personal_tagline') || 'Designing the future, one moment at a time.',
    format24: localStorage.getItem('personal_time_format') !== '12h', // Default 24h
    currentThemeIndex: parseInt(localStorage.getItem('personal_theme_idx') || '0', 10),
    themes: ['theme-cosmic', 'theme-aurora', 'theme-sunset'],
    themeLabels: ['Cosmic', 'Aurora', 'Sunset'],
    quotes: [
      { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
      { text: "Simplicity is prerequisite for reliability.", author: "Edsger W. Dijkstra" },
      { text: "Make it work, make it right, make it fast.", author: "Kent Beck" },
      { text: "Time you enjoy wasting is not wasted time.", author: "Marthe Troly-Curtin" },
      { text: "Creativity is intelligence having fun.", author: "Albert Einstein" },
      { text: "Focus is a muscle. The more you practice, the stronger it becomes.", author: "Anonymous" },
      { text: "What we do today is what matters most.", author: "Buddha" },
      { text: "Turn your wounds into wisdom.", author: "Oprah Winfrey" }
    ],
    customLinks: JSON.parse(localStorage.getItem('personal_custom_links') || '[]')
  };

  // --- DOM Elements ---
  const elHours = document.getElementById('hours');
  const elMinutes = document.getElementById('minutes');
  const elSeconds = document.getElementById('seconds');
  const elAmpm = document.getElementById('ampm');
  const elFormattedDate = document.getElementById('formatted-date');
  const elTimezoneTag = document.getElementById('timezone-tag');
  const elWeekNumber = document.getElementById('week-number');
  const elSecondsFill = document.getElementById('seconds-track-fill');

  const elGreetingText = document.getElementById('greeting-text');
  const elGreetingIcon = document.getElementById('day-moment-icon');
  const elNameDisplay = document.getElementById('name-display');
  const elTaglineText = document.getElementById('tagline-text');
  const elEditNameBtn = document.getElementById('edit-name-btn');
  const elEditTaglineBtn = document.getElementById('edit-tagline-btn');

  const elFormatToggle = document.getElementById('format-toggle');
  const elFormatLabel = document.getElementById('format-label');
  const elThemeToggle = document.getElementById('theme-toggle');
  const elThemeLabel = document.getElementById('theme-label');

  const elDayProgressLabel = document.getElementById('day-progress-label');
  const elDayProgressBar = document.getElementById('day-progress-bar');
  const elDayProgressDetail = document.getElementById('day-progress-detail');

  const elQuoteText = document.getElementById('quote-text');
  const elQuoteAuthor = document.getElementById('quote-author');
  const elRefreshQuoteBtn = document.getElementById('refresh-quote-btn');

  const elShortcutsContainer = document.getElementById('shortcuts-container');
  const elAddLinkBtn = document.getElementById('add-link-btn');

  const elEditModal = document.getElementById('edit-modal');
  const elProfileForm = document.getElementById('profile-form');
  const elNameInput = document.getElementById('name-input');
  const elTaglineInput = document.getElementById('tagline-input');
  const elModalCancelBtn = document.getElementById('modal-cancel-btn');

  // --- Helper Functions ---
  function padZero(num) {
    return String(num).padStart(2, '0');
  }

  function getWeekNumber(d) {
    const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNr = (target.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
      target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000);
  }

  function detectTimezone() {
    try {
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
      const offsetMinutes = -new Date().getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const hours = padZero(Math.floor(Math.abs(offsetMinutes) / 60));
      const mins = padZero(Math.abs(offsetMinutes) % 60);
      return `UTC${sign}${hours}:${mins} • ${tzName.split('/').pop().replace('_', ' ')}`;
    } catch (e) {
      return 'Local Time';
    }
  }

  // --- Clock & Time Engine ---
  function updateClock() {
    const now = new Date();
    const rawHours = now.getHours();
    const rawMinutes = now.getMinutes();
    const rawSeconds = now.getSeconds();
    const rawMillis = now.getMilliseconds();

    // 12h vs 24h calculation
    let displayHours = rawHours;
    let ampmStr = '';

    if (!STATE.format24) {
      ampmStr = displayHours >= 12 ? 'PM' : 'AM';
      displayHours = displayHours % 12;
      displayHours = displayHours ? displayHours : 12; // '0' should be '12'
      elAmpm.style.display = 'inline-block';
      elAmpm.textContent = ampmStr;
    } else {
      elAmpm.style.display = 'none';
    }

    elHours.textContent = padZero(displayHours);
    elMinutes.textContent = padZero(rawMinutes);
    elSeconds.textContent = padZero(rawSeconds);

    // Smooth seconds track fill
    const secondProgress = ((rawSeconds * 1000 + rawMillis) / 60000) * 100;
    elSecondsFill.style.width = `${Math.min(100, Math.max(0, secondProgress))}%`;

    // Dynamic Greeting (Time-sensitive)
    updateGreeting(rawHours);

    // Day Progress Tracking (00:00 to 23:59:59)
    const secondsPassed = rawHours * 3600 + rawMinutes * 60 + rawSeconds;
    const totalDaySeconds = 86400;
    const dayPercent = ((secondsPassed / totalDaySeconds) * 100).toFixed(1);
    const hoursRemaining = Math.max(0, 23 - rawHours);
    const minsRemaining = Math.max(0, 59 - rawMinutes);

    elDayProgressLabel.textContent = `${dayPercent}%`;
    elDayProgressBar.style.width = `${dayPercent}%`;
    elDayProgressDetail.textContent = `${hoursRemaining}h ${minsRemaining}m left today`;
  }

  function updateDateAndMeta() {
    const now = new Date();

    // Format: "Wednesday, September 16, 2026"
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    elFormattedDate.textContent = now.toLocaleDateString(undefined, options);

    // Week number
    elWeekNumber.textContent = `Week ${padZero(getWeekNumber(now))}`;

    // Timezone badge
    elTimezoneTag.textContent = detectTimezone();
  }

  function updateGreeting(hours) {
    let greeting = 'Hello';
    let icon = '✨';

    if (hours >= 5 && hours < 12) {
      greeting = 'Good morning';
      icon = '🌅';
    } else if (hours >= 12 && hours < 17) {
      greeting = 'Good afternoon';
      icon = '☀️';
    } else if (hours >= 17 && hours < 21) {
      greeting = 'Good evening';
      icon = '🌆';
    } else {
      greeting = 'Good night';
      icon = '🌙';
    }

    elGreetingText.textContent = greeting;
    elGreetingIcon.textContent = icon;
  }

  // --- Profile & Personalization ---
  function renderProfile() {
    elNameDisplay.textContent = STATE.name;
    elTaglineText.textContent = STATE.tagline;
    document.title = `${STATE.name}'s Personal Space | Live Dashboard`;
  }

  function openEditModal() {
    elNameInput.value = STATE.name;
    elTaglineInput.value = STATE.tagline;
    if (typeof elEditModal.showModal === 'function') {
      elEditModal.showModal();
    } else {
      const newName = prompt('Enter your name:', STATE.name);
      if (newName && newName.trim()) {
        saveProfile(newName.trim(), STATE.tagline);
      }
    }
  }

  function saveProfile(name, tagline) {
    STATE.name = name || 'Fanny';
    STATE.tagline = tagline || 'Designing the future, one moment at a time.';
    localStorage.setItem('personal_user_name', STATE.name);
    localStorage.setItem('personal_tagline', STATE.tagline);
    renderProfile();
  }

  // --- Theme Controller ---
  function applyTheme(index) {
    const safeIdx = (index + STATE.themes.length) % STATE.themes.length;
    STATE.currentThemeIndex = safeIdx;

    // Remove existing themes from body
    STATE.themes.forEach(theme => document.body.classList.remove(theme));
    document.body.classList.add(STATE.themes[safeIdx]);

    elThemeLabel.textContent = STATE.themeLabels[safeIdx];
    localStorage.setItem('personal_theme_idx', safeIdx.toString());
  }

  function cycleTheme() {
    applyTheme(STATE.currentThemeIndex + 1);
  }

  // --- Time Format Toggle ---
  function toggleFormat() {
    STATE.format24 = !STATE.format24;
    localStorage.setItem('personal_time_format', STATE.format24 ? '24h' : '12h');
    elFormatLabel.textContent = STATE.format24 ? '24H' : '12H';
    updateClock();
  }

  // --- Quotes Widget ---
  function getRandomQuote() {
    const randomIndex = Math.floor(Math.random() * STATE.quotes.length);
    const quote = STATE.quotes[randomIndex];
    elQuoteText.textContent = `"${quote.text}"`;
    elQuoteAuthor.textContent = `— ${quote.author}`;
  }

  // --- Shortcuts & Custom Links ---
  function renderCustomLinks() {
    // Remove previously rendered dynamic links (keep default pills and add-link-btn)
    const dynamicLinks = elShortcutsContainer.querySelectorAll('.dynamic-shortcut');
    dynamicLinks.forEach(item => item.remove());

    STATE.customLinks.forEach((link, idx) => {
      const a = document.createElement('a');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'shortcut-pill dynamic-shortcut';
      a.innerHTML = `<span>${link.title}</span>`;
      elShortcutsContainer.insertBefore(a, elAddLinkBtn);
    });
  }

  function handleAddLink() {
    const title = prompt('Enter a label for your shortcut (e.g., Notion, Spotify):');
    if (!title || !title.trim()) return;

    let url = prompt('Enter the link URL (e.g., https://notion.so):');
    if (!url || !url.trim()) return;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url.trim();
    }

    STATE.customLinks.push({ title: title.trim(), url: url.trim() });
    localStorage.setItem('personal_custom_links', JSON.stringify(STATE.customLinks));
    renderCustomLinks();
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Open profile modal
    elEditNameBtn.addEventListener('click', openEditModal);
    elNameDisplay.addEventListener('click', openEditModal);
    elEditTaglineBtn.addEventListener('click', openEditModal);
    elTaglineText.addEventListener('click', openEditModal);

    // Modal controls
    elModalCancelBtn.addEventListener('click', () => {
      elEditModal.close();
    });

    elProfileForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredName = elNameInput.value.trim();
      const enteredTagline = elTaglineInput.value.trim();
      if (enteredName) {
        saveProfile(enteredName, enteredTagline);
      }
      elEditModal.close();
    });

    // Close on backdrop click
    elEditModal.addEventListener('click', (e) => {
      const rect = elEditModal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        elEditModal.close();
      }
    });

    // Format & Theme toggles
    elFormatToggle.addEventListener('click', toggleFormat);
    elThemeToggle.addEventListener('click', cycleTheme);

    // Quote refresh
    elRefreshQuoteBtn.addEventListener('click', getRandomQuote);

    // Add custom shortcut
    elAddLinkBtn.addEventListener('click', handleAddLink);

    // Keyboard shortcut: Press Escape to close modal, or 'E' to edit name
    document.addEventListener('keydown', (e) => {
      if (e.key === 'e' && !elEditModal.open && document.activeElement.tagName !== 'INPUT') {
        openEditModal();
      }
    });
  }

  // --- Initialization ---
  function init() {
    renderProfile();
    applyTheme(STATE.currentThemeIndex);
    elFormatLabel.textContent = STATE.format24 ? '24H' : '12H';

    updateDateAndMeta();
    updateClock();
    getRandomQuote();
    renderCustomLinks();
    setupEventListeners();

    // High frequency clock tick with requestAnimationFrame or tight interval
    setInterval(updateClock, 250);

    // Refresh date / timezone once a minute
    setInterval(updateDateAndMeta, 60000);
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
