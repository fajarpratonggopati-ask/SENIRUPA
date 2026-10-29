(() => {
  const book = document.querySelector('#book');
  const papers = [...document.querySelectorAll('.paper')];
  const pages = [...document.querySelectorAll('.page[data-page]')];
  const prevButton = document.querySelector('#prev-button');
  const nextButton = document.querySelector('#next-button');
  const pageLabel = document.querySelector('#page-label');
  const progressBar = document.querySelector('#progress-bar');
  const progressPercent = document.querySelector('#progress-percent');
  const dotsWrap = document.querySelector('#page-dots');
  const tocDialog = document.querySelector('#toc-dialog');
  const turnCue = document.querySelector('#turn-cue');
  const fontButton = document.querySelector('#font-button');
  const readButton = document.querySelector('#read-button');
  const soundButton = document.querySelector('#sound-button');

  const totalSheets = papers.length;
  const totalPages = pages.length;
  const mobileQuery = window.matchMedia('(max-width: 820px)');
  let isMobile = mobileQuery.matches;
  let sheetPosition = 0;
  let mobilePage = 1;
  let soundOn = localStorage.getItem('komposisi:sound') !== 'off';
  let touchStartX = 0;
  let touchStartY = 0;
  let cueTimer;
  let audioContext;

  const safeStorage = {
    get(key, fallback = '') {
      try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* storage can be unavailable */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* storage can be unavailable */ }
    }
  };

  function showCue(message) {
    turnCue.textContent = message;
    turnCue.classList.add('show');
    clearTimeout(cueTimer);
    cueTimer = setTimeout(() => turnCue.classList.remove('show'), 1500);
  }

  function playPageSound(direction = 1) {
    if (!soundOn) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(direction > 0 ? 270 : 180, now);
      oscillator.frequency.exponentialRampToValueAtTime(direction > 0 ? 105 : 310, now + .16);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.06, now + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .18);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + .2);
    } catch { /* audio is decorative */ }
  }

  function labelForPage(pageNumber) {
    if (pageNumber === 1) return 'Sampul';
    if (pageNumber === totalPages) return 'Sampul Belakang';
    return `Halaman ${pageNumber}`;
  }

  function currentDesktopPages() {
    if (sheetPosition === 0) return [1];
    if (sheetPosition === totalSheets) return [totalPages];
    return [sheetPosition * 2, sheetPosition * 2 + 1];
  }

  function updateProgress() {
    let percentage;
    if (isMobile) {
      percentage = Math.round(((mobilePage - 1) / (totalPages - 1)) * 100);
      pageLabel.textContent = labelForPage(mobilePage);
      prevButton.disabled = mobilePage <= 1;
      nextButton.disabled = mobilePage >= totalPages;
      safeStorage.set('komposisi:last-page', String(mobilePage));
    } else {
      percentage = Math.round((sheetPosition / totalSheets) * 100);
      const visible = currentDesktopPages();
      pageLabel.textContent = visible.length === 1 ? labelForPage(visible[0]) : `Halaman ${visible[0]}–${visible[1]}`;
      prevButton.disabled = sheetPosition <= 0;
      nextButton.disabled = sheetPosition >= totalSheets;
      safeStorage.set('komposisi:last-page', String(visible.at(-1)));
    }
    progressBar.style.width = `${percentage}%`;
    progressPercent.textContent = `${percentage}% selesai`;
    [...dotsWrap.children].forEach((dot, index) => {
      const active = isMobile ? index === Math.floor((mobilePage - 1) / 2) : index === sheetPosition;
      dot.classList.toggle('active', active);
    });
  }

  function initializePaperStack() {
    papers.forEach((paper, index) => {
      const flipped = index < sheetPosition;
      paper.classList.toggle('flipped', flipped);
      paper.style.zIndex = flipped ? String(index + 1) : String(totalSheets - index);
    });
  }

  function renderMobilePage(previousPage = null, direction = 1) {
    pages.forEach(page => {
      page.classList.remove('mobile-current', 'mobile-turn-out');
    });
    if (previousPage && previousPage !== mobilePage) {
      const oldPage = pages[previousPage - 1];
      oldPage?.classList.add('mobile-turn-out');
      setTimeout(() => oldPage?.classList.remove('mobile-turn-out'), 430);
    }
    const nextPage = pages[mobilePage - 1];
    nextPage?.classList.add('mobile-current');
    nextPage?.querySelector('.page-inner')?.scrollTo({ top: 0, behavior: 'instant' });
    book.dataset.turnDirection = direction > 0 ? 'forward' : 'backward';
    updateProgress();
  }

  function nextDesktop() {
    if (sheetPosition >= totalSheets) return;
    const paper = papers[sheetPosition];
    paper.style.zIndex = String(totalSheets + 2);
    paper.classList.add('flipped');
    const completedPosition = sheetPosition + 1;
    setTimeout(() => { paper.style.zIndex = String(completedPosition); }, 470);
    sheetPosition = completedPosition;
    playPageSound(1);
    updateProgress();
  }

  function previousDesktop() {
    if (sheetPosition <= 0) return;
    sheetPosition -= 1;
    const paper = papers[sheetPosition];
    paper.style.zIndex = String(totalSheets - sheetPosition + 2);
    paper.classList.remove('flipped');
    setTimeout(() => { paper.style.zIndex = String(totalSheets - sheetPosition); }, 900);
    playPageSound(-1);
    updateProgress();
  }

  function nextPage() {
    stopReading();
    if (isMobile) {
      if (mobilePage >= totalPages) return;
      const previous = mobilePage;
      mobilePage += 1;
      renderMobilePage(previous, 1);
      playPageSound(1);
    } else {
      nextDesktop();
    }
  }

  function previousPage() {
    stopReading();
    if (isMobile) {
      if (mobilePage <= 1) return;
      const previous = mobilePage;
      mobilePage -= 1;
      renderMobilePage(previous, -1);
      playPageSound(-1);
    } else {
      previousDesktop();
    }
  }

  function goToPage(pageNumber, announce = true) {
    const target = Math.max(1, Math.min(totalPages, Number(pageNumber)));
    stopReading();
    if (isMobile) {
      const previous = mobilePage;
      mobilePage = target;
      renderMobilePage(previous, target >= previous ? 1 : -1);
    } else {
      sheetPosition = target === totalPages ? totalSheets : Math.floor(target / 2);
      book.classList.add('no-transition');
      initializePaperStack();
      requestAnimationFrame(() => requestAnimationFrame(() => book.classList.remove('no-transition')));
      updateProgress();
    }
    safeStorage.set('komposisi:last-page', String(target));
    if (announce) showCue(labelForPage(target));
  }

  function syncMode() {
    const wasMobile = isMobile;
    isMobile = mobileQuery.matches;
    document.body.classList.toggle('mobile-mode', isMobile);
    if (isMobile) {
      if (!wasMobile) {
        const visible = currentDesktopPages();
        mobilePage = visible.at(-1);
      }
      renderMobilePage(null);
    } else {
      if (wasMobile) sheetPosition = mobilePage === totalPages ? totalSheets : Math.floor(mobilePage / 2);
      pages.forEach(page => page.classList.remove('mobile-current', 'mobile-turn-out'));
      initializePaperStack();
      updateProgress();
    }
  }

  prevButton.addEventListener('click', previousPage);
  nextButton.addEventListener('click', nextPage);
  document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', nextPage));

  document.addEventListener('keydown', event => {
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA'].includes(tag)) return;
    if (event.key === 'ArrowRight') nextPage();
    if (event.key === 'ArrowLeft') previousPage();
  });

  book.addEventListener('click', event => {
    if (event.target.closest('button, input, textarea, summary, label, a')) return;
    const rect = book.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width;
    if (position > .89) nextPage();
    if (position < .11) previousPage();
  });

  book.addEventListener('touchstart', event => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });

  book.addEventListener('touchend', event => {
    if (event.target.closest('input, textarea, button, summary, label')) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) < 65 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    deltaX < 0 ? nextPage() : previousPage();
  }, { passive: true });

  document.querySelector('#toc-button').addEventListener('click', () => tocDialog.showModal());
  document.querySelector('#toc-close').addEventListener('click', () => tocDialog.close());
  tocDialog.addEventListener('click', event => {
    if (event.target === tocDialog) tocDialog.close();
  });
  document.querySelectorAll('[data-go-page]').forEach(button => {
    button.addEventListener('click', () => {
      tocDialog.close();
      goToPage(button.dataset.goPage);
    });
  });

  const savedLargeType = safeStorage.get('komposisi:large-type') === 'true';
  document.body.classList.toggle('large-type', savedLargeType);
  fontButton.setAttribute('aria-pressed', String(savedLargeType));
  fontButton.addEventListener('click', () => {
    const enabled = !document.body.classList.contains('large-type');
    document.body.classList.toggle('large-type', enabled);
    fontButton.setAttribute('aria-pressed', String(enabled));
    safeStorage.set('komposisi:large-type', String(enabled));
    showCue(enabled ? 'Huruf diperbesar' : 'Ukuran huruf normal');
  });

  function getVisiblePages() {
    if (isMobile) return [pages[mobilePage - 1]];
    return currentDesktopPages().map(number => pages[number - 1]).filter(Boolean);
  }

  function stopReading() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    document.body.classList.remove('reading');
    pages.forEach(page => page.classList.remove('speech-active'));
    readButton.setAttribute('aria-pressed', 'false');
  }

  readButton.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) {
      showCue('Pembaca suara tidak tersedia di peramban ini.');
      return;
    }
    if (document.body.classList.contains('reading')) {
      stopReading();
      return;
    }
    const visiblePages = getVisiblePages();
    const readableText = visiblePages.map(page => page.innerText.replace(/\s+/g, ' ').trim()).join('. ');
    if (!readableText) return;
    const utterance = new SpeechSynthesisUtterance(readableText);
    utterance.lang = 'id-ID';
    utterance.rate = .88;
    utterance.pitch = 1.03;
    utterance.onend = stopReading;
    utterance.onerror = stopReading;
    visiblePages.forEach(page => page.classList.add('speech-active'));
    document.body.classList.add('reading');
    readButton.setAttribute('aria-pressed', 'true');
    speechSynthesis.speak(utterance);
  });

  soundButton.setAttribute('aria-pressed', String(soundOn));
  soundButton.textContent = soundOn ? '♪' : '♩';
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn;
    soundButton.setAttribute('aria-pressed', String(soundOn));
    soundButton.textContent = soundOn ? '♪' : '♩';
    safeStorage.set('komposisi:sound', soundOn ? 'on' : 'off');
    if (soundOn) playPageSound(1);
    showCue(soundOn ? 'Bunyi halaman aktif' : 'Bunyi halaman dimatikan');
  });

  const observationForm = document.querySelector('#observation-form');
  observationForm.querySelectorAll('input').forEach(input => {
    const key = `komposisi:observation:${input.name}`;
    input.value = safeStorage.get(key);
    input.addEventListener('input', () => {
      safeStorage.set(key, input.value);
      const note = document.querySelector('#save-note');
      note.textContent = 'Tersimpan ✓';
      setTimeout(() => { note.textContent = 'Jawaban tersimpan otomatis.'; }, 1100);
    });
  });

  document.querySelectorAll('[data-save]').forEach(control => {
    const key = `komposisi:${control.dataset.save}`;
    if (control.type === 'checkbox') control.checked = safeStorage.get(key) === 'true';
    else control.value = safeStorage.get(key);
    const eventName = control.type === 'checkbox' ? 'change' : 'input';
    control.addEventListener(eventName, () => {
      safeStorage.set(key, control.type === 'checkbox' ? String(control.checked) : control.value);
    });
  });

  const quizItems = [...document.querySelectorAll('.quiz-item')];
  function applyQuizAnswer(item, selectedButton, quiet = false) {
    item.querySelectorAll('.choices button').forEach(button => {
      button.classList.remove('correct', 'wrong');
      button.setAttribute('aria-pressed', String(button === selectedButton));
    });
    item.classList.remove('answered-correct', 'answered-wrong');
    const feedback = item.querySelector('.feedback');
    if (selectedButton.dataset.correct === 'true') {
      selectedButton.classList.add('correct');
      item.classList.add('answered-correct');
      feedback.textContent = quiet ? 'Jawaban tersimpan: tepat.' : 'Tepat! Hebat, lanjutkan.';
    } else {
      selectedButton.classList.add('wrong');
      item.classList.add('answered-wrong');
      feedback.textContent = quiet ? 'Jawaban tersimpan: coba periksa lagi.' : 'Belum tepat. Baca petunjuknya lagi, lalu coba jawaban lain.';
    }
    safeStorage.set(`komposisi:quiz:${item.dataset.question}`, selectedButton.dataset.answer);
    updateScore();
  }

  quizItems.forEach(item => {
    const buttons = [...item.querySelectorAll('.choices button')];
    buttons.forEach(button => button.addEventListener('click', () => applyQuizAnswer(item, button)));
    const saved = safeStorage.get(`komposisi:quiz:${item.dataset.question}`);
    const savedButton = buttons.find(button => button.dataset.answer === saved);
    if (savedButton) applyQuizAnswer(item, savedButton, true);
  });

  function updateScore() {
    const correctCount = quizItems.filter(item => item.classList.contains('answered-correct')).length;
    document.querySelector('#score-value').textContent = `${correctCount} / ${quizItems.length}`;
    const answered = quizItems.filter(item => item.classList.contains('answered-correct') || item.classList.contains('answered-wrong')).length;
    const message = document.querySelector('#score-message');
    if (answered < quizItems.length) message.textContent = `Sudah dijawab ${answered} dari ${quizItems.length}.`;
    else if (correctCount === quizItems.length) message.textContent = 'Sempurna! Kamu menguasai semua konsep.';
    else if (correctCount >= 8) message.textContent = 'Bagus sekali! Periksa kembali jawaban yang belum tepat.';
    else if (correctCount >= 6) message.textContent = 'Kemajuan yang baik. Coba baca ulang halaman terkait.';
    else message.textContent = 'Terus berlatih. Kamu boleh mencoba sebanyak yang dibutuhkan.';
  }

  document.querySelector('#reset-quiz').addEventListener('click', () => {
    quizItems.forEach(item => {
      safeStorage.remove(`komposisi:quiz:${item.dataset.question}`);
      item.classList.remove('answered-correct', 'answered-wrong');
      item.querySelector('.feedback').textContent = '';
      item.querySelectorAll('button').forEach(button => {
        button.classList.remove('correct', 'wrong');
        button.setAttribute('aria-pressed', 'false');
      });
    });
    updateScore();
    showCue('Kuis sudah diulang. Semangat!');
  });

  document.querySelector('#print-certificate').addEventListener('click', () => window.print());
  document.querySelector('#restart-book').addEventListener('click', () => goToPage(1));

  for (let index = 0; index <= totalSheets; index += 1) {
    const dot = document.createElement('i');
    dotsWrap.appendChild(dot);
  }

  const storedPage = Number(safeStorage.get('komposisi:last-page', '1'));
  mobilePage = Number.isFinite(storedPage) ? Math.max(1, Math.min(totalPages, storedPage)) : 1;
  sheetPosition = mobilePage === totalPages ? totalSheets : Math.floor(mobilePage / 2);
  initializePaperStack();
  syncMode();
  updateScore();

  if (mobilePage > 1) showCue(`Melanjutkan dari ${labelForPage(mobilePage)}`);
  mobileQuery.addEventListener?.('change', syncMode);
  window.addEventListener('beforeunload', stopReading);
})();
