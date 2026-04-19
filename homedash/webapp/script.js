'use strict';
/* ═══════════════════════════════════════════════════════════════════
   HOMEDASH – SCRIPT PRINCIPAL (modularizat)
   ═══════════════════════════════════════════════════════════════════
   Acest fișier conține logica originală extrasă din index_v35.html.
   Obiectivul modularizării:
     • separare clară structură (index.html) / stil (styles.css) / logică (script.js)
     • mentenanță mai simplă pe termen lung, fără schimbarea comportamentului
     • păstrarea tuturor comentariilor explicative existente
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   1. DATE IMPLICITE (CSV externalizat)
   ═══════════════════════════════════════════════════════════════════
   Datele implicite sunt încărcate din `assets/default-data.js` și folosite
   la prima deschidere a aplicației (când localStorage este gol).
   Structura CSV:
     - Delimiter: punct și virgulă (;)
     - Codare: UTF-8
     - Prima linie: header cu numele câmpurilor
     - Valorile numerice folosesc virgulă ca separator zecimal (format RO)
     - Valorile lipsă sunt reprezentate prin câmpuri goale (,,)
   ═══════════════════════════════════════════════════════════════════ */
const DEFAULT_CSV = window.HOMEDASH_DEFAULT_CSV || '';
if (!DEFAULT_CSV) {
  console.warn('Datele implicite nu au fost găsite: verifică încărcarea fișierului assets/default-data.js');
}


/* ═══════════════════════════════════════════════════════════════════
   2. STAREA GLOBALĂ A APLICAȚIEI
   ═══════════════════════════════════════════════════════════════════
   Un singur obiect central `State` conține toată starea aplicației.
   Evitând variabile globale individuale, avem o sursă unică de adevăr
   și mai multă claritate despre ce date există în aplicație.

   Tipuri de date:
     rawData    – Array de obiecte UtilityData (câte unul per lună)
     cards      – Array de DashboardCard (configurația fiecărui card)
     settings   – Configurări globale (ex: modul de calcul impozit)
     currentPage– Pagina curentă afișată ('dashboard'|'analysis'|...)
     dashboardYear – Anul selectat în filtrul din dashboard
     analysis   – Starea filtrelor din pagina de Analiză
     dataPage   – Starea UI din pagina de Date (form + confirmări)
     editingCard– Cardul în editare curentă (sau null)
   ═══════════════════════════════════════════════════════════════════ */
const State = {
  rawData:       [],          // Datele brute importate din CSV sau localStorage
  cards:         [],          // Configurația cardurilor dashboard

  settings: {
    taxCalculation: 'cash'    // 'cash' = integral în luna plății | 'distributed' = împărțit la 12
  },

  currentPage:   'dashboard', // Pagina curent vizibilă
  dashboardYear: null,         // Anul selectat în filtrul dashboard (null = autodetect max)

  // Stare filtre pagina Analiză
  analysis: {
    yearStart: 'all',          // Filtru an de start ('all' sau număr)
    yearEnd:   'all',          // Filtru an de final ('all' sau număr)
    month:     'all',          // Filtru lună ('all' sau 1-12)
    metric1:   'CURENT_Cost',  // Prima metrică afișată (obligatorie)
    metric2:   '',             // A doua metrică opțională (serie secundară)
    chartType: 'bar'           // Tipul graficului de analiză: 'bar' sau 'line'
  },

  // Stare UI pagina Date
  dataPage: {
    importSuccess:   false,    // Arată mesajul de succes după import CSV
    showClearConfirm: false,   // Arată confirmarea de ștergere toate datele

    // Valorile pre-completate în formularul "Adaugă Înregistrare"
    // Implicite: anul și luna curentă, toate costurile = 0
    newRow: {
      AN:               new Date().getFullYear(),
      LUNA:             new Date().getMonth() + 1,
      IMPOZIT:          0,
      GAZE_Parter_Cost: 0, GAZE_Parter_KWh: 0,
      GAZE_Etaj_Cost:   0, GAZE_Etaj_KWh:   0,
      CURENT_Cost:      0, CURENT_KWh:       0,
      APA_Cost:         0, APA_m3:           0,
      Internet:         0, GUNOI:            0, Telefon: 0
    }
  },

  editingCard: null  // Cardul aflat în editare (copie deep) sau null
};

/*
  Registru instanțe Chart.js active.
  Cheia = id-ul canvas-ului (ex: 'chart-1', 'analysis-chart').
  Folosit pentru a distruge graficele înainte de navigare sau re-render,
  prevenind memory leaks și eroarea "Canvas is already in use".
*/
const ChartRegistry = {};

/**
 * Returnează containerul principal unde se randează paginile aplicației.
 * Helper-ul elimină apelurile repetitive document.getElementById('main-content').
 *
 * @returns {HTMLElement|null}
 */
function getMainContentEl() {
  return document.getElementById('main-content');
}


/* ═══════════════════════════════════════════════════════════════════
   3. SERVICIU DATE – parsare, procesare și persistență
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Parsează o valoare în număr float, gestionând formatul românesc
 * (separator mii: punct, separator zecimal: virgulă).
 * Exemple:
 *   parseNumber("1.234,56") → 1234.56
 *   parseNumber("123,45")   → 123.45
 *   parseNumber("")          → 0
 *   parseNumber(42)          → 42
 *
 * @param {*} val – Valoarea de parsat (string, number, null, undefined)
 * @returns {number} – Numărul parsat sau 0 dacă invalida/lipsă
 */
function parseNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (str === '') return 0;
  // Eliminăm separatorul de mii (.) și înlocuim virgula cu punct (.)
  return parseFloat(str.replace(/\./g, '').replace(',', '.')) || 0;
}

/**
 * Formatează un număr în format românesc (virgulă zecimală, punct la mii).
 * Exemple:
 *   formatNum(1234.56)    → "1.234,56"
 *   formatNum(0.5, 0)     → "1"  (0 zecimale)
 *   formatNum(null)        → "0,00"
 *
 * @param {number} n         – Numărul de formatat
 * @param {number} decimals  – Numărul de zecimale (implicit 2)
 * @returns {string}
 */
function formatNum(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  return n.toLocaleString('ro-RO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Importă date dintr-un string CSV folosind PapaParse.
 *
 * Procesul:
 *   1. PapaParse parsează CSV-ul cu header + delimiter ';'
 *   2. Fiecare rând este mapat la un obiect UtilityData tipizat
 *   3. Rândurile cu AN invalid (0) sunt filtrate
 *   4. Datele sunt salvate în State.rawData și persistate
 *
 * @param {string} csvString – Conținutul fișierului CSV ca text
 */
function importCsv(csvString) {
  const result = Papa.parse(csvString, {
    header:         true,    // Prima linie = header cu numele câmpurilor
    delimiter:      ';',     // Separator câmpuri
    skipEmptyLines: true     // Ignoră liniile goale
  });

  const parsed = result.data
    .map(row => ({
      AN:               parseInt(row.AN)   || 0,
      LUNA:             parseInt(row.LUNA) || 0,
      IMPOZIT:          parseNumber(row.IMPOZIT),
      GAZE_Parter_Cost: parseNumber(row.GAZE_Parter_Cost),
      GAZE_Parter_KWh:  parseNumber(row.GAZE_Parter_KWh),
      GAZE_Etaj_Cost:   parseNumber(row.GAZE_Etaj_Cost),
      GAZE_Etaj_KWh:    parseNumber(row.GAZE_Etaj_KWh),
      CURENT_Cost:      parseNumber(row.CURENT_Cost),
      CURENT_KWh:       parseNumber(row.CURENT_KWh),
      APA_Cost:         parseNumber(row.APA_Cost),
      APA_m3:           parseNumber(row.APA_m3),
      Internet:         parseNumber(row.Internet),
      GUNOI:            parseNumber(row.GUNOI),
      Telefon:          parseNumber(row.Telefon)
    }))
    .filter(d => d.AN > 0); // Eliminăm rândurile fără an valid

  State.rawData = parsed;
  saveToStorage();
}

/**
 * Calculează datele procesate (derivate) din rawData.
 *
 * Pentru fiecare rând brut, adaugă câmpuri calculate:
 *   • GAZE_Total_Cost   = parter + etaj (cost total gaze)
 *   • GAZE_Total_KWh    = parter + etaj (consum total gaze)
 *   • Total_Cost        = suma tuturor cheltuielilor lunii
 *   • Lei_per_KWh_Gaze  = cost unitar gaze (lei/kWh)
 *   • Lei_per_KWh_Curent= cost unitar curent (lei/kWh)
 *   • Lei_per_m3_Apa    = cost unitar apă (lei/m³)
 *
 * Gestionarea impozitului în funcție de setarea `taxCalculation`:
 *   • 'cash'        – Impozitul apare integral în luna în care a fost plătit
 *   • 'distributed' – Impozitul anual total este împărțit la 12 luni egale
 *
 * @returns {Array<Object>} – Array de obiecte cu câmpuri brute + calculate
 */
function getProcessedData() {
  const rawData = State.rawData;
  const taxCalc = State.settings.taxCalculation;

  // Pre-calculăm suma impozitului pe an (necesar pentru modul 'distributed')
  const yearlyTax = new Map(); // Map<AN, totalImpozit>
  if (taxCalc === 'distributed') {
    for (const row of rawData) {
      if (row.IMPOZIT > 0) {
        yearlyTax.set(row.AN, (yearlyTax.get(row.AN) || 0) + row.IMPOZIT);
      }
    }
  }

  return rawData.map(row => {
    // Calculăm valoarea impozitului pentru această lună
    let impozit = row.IMPOZIT;
    if (taxCalc === 'distributed') {
      // Distribuim impozitul anual uniform pe 12 luni
      impozit = (yearlyTax.get(row.AN) || 0) / 12;
    }

    // Agregate gaze (parter + etaj)
    const gazeTotalCost = row.GAZE_Parter_Cost + row.GAZE_Etaj_Cost;
    const gazeTotalKWh  = row.GAZE_Parter_KWh  + row.GAZE_Etaj_KWh;

    // Total cheltuieli lună (toate categoriile)
    const totalCost = gazeTotalCost + row.CURENT_Cost + row.APA_Cost +
                      row.Internet + row.GUNOI + row.Telefon + impozit;

    return {
      ...row,                    // Toate câmpurile brute
      IMPOZIT:            impozit,        // Impozit procesat (cash sau distribuit)
      GAZE_Total_Cost:    gazeTotalCost,
      GAZE_Total_KWh:     gazeTotalKWh,
      Total_Cost:         totalCost,
      // Costuri unitare (evităm împărțirea la 0)
      Lei_per_KWh_Gaze:   gazeTotalKWh  > 0 ? gazeTotalCost / gazeTotalKWh  : 0,
      Lei_per_KWh_Curent: row.CURENT_KWh > 0 ? row.CURENT_Cost / row.CURENT_KWh : 0,
      Lei_per_m3_Apa:     row.APA_m3    > 0 ? row.APA_Cost  / row.APA_m3    : 0
    };
  });
}

/**
 * Salvează starea aplicației în localStorage.
 * Salvăm separat: date, carduri, setări (permite restaurare parțială).
 * Erorile sunt suprimate cu avertisment în consolă (ex: modul privat, spațiu plin).
 */
function saveToStorage() {
  try {
    localStorage.setItem('utilityData',    JSON.stringify(State.rawData));
    localStorage.setItem('dashboardCards', JSON.stringify(State.cards));
    localStorage.setItem('appSettings',    JSON.stringify(State.settings));
  } catch (e) {
    console.warn('Nu s-a putut salva în localStorage:', e);
  }
}

/**
 * Inițializează cardurile dashboard cu configurația implicită.
 * Apelată la prima rulare (când nu există date în localStorage).
 *
 * Structura unui card:
 *   id         – Identificator unic (string)
 *   order      – Ordinea de afișare în grid (număr mic = primul)
 *   type       – 'kpi' | 'chart' | 'table'
 *   title      – Titlul afișat în header-ul cardului
 *   cols       – Lățimea în grid (3/6/9/12/15 din 15 coloane totale)
 *   rows       – Înălțimea minimă (1/2/3/6 rânduri)
 *   config     – Configurație specifică tipului cardului
 */
function initDefaultCards() {
  State.cards = [
    // ── KPI-uri individuale (rând 1) ──
    {
      id: '1', order: 1, type: 'kpi', title: 'Total Cost Curent', cols: 3, rows: 1,
      config: { metric: 'CURENT_Cost', aggregation: 'sum', color: 'text-blue-600' }
    },
    {
      id: '2', order: 2, type: 'kpi', title: 'Total Cost Gaze', cols: 3, rows: 1,
      config: { metric: 'GAZE_Total_Cost', aggregation: 'sum', color: 'text-orange-600' }
    },
    {
      id: '3', order: 3, type: 'kpi', title: 'Total Cost Apă', cols: 3, rows: 1,
      config: { metric: 'APA_Cost', aggregation: 'sum', color: 'text-cyan-600' }
    },
    {
      id: '4', order: 4, type: 'kpi', title: 'Total Cost Internet', cols: 3, rows: 1,
      config: { metric: 'Internet', aggregation: 'sum', color: 'text-yellow-600' }
    },
    {
      id: '5', order: 5, type: 'kpi', title: 'Total Cost Gunoi', cols: 3, rows: 1,
      config: { metric: 'GUNOI', aggregation: 'sum', color: 'text-slate-600' }
    },
    // ── Grafic principal (lățime completă) ──
    {
      id: '6', order: 6, type: 'chart', title: 'Evoluție Costuri Utilități', cols: 12, rows: 3,
      config: {
        chartType: 'line',
        metrics: ['CURENT_Cost', 'GAZE_Parter_Cost', 'GAZE_Etaj_Cost', 'APA_Cost']
      }
    },
    // ── KPI-uri derivate (rând 3) ──
    {
      id: '7', order: 7, type: 'kpi', title: 'Cost Mediu Lunar', cols: 3, rows: 1,
      config: { metric: 'Total_Cost', aggregation: 'avg', color: 'text-red-600' }
    },
    {
      id: '8', order: 8, type: 'kpi', title: 'Gaze - Lei / KWh', cols: 3, rows: 1,
      config: { metric: 'Lei_per_KWh_Gaze', aggregation: 'avg', color: 'text-slate-600' }
    },
    {
      id: '9', order: 9, type: 'kpi', title: 'Curent - Lei / KWh', cols: 3, rows: 1,
      config: { metric: 'Lei_per_KWh_Curent', aggregation: 'avg', color: 'text-slate-600' }
    },
    {
      id: '10', order: 10, type: 'kpi', title: 'Apa - Lei / KWh', cols: 3, rows: 1,
      config: { metric: 'Lei_per_m3_Apa', aggregation: 'avg', color: 'text-slate-600' }
    },
    {
      id: '11', order: 11, type: 'kpi', title: 'Total Costuri', cols: 6, rows: 1,
      config: { metric: 'Total_Cost', aggregation: 'sum', color: 'text-red-600' }
    }
  ];
  saveToStorage();
}

/**
 * Încarcă starea aplicației din localStorage.
 * Dacă nu există date salvate, folosește valorile implicite:
 *   • rawData  → importă DEFAULT_CSV
 *   • cards    → apelează initDefaultCards()
 *   • settings → valori implicite din State.settings
 */
function loadFromStorage() {
  const storedData     = localStorage.getItem('utilityData');
  const storedCards    = localStorage.getItem('dashboardCards');
  const storedSettings = localStorage.getItem('appSettings');

  // Date: folosim CSV-ul embedded dacă nu există date salvate
  if (storedData) {
    State.rawData = JSON.parse(storedData);
  } else {
    importCsv(DEFAULT_CSV);
  }

  // Carduri: inițializăm cu cele implicite dacă nu există configurație salvată
  if (storedCards) {
    State.cards = JSON.parse(storedCards);
  } else {
    initDefaultCards();
  }

  // Setări: le suprapunem pe cele din State dacă există versiune salvată
  if (storedSettings) {
    State.settings = JSON.parse(storedSettings);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   4. ROUTER – Navigare bazată pe hash URL
   ═══════════════════════════════════════════════════════════════════
   Aplicația este un SPA (Single Page Application) cu navigare hash.
   URL-ul conține pagina curentă: index.html#dashboard, #analysis etc.

   Avantaje hash routing fără server:
     • Funcționează cu fișier HTML deschis local (file://)
     • Nu necesită server web sau configurare
     • Browserul nu face request la schimbarea hash-ului
   ═══════════════════════════════════════════════════════════════════ */

/** Paginile valide ale aplicației (corespund cu hash-urile URL) */
const PAGES = ['dashboard', 'analysis', 'settings', 'data'];

/**
 * Navighează la o pagină și randează conținutul ei.
 *
 * Pași executați la fiecare navigare:
 *   1. Validăm pagina (fallback la 'dashboard' dacă nu există)
 *   2. Distrugem toate graficele Chart.js existente (evităm leaks)
 *   3. Actualizăm clasa nav-active în sidebar
 *   4. Randăm conținutul paginii în #main-content
 *   5. Sincronizăm hash-ul URL fără a adăuga în history
 *
 * @param {string} page – Numele paginii ('dashboard'|'analysis'|'settings'|'data')
 */
function navigate(page) {
  if (!PAGES.includes(page)) page = 'dashboard';
  State.currentPage = page;

  // Distrugem graficele existente înainte de a randa altă pagină
  destroyAllCharts();

  // Actualizăm starea vizuală a navigării în sidebar
  PAGES.forEach(p => {
    const navEl = document.getElementById('nav-' + p);
    if (!navEl) return;
    navEl.classList.toggle('nav-active', p === page);
  });

  // Randăm pagina corespunzătoare în zona principală
  const main = getMainContentEl();
  switch (page) {
    case 'dashboard': renderDashboard(main); break;
    case 'analysis':  renderAnalysis(main);  break;
    case 'settings':  renderSettings(main);  break;
    case 'data':      renderData(main);      break;
  }

  // Sincronizăm URL-ul (replaceState nu adaugă în history)
  if (location.hash !== '#' + page) {
    history.replaceState(null, '', '#' + page);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   5. GESTIUNEA GRAFICELOR CHART.JS
   ═══════════════════════════════════════════════════════════════════
   Chart.js necesită distrugerea explicită a unui grafic înainte de
   a randa altul pe același canvas. Fără destroy(), apare eroarea:
   "Canvas is already in use. Chart with ID X must be destroyed first".

   ChartRegistry ține evidența tuturor graficelor active pentru a
   putea fi distruse rapid la navigare sau re-render.
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Distruge un grafic specific din registru.
 * @param {string} id – ID-ul canvas-ului graficului
 */
function destroyChart(id) {
  if (ChartRegistry[id]) {
    ChartRegistry[id].destroy();
    delete ChartRegistry[id];
  }
}

/**
 * Distruge toate graficele active simultan.
 * Apelat la fiecare navigare pentru a elibera resursele.
 */
function destroyAllCharts() {
  Object.keys(ChartRegistry).forEach(destroyChart);
}

/**
 * Creează un grafic Chart.js nou pe un canvas dat.
 * Dacă există deja un grafic pe acel canvas, îl distruge mai întâi.
 *
 * @param {string} canvasId – ID-ul elementului <canvas>
 * @param {Object} config   – Configurația Chart.js (type, data, options)
 * @returns {Chart|null}    – Instanța Chart.js sau null dacă canvas-ul nu există
 */
function createChart(canvasId, config) {
  destroyChart(canvasId);  // Curățăm graficul anterior dacă există
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const chart = new Chart(canvas, config);
  ChartRegistry[canvasId] = chart;  // Înregistrăm pentru cleanup ulterior
  return chart;
}

/**
 * Paleta de culori folosită pentru seriile graficelor.
 * Ordinea: indigo, portocaliu, cyan, verde, roșu, violet.
 * Se ciclează prin ele cu `CHART_COLORS[i % CHART_COLORS.length]`.
 */
const CHART_COLORS = ['#1664d9', '#ea580c', '#0891b2', '#16a34a', '#dc2626', '#7c3aed'];


/* ═══════════════════════════════════════════════════════════════════
   6. UTILITĂȚI GRID – 15 coloane
   ═══════════════════════════════════════════════════════════════════
   Dashboard-ul folosește un grid cu 15 coloane (grid-cols-15).
   15 = LCM(3,5) → permite atât 3 sloturi de 1/3 cât și 5 de 1/5.

   Cardurile pot ocupa:
     3 col  = 1/5 din lățime  (KPI mic)
     6 col  = 2/5 din lățime  (KPI lat)
     9 col  = 3/5 din lățime
     12 col = 4/5 din lățime
     15 col = toată lățimea   (grafic principal)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Returnează clasa Tailwind pentru lățimea unui card în grid-ul de 15 coloane.
 * @param {number} cols – Numărul de coloane (3/6/9/12/15)
 * @returns {string}    – Clasa CSS Tailwind (ex: 'col-span-3')
 */
function colClass(cols) {
  return {
    3:  'col-span-3',
    6:  'col-span-6',
    9:  'col-span-9',
    12: 'col-span-12',
    /*
      Tailwind nu include implicit clasa `col-span-15`.
      Pentru lățimea 15/15 (5/5) folosim `col-span-full`,
      care ocupă întreaga lățime a gridului curent (toate cele 15 coloane).
    */
    15: 'col-span-full'
  }[cols] || 'col-span-full';  // Fallback la lățime completă
}

/**
 * Returnează clasa Tailwind pentru înălțimea minimă a unui card.
 * @param {number} rows – Numărul de rânduri (1/2/3/6)
 * @returns {string}    – Clasa CSS Tailwind cu min-h
 */
function rowClass(rows) {
  return {
    1: 'min-h-[160px]',
    2: 'min-h-[320px]',
    3: 'min-h-[480px]',
    6: 'min-h-[960px]'
  }[rows] || 'min-h-[160px]';  // Fallback la înălțimea minimă
}

/**
 * Returnează clasa Tailwind pentru înălțime FIXĂ.
 * Folosită pentru cardurile de tip chart, unde vrem ca selecția de rânduri
 * să fie respectată strict (2/3/6), fără extindere automată pe verticală.
 *
 * @param {number} rows – Numărul de rânduri (1/2/3/6)
 * @returns {string}    – Clasa CSS Tailwind cu h
 */
function rowFixedClass(rows) {
  return {
    1: 'h-[160px]',
    2: 'h-[320px]',
    3: 'h-[480px]',
    6: 'h-[960px]'
  }[rows] || 'h-[160px]';  // Fallback la înălțime fixă minimă
}


/* ═══════════════════════════════════════════════════════════════════
   7. CONSTANTE UI – Metrici și culori disponibile
   ═══════════════════════════════════════════════════════════════════
   Aceste constante definesc ce poate fi configurat de utilizator
   în interfață (dropdown-uri din modal și pagina Analiză).
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Toate metricile disponibile pentru selecție în pagina Analiză.
 * Includ atât câmpuri brute din CSV cât și câmpuri calculate (derivate).
 */
const AVAILABLE_METRICS = [
  // ── Câmpuri brute (din CSV) ──
  'GAZE_Parter_Cost', 'GAZE_Parter_KWh',
  'GAZE_Etaj_Cost',   'GAZE_Etaj_KWh',
  'CURENT_Cost',      'CURENT_KWh',
  'APA_Cost',         'APA_m3',
  'Internet', 'GUNOI', 'Telefon', 'IMPOZIT',
  // ── Câmpuri calculate (derivate în getProcessedData) ──
  'GAZE_Total_Cost', 'GAZE_Total_KWh', 'Total_Cost',
  'Lei_per_KWh_Gaze', 'Lei_per_KWh_Curent', 'Lei_per_m3_Apa'
];

/**
 * Metricile disponibile pentru KPI-uri (subsetul relevant pentru carduri).
 * Format: { value: 'cheiaInDate', label: 'Eticheta afișată în UI' }
 */
const KPI_METRICS = [
  { value: 'CURENT_Cost',       label: 'Curent Cost' },
  { value: 'GAZE_Total_Cost',   label: 'Gaze Total Cost' },
  { value: 'APA_Cost',          label: 'Apă Cost' },
  { value: 'Total_Cost',        label: 'Total Cost' },
  { value: 'IMPOZIT',           label: 'Impozit' },
  { value: 'Internet',          label: 'Internet' },
  { value: 'GUNOI',             label: 'Gunoi' },
  { value: 'Lei_per_KWh_Gaze',  label: 'Lei/KWh Gaze' },
  { value: 'Lei_per_KWh_Curent',label: 'Lei/KWh Curent' },
  { value: 'Lei_per_m3_Apa',    label: 'Lei/m³ Apă' }
];

/**
 * Culorile disponibile pentru textul valorii dintr-un KPI.
 * Folosim clase Tailwind text-color pentru a beneficia de dark mode automat.
 */
const KPI_COLORS = [
  { value: 'text-slate-900',   label: 'Negru' },
  { value: 'text-blue-600',    label: 'Albastru' },
  { value: 'text-orange-600',  label: 'Portocaliu' },
  { value: 'text-emerald-600', label: 'Verde' },
  { value: 'text-cyan-600',    label: 'Cyan' },
  { value: 'text-red-600',     label: 'Roșu' },
  { value: 'text-yellow-600',  label: 'Galben' }
];


/* ═══════════════════════════════════════════════════════════════════
   8. PAGINA DASHBOARD
   ═══════════════════════════════════════════════════════════════════
   Dashboard-ul afișează cardurile configurate de utilizator.
   Tipuri de carduri:
     • kpi   – Un singur număr agregat (sumă sau medie)
     • chart – Grafic Chart.js (line/bar)
     • table – Tabel cu date lunare recente

   Logica de agregare KPI:
     • sum  – Suma valorilor pentru anul selectat
     • avg  – Media lunară pentru anul selectat
     • unit – Prețul unitar (cost total / consum total)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Calculează valoarea afișată într-un card KPI.
 * Folosește datele procesate pentru anul selectat în filtrul dashboard.
 *
 * @param {Object} card – Obiectul card cu config.metric și config.aggregation
 * @returns {number}    – Valoarea numerică de afișat
 */
function getKpiValue(card) {
  const data = getProcessedData();
  if (!data.length) return 0;

  // Determinăm anul de referință (filtrul utilizatorului sau cel mai recent an din date)
  let selectedYear = State.dashboardYear;
  if (!selectedYear || !data.some(d => d.AN === selectedYear)) {
    selectedYear = Math.max(...data.map(d => d.AN));
  }

  // Filtrăm datele pentru anul selectat
  const yearData = data.filter(d => d.AN === selectedYear);
  if (!yearData.length) return 0;

  const agg    = card.config.aggregation || 'sum';
  const metric = card.config.metric;

  if (agg === 'sum') {
    // Suma tuturor valorilor lunare ale metricii pentru an
    return yearData.reduce((acc, d) => acc + (d[metric] || 0), 0);
  }

  if (agg === 'avg') {
    // Media lunară a metricii pentru an
    const sum = yearData.reduce((acc, d) => acc + (d[metric] || 0), 0);
    return sum / yearData.length;
  }

  if (agg === 'unit') {
    // Prețul unitar: costTotal / consumTotal pe an
    let totalCost = 0, totalQty = 0;
    if (metric.includes('GAZE')) {
      totalCost = yearData.reduce((acc, d) => acc + (d.GAZE_Total_Cost || 0), 0);
      totalQty  = yearData.reduce((acc, d) => acc + (d.GAZE_Total_KWh  || 0), 0);
    } else if (metric.includes('APA')) {
      totalCost = yearData.reduce((acc, d) => acc + (d.APA_Cost || 0), 0);
      totalQty  = yearData.reduce((acc, d) => acc + (d.APA_m3   || 0), 0);
    } else {
      // Fallback: folosim suma directă dacă metrica nu e gaze sau apă
      return yearData.reduce((acc, d) => acc + (d[metric] || 0), 0);
    }
    return totalQty > 0 ? totalCost / totalQty : 0;
  }

  return 0;
}

/**
 * Randează pagina Dashboard în containerul dat.
 *
 * Procesul de randare:
 *   1. Generăm HTML-ul pentru fiecare card (KPI/chart/table)
 *   2. Inserăm HTML-ul în DOM
 *   3. Folosim requestAnimationFrame pentru a crea graficele DUPĂ
 *      ce DOM-ul este vizibil (necesar pentru dimensionarea canvas-ului)
 *
 * @param {HTMLElement} container – Elementul #main-content
 */
function renderDashboard(container) {
  const cards = [...State.cards].sort((a, b) => a.order - b.order);
  const data  = getProcessedData();

  // Determinăm lista de ani disponibili și anul selectat
  const years = [...new Set(data.map(d => d.AN))].sort((a, b) => b - a);
  if (State.dashboardYear === null || !years.includes(State.dashboardYear)) {
    State.dashboardYear = years.length > 0 ? years[0] : null;
  }
  const selectedYear = State.dashboardYear;

  // Generăm HTML-ul pentru fiecare card
  const cardsHtml = cards.map(card => {
    const colCls = colClass(card.cols);
    /*
      Pentru chart-uri folosim înălțime fixă (nu minimă), astfel încât
      schimbarea din Setări (rows) să reducă efectiv dimensiunea verticală.
      Pentru KPI/Tabel păstrăm comportamentul existent cu min-height.
    */
    const rowCls = card.type === 'chart' ? rowFixedClass(card.rows) : rowClass(card.rows);
    let bodyHtml  = '';

    if (card.type === 'kpi') {
      // ── Card KPI: afișează o singură valoare cu etichetă ──
      const val        = getKpiValue(card);
      const colorClass = card.config.color || 'text-slate-900';
      bodyHtml = `<div class="flex flex-col justify-center text-right h-full px-1">
        <div class="text-3xl font-bold tracking-tight ${colorClass}">${formatNum(val)} lei</div>
        <div class="text-xs text-slate-400 mt-1">
          ${card.config.aggregation === 'avg' ? 'Medie lunară' : 'Total an curent'}
        </div>
      </div>`;

    } else if (card.type === 'chart') {
      // ── Card Chart: canvas rezervat pentru Chart.js ──
      // Canvas-ul este populat ulterior în requestAnimationFrame
      bodyHtml = `<div class="relative w-full h-full min-h-0 overflow-hidden">
        <canvas id="chart-${card.id}" class="w-full h-full"></canvas>
      </div>`;

    } else if (card.type === 'table') {
      // ── Card Tabel: date lunare pentru cel mai recent an ──
      const maxYear  = data.length ? Math.max(...data.map(d => d.AN)) : 0;
      const tableData = data.filter(d => d.AN === maxYear).sort((a, b) => b.LUNA - a.LUNA);
      const metrics   = card.config.metrics || ['CURENT_Cost', 'GAZE_Parter_Cost'];

      const headers = metrics.map(m =>
        `<th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
           ${m.replace(/_Cost$/, '').replace(/_/g, ' ')}
         </th>`
      ).join('');

      const rows = tableData.map(row => {
        const cells = metrics.map(m =>
          `<td class="px-3 py-2 text-sm text-slate-500">${formatNum(row[m] || 0)}</td>`
        ).join('');
        return `<tr class="hover:bg-slate-50">
          <td class="px-3 py-2 text-sm font-medium text-slate-900 whitespace-nowrap">
            ${row.AN}/${row.LUNA}
          </td>${cells}
        </tr>`;
      }).join('');

      bodyHtml = `<div class="overflow-auto h-full">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50 sticky top-0">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">An/Lună</th>
              ${headers}
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-slate-200">${rows}</tbody>
        </table>
      </div>`;
    }

    // Wrapper-ul cardului (comun pentru toate tipurile)
    return `<div class="${colCls} ${rowCls} bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 class="font-semibold text-slate-800 text-sm">${card.title}</h3>
          ${card.subtitle ? `<p class="text-xs text-slate-500">${card.subtitle}</p>` : ''}
        </div>
        <span class="material-icons text-slate-400" style="font-size:20px">more_vert</span>
      </div>
      <div class="p-4 flex-1 flex flex-col overflow-hidden">${bodyHtml}</div>
    </div>`;
  }).join('');

  // Inserăm HTML-ul dashboard-ului
  container.innerHTML = `
    <div class="p-8 max-w-7xl mx-auto">
      <div class="flex justify-between items-center mb-8">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h2>
          <p class="text-slate-500 mt-1">Privire de ansamblu asupra cheltuielilor casei.</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-slate-500">Anul:</span>
          <select id="dashboard-year-filter" onchange="onDashboardYearChange()"
                  class="bg-white border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md text-sm py-2 px-4 shadow-sm">
            ${years.map(y =>
              `<option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!--
        GRID 15 COLOANE:
        Folosim repeat(15, minmax(0,1fr)) în loc de grid-cols-15 (nu există în Tailwind implicit).
        Cardurile folosesc col-span-3/6/9/12/15 pentru a ocupa diferite lățimi.
      -->
      <div class="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-6">${cardsHtml}</div>
    </div>`;

  /*
    Creăm graficele DUPĂ ce DOM-ul este randat și vizibil.
    requestAnimationFrame garantează că canvas-ul are dimensiuni înainte
    de inițializarea Chart.js (altfel graficul ar fi invizibil/gol).
  */
  requestAnimationFrame(() => {
    cards.filter(c => c.type === 'chart').forEach(card => {
      const pData = getProcessedData();

      // Determinăm din nou anul (poate fi diferit față de prima rulare)
      let year = State.dashboardYear;
      if (!year || !pData.some(d => d.AN === year)) {
        year = pData.length ? Math.max(...pData.map(d => d.AN)) : 0;
      }

      // Filtrăm și sortăm datele pentru grafic
      const yearData = pData.filter(d => d.AN === year).sort((a, b) => a.LUNA - b.LUNA);
      const labels   = yearData.map(d => `L${d.LUNA}`);  // Etichete: L1, L2, ..., L12
      const metrics  = card.config.metrics || ['CURENT_Cost'];

      // Creăm câte un dataset pentru fiecare metrică configurată
      const datasets = metrics.map((m, i) => ({
        data:            yearData.map(d => d[m] || 0),
        label:           m.replace(/_Cost$/, '').replace(/_/g, ' '),  // Etichetă lizibilă
        backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '50',  // Opacitate 31%
        borderColor:     CHART_COLORS[i % CHART_COLORS.length],
        borderWidth:     2,
        tension:         0.4,  // Curbare linie (0 = drept, 1 = curb maxim)
        fill:            card.config.chartType === 'line' ? false : undefined,
        pointRadius:     3
      }));

      createChart('chart-' + card.id, {
        type: card.config.chartType || 'bar',
        data: { labels, datasets },
        options: {
          responsive:          true,
          /*
            Pentru cardurile dashboard, înălțimea trebuie să urmeze
            dimensiunea cardului (rows) setată de utilizator.
            Dacă `maintainAspectRatio` este true, Chart.js forțează
            înălțimea după lățime (aspect ratio fix), ceea ce blochează
            micșorarea pe verticală la cardurile late (ex: 15/15).
          */
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display:  true,
              position: 'bottom',
              labels:   { boxWidth: 40, boxHeight: 2, font: { size: 18 } }
            }
          },
          scales: {
            y: { ticks: { font: { size: 18 } } },
            x: { ticks: { font: { size: 18 } } }
          }
        }
      });
    });
  });
}

/**
 * Handler pentru schimbarea filtrului de an din dashboard.
 * Citește valoarea din select și re-randează dashboard-ul.
 */
function onDashboardYearChange() {
  const selectEl = document.getElementById('dashboard-year-filter');
  if (selectEl) {
    State.dashboardYear = parseInt(selectEl.value);
  }
  const main = getMainContentEl();
  if (main && State.currentPage === 'dashboard') {
    renderDashboard(main);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   9. PAGINA ANALIZĂ
   ═══════════════════════════════════════════════════════════════════
   Permite filtrarea datelor după interval de ani, lună și metrici.
   Afișează un grafic bar cu una sau două serii de date.

   Filtre disponibile:
     • De la / Până la an – interval temporal
     • Luna – filtrare pe o anumită lună din an (sau toate)
     • Metrică 1 – seria principală (obligatorie)
     • Metrică 2 – seria secundară (opțională)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Randează pagina Analiză cu filtrele și graficul aferent.
 * @param {HTMLElement} container – Elementul #main-content
 */
function renderAnalysis(container) {
  const pData = getProcessedData();
  const years = [...new Set(pData.map(d => d.AN))].sort((a, b) => b - a);

  // Generăm opțiunile HTML pentru selecturile de filtrare
  const yearOptions = years.map(y =>
    `<option value="${y}" ${State.analysis.yearStart == y ? 'selected' : ''}>${y}</option>`
  ).join('');

  const monthOptions = [1,2,3,4,5,6,7,8,9,10,11,12].map(m =>
    `<option value="${m}" ${State.analysis.month == m ? 'selected' : ''}>Luna ${m}</option>`
  ).join('');

  const metricOptions1 = AVAILABLE_METRICS.map(m =>
    `<option value="${m}" ${State.analysis.metric1 === m ? 'selected' : ''}>${m}</option>`
  ).join('');

  const metricOptions2 = AVAILABLE_METRICS.map(m =>
    `<option value="${m}" ${State.analysis.metric2 === m ? 'selected' : ''}>${m}</option>`
  ).join('');

  container.innerHTML = `
    <div class="p-8 max-w-7xl mx-auto">
      <!--
        Header pagina Analiză: titlu stânga + dropdown „Tip grafic" dreapta.
        Dropdown-ul are același stil ca filtrul de an din Dashboard (bg-white, border slate-300,
        rounded-md, shadow-sm) și controlează tipul graficului din această pagină (bar/line).
      -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-slate-900">Analiză Dinamică</h2>
          <p class="text-slate-500 mt-1">Compară date în funcție de filtrele selectate.</p>
        </div>
        <!-- Dropdown Tip grafic – același stil ca filtrul de an din Dashboard -->
        <div class="flex items-center gap-3">
          <span class="text-sm font-medium text-slate-500">Tip grafic:</span>
          <select id="analysis-chart-type" onchange="onAnalysisChange()"
                  class="bg-white border border-slate-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md text-sm py-2 px-4 shadow-sm">
            <option value="bar"  ${State.analysis.chartType === 'bar'  ? 'selected' : ''}>Bară</option>
            <option value="line" ${State.analysis.chartType === 'line' ? 'selected' : ''}>Linie</option>
          </select>
        </div>
      </div>

      <!-- Bara de filtre -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap gap-4 items-end">
        <div class="flex-1 min-w-[180px]">
          <label class="block text-sm font-medium text-slate-700 mb-1">De la anul</label>
          <select id="year-start-filter" onchange="onAnalysisChange()"
                  class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2">
            <option value="all" ${State.analysis.yearStart === 'all' ? 'selected' : ''}>De la primul an</option>
            ${yearOptions}
          </select>
        </div>
        <div class="flex-1 min-w-[180px]">
          <label class="block text-sm font-medium text-slate-700 mb-1">Până la anul</label>
          <select id="year-end-filter" onchange="onAnalysisChange()"
                  class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2">
            <option value="all" ${State.analysis.yearEnd === 'all' ? 'selected' : ''}>Până la ultimul an</option>
            ${yearOptions}
          </select>
        </div>
        <div class="flex-1 min-w-[180px]">
          <label class="block text-sm font-medium text-slate-700 mb-1">Luna</label>
          <select id="luna-filter" onchange="onAnalysisChange()"
                  class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2">
            <option value="all" ${State.analysis.month === 'all' ? 'selected' : ''}>Toate lunile</option>
            ${monthOptions}
          </select>
        </div>
        <div class="flex-1 min-w-[180px]">
          <label class="block text-sm font-medium text-slate-700 mb-1">Metrică 1</label>
          <select id="m1-filter" onchange="onAnalysisChange()"
                  class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2">
            ${metricOptions1}
          </select>
        </div>
        <div class="flex-1 min-w-[180px]">
          <label class="block text-sm font-medium text-slate-700 mb-1">Metrică 2 (Opțional)</label>
          <select id="m2-filter" onchange="onAnalysisChange()"
                  class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-2">
            <option value="">Niciuna</option>
            ${metricOptions2}
          </select>
        </div>
      </div>

      <!-- Zona graficului de analiză – înălțimea cardului mărită cu 15% față de versiunea inițială (600→690px, 500→575px) -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col" style="min-height:730px">
        <h3 class="font-semibold text-slate-800 mb-4">Rezultat Analiză</h3>
        <!-- Înălțimea zonei canvas mărită cu 15% față de versiunea inițială (500→575px) -->
        <div class="relative flex-1 w-full" style="min-height:620px">
          <canvas id="analysis-chart"></canvas>
          <!-- Mesaj afișat când nu există date pentru filtrele selectate -->
          <div id="analysis-no-data"
               class="hidden absolute inset-0 flex items-center justify-center text-slate-400">
            Nu există date pentru filtrele selectate.
          </div>
        </div>
      </div>
    </div>`;

  // Creăm graficul imediat după randarea DOM-ului
  requestAnimationFrame(() => updateAnalysisChart());
}

/**
 * Handler pentru orice schimbare a filtrelor din pagina Analiză.
 * Citește valorile din toate selecturile și actualizează graficul.
 */
function onAnalysisChange() {
  State.analysis.yearStart = document.getElementById('year-start-filter')?.value    || 'all';
  State.analysis.yearEnd   = document.getElementById('year-end-filter')?.value      || 'all';
  State.analysis.month     = document.getElementById('luna-filter')?.value          || 'all';
  State.analysis.metric1   = document.getElementById('m1-filter')?.value            || 'CURENT_Cost';
  State.analysis.metric2   = document.getElementById('m2-filter')?.value            || '';
  // Citim tipul graficului din dropdown-ul „Tip grafic" (nou adăugat în header-ul paginii)
  State.analysis.chartType = document.getElementById('analysis-chart-type')?.value || 'bar';
  updateAnalysisChart();
}

/**
 * Actualizează graficul de analiză pe baza filtrelor curente.
 * Aplică filtrele secvențial, sortează cronologic și creează graficul.
 */
function updateAnalysisChart() {
  let data = getProcessedData();
  const { yearStart, yearEnd, month, metric1, metric2 } = State.analysis;

  // Aplicăm filtrele (comparăm cu parseInt pentru filtre numerice)
  if (yearStart !== 'all') data = data.filter(d => d.AN >= parseInt(yearStart));
  if (yearEnd   !== 'all') data = data.filter(d => d.AN <= parseInt(yearEnd));
  if (month     !== 'all') data = data.filter(d => d.LUNA.toString() === month);

  // Sortăm cronologic (an ASC, lună ASC) pentru afișare corectă pe axă
  data.sort((a, b) => a.AN !== b.AN ? a.AN - b.AN : a.LUNA - b.LUNA);

  const noDataEl = document.getElementById('analysis-no-data');
  const hasData  = data.length > 0 && metric1;

  // Afișăm/ascundem mesajul "nu există date"
  if (noDataEl) noDataEl.classList.toggle('hidden', hasData);

  // Dacă nu există date, distrugem graficul existent și ieșim
  if (!hasData) { destroyChart('analysis-chart'); return; }

  // Etichetele axei X: format Lună/An (ex: "3/2025")
  const labels = data.map(d => `${d.LUNA}/${d.AN}`);

  // Construim dataset-urile (1 sau 2 serii)
  // Pentru graficul de tip linie, adăugăm fill:false (fără umplere sub curbă), similar cu cardurile din Dashboard
  const isLine = (State.analysis.chartType === 'line');
  const datasets = [];
  if (metric1) {
    datasets.push({
      data:            data.map(d => d[metric1] || 0),
      label:           metric1,
      backgroundColor: CHART_COLORS[0] + '80',  // Opacitate 50%
      borderColor:     CHART_COLORS[0],
      borderWidth:     1,
      fill:            isLine ? false : undefined  // Fără umplere pentru grafic linie
    });
  }
  if (metric2) {
    datasets.push({
      data:            data.map(d => d[metric2] || 0),
      label:           metric2,
      backgroundColor: CHART_COLORS[1] + '80',
      borderColor:     CHART_COLORS[1],
      borderWidth:     1,
      fill:            isLine ? false : undefined  // Fără umplere pentru grafic linie
    });
  }

  createChart('analysis-chart', {
    // Tipul graficului este controlat de dropdown-ul „Tip grafic" din header (State.analysis.chartType)
    type: State.analysis.chartType || 'bar',
    data: { labels, datasets },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' }
      },
      scales: {
        y: { ticks: { font: { size: 14 } } },
        x: { ticks: { font: { size: 14 }, maxRotation: 90 } }
      }
    }
  });
}


/* ═══════════════════════════════════════════════════════════════════
   10. PAGINA SETĂRI
   ═══════════════════════════════════════════════════════════════════
   Conține:
     • Setare mod calcul impozit (cash vs distribuit)
     • Backup/Restore aplicație (export/import JSON)
     • Configurare carduri dashboard (adăugare, editare, ștergere)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Randează pagina Setări.
 * @param {HTMLElement} container – Elementul #main-content
 */
function renderSettings(container) {
  // Generăm lista de carduri configurate (afișate ca rânduri editabile)
  const cardsHtml = State.cards.map(card => `
    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div class="flex items-center gap-3">
        <!-- Numărul de ordine al cardului în dashboard -->
        <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm">
          ${card.order}
        </div>
        <div>
          <div class="font-medium text-slate-800">${card.title}</div>
          <div class="text-xs text-slate-500">Tip: ${card.type} | Dimensiune: ${card.cols}×${card.rows}</div>
        </div>
      </div>
      <div class="flex gap-2">
        <!-- Buton Editare: deschide modalul cu datele cardului curent -->
        <button onclick="openEditCard('${card.id}')"
                class="p-1.5 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors">
          <span class="material-icons" style="font-size:18px">edit</span>
        </button>
        <!-- Buton Ștergere: elimină cardul din State.cards -->
        <button onclick="deleteCard('${card.id}')"
                class="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors">
          <span class="material-icons" style="font-size:18px">delete</span>
        </button>
      </div>
    </div>`).join('');

  container.innerHTML = `
    <div class="p-8 max-w-7xl mx-auto pb-24">
      <div class="mb-8">
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">Setări</h2>
        <p class="text-slate-500 mt-1">Configurează aplicația și dashboard-ul.</p>
      </div>

      <!--
        Layout nou Setări:
          • aceeași lățime generală ca Dashboard (max-w-7xl)
          • împărțire 40/60 pe desktop (2/5 + 3/5)
          • coloana stângă: Calcul Impozit, Backup/Restore, Instrucțiuni
          • coloana dreaptă: Configurare Carduri Dashboard
      -->
      <div class="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        <div class="xl:col-span-2 space-y-6">
          <!-- ── Card Calcul Impozit ── -->
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span class="material-icons text-indigo-600" style="font-size:22px">account_balance</span>
              Calcul Impozit
            </h3>
            <p class="text-sm text-slate-600 mb-4">
              Alege modul în care este calculat și afișat impozitul anual (plătit în martie).
            </p>
            <div class="flex flex-col gap-3">
              <!--
                Radio Cash: impozitul apare integral în luna plătită (de obicei Martie).
                Setare implicită.
              -->
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="taxCalc" value="cash"
                       ${State.settings.taxCalculation === 'cash' ? 'checked' : ''}
                       onchange="onTaxChange(this.value)" class="accent-indigo-600">
                <span class="text-slate-700">Cash (Sumă integrală în Martie)</span>
              </label>
              <!--
                Radio Distribuit: impozitul anual total / 12, afișat uniform în fiecare lună.
                Util pentru comparații mai corecte lună-la-lună.
              -->
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="taxCalc" value="distributed"
                       ${State.settings.taxCalculation === 'distributed' ? 'checked' : ''}
                       onchange="onTaxChange(this.value)" class="accent-indigo-600">
                <span class="text-slate-700">Distribuit (Împărțit la 12 luni)</span>
              </label>
            </div>
          </div>

          <!-- ── Card Backup / Restore ── -->
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span class="material-icons text-indigo-600" style="font-size:22px">backup</span>
              Backup / Restore
            </h3>
            <p class="text-sm text-slate-600 mb-4">
              Salvează sau restaurează întreaga aplicație (date, carduri, setări).
            </p>
            <div class="flex flex-col gap-3">
              <!-- Export JSON: descarcă un fișier .json cu toată starea aplicației -->
              <button onclick="backupApp()"
                      class="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                <span class="material-icons" style="font-size:18px">download</span>
                Export JSON
              </button>
              <!--
                Import JSON: input file ascuns, declanșat de click pe label.
                Permite restaurarea completă din backup.
              -->
              <label class="cursor-pointer px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2">
                <span class="material-icons" style="font-size:18px">upload</span>
                Import JSON
                <input type="file" id="restore-file" accept=".json" class="hidden" onchange="restoreApp(event)">
              </label>
            </div>
          </div>

          <!--
            Card nou "Instrucțiuni":
            Butoanele deschid documentele locale într-un popup intern (overlay),
            pentru a păstra utilizatorul în contextul paginii Setări.
          -->
          <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span class="material-icons text-indigo-600" style="font-size:22px">menu_book</span>
              Instrucțiuni
            </h3>
            <p class="text-sm text-slate-600 mb-4">
              Documentație rapidă pentru utilizare și extinderea aplicației.
            </p>
            <div class="flex flex-col gap-3">
              <button onclick="openInstructionPopup('./assets/doc/readme.html', 'README aplicație')"
                      class="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                <span class="material-icons" style="font-size:18px">description</span>
                README aplicație
              </button>
              <button onclick="openInstructionPopup('./assets/doc/instructiuni.html', 'Ghid instrucțiuni')"
                      class="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2">
                <span class="material-icons" style="font-size:18px">menu_book</span>
                Ghid instrucțiuni
              </button>
            </div>
          </div>
        </div>

        <!-- ── Card Configurare Carduri Dashboard (zona 60%) ── -->
        <div class="xl:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span class="material-icons text-indigo-600" style="font-size:22px">dashboard_customize</span>
            Configurare Carduri Dashboard
          </h3>
          <p class="text-sm text-slate-600 mb-4">
            Adaugă, editează și reordonează cardurile din dashboard.
          </p>
          <div class="space-y-3">${cardsHtml}</div>
          <button onclick="openNewCard()"
                  class="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2">
            <span class="material-icons" style="font-size:18px">add</span>
            Adaugă Card Nou
          </button>
        </div>
      </div>

      <!-- Footer dedicat paginii Setări -->
      <div class="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
        @ concept si realizare vlad39
      </div>
    </div>`;
}

/**
 * Deschide un document local într-un popup intern (overlay).
 * Folosit de cardul "Instrucțiuni" pentru acces rapid la documentație.
 *
 * @param {string} docPath – Calea fișierului local (ex: './assets/doc/readme.html')
 * @param {string} title   – Titlul afișat în header-ul popup-ului
 */
function openInstructionPopup(docPath, title = 'Documentație') {
  const modal = document.getElementById('docs-modal');
  const titleEl = document.getElementById('docs-modal-title');
  const frame = document.getElementById('docs-modal-frame');
  if (!modal || !titleEl || !frame) return;

  titleEl.textContent = title;
  frame.src = docPath;
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

/**
 * Închide popup-ul intern de documentație și curăță sursa iframe-ului.
 * Curățarea src-ului oprește încărcarea documentului și eliberează resurse.
 */
function closeInstructionPopup() {
  const modal = document.getElementById('docs-modal');
  const frame = document.getElementById('docs-modal-frame');
  if (!modal || !frame) return;

  modal.classList.add('hidden');
  frame.src = 'about:blank';
  // Deblocăm scroll-ul doar dacă nu mai este deschis și modalul de carduri.
  if (document.getElementById('card-modal')?.classList.contains('hidden')) {
    document.body.classList.remove('modal-open');
  }
}

/**
 * Handler pentru schimbarea modului de calcul al impozitului.
 * @param {string} value – 'cash' sau 'distributed'
 */
function onTaxChange(value) {
  State.settings.taxCalculation = value;
  saveToStorage();
  // Nu re-randăm pagina: calculele se vor aplica la navigarea pe dashboard/analiză
}

/**
 * Exportă toată starea aplicației ca fișier JSON.
 * Fișierul descărcat conține: rawData, cards, settings.
 * Compatibil cu funcția restoreApp() pentru restaurare.
 */
function backupApp() {
  const backup = {
    rawData:  State.rawData,
    cards:    State.cards,
    settings: State.settings
  };
  // Creăm un Blob în memorie și generăm un link temporar de download
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'homedash-backup.json';
  a.click();
  URL.revokeObjectURL(url);  // Eliberăm memoria după declanșarea descărcării
}

/**
 * Restaurează aplicația dintr-un fișier JSON de backup.
 * Suprascrie rawData, cards și settings din State, salvează în localStorage
 * și re-randează pagina curentă.
 *
 * @param {Event} event – Evenimentul change al input-ului file
 */
function restoreApp(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const backup = JSON.parse(e.target.result);
      // Suprascriem doar cheile existente (validare minimă)
      if (backup.rawData)  State.rawData  = backup.rawData;
      if (backup.cards)    State.cards    = backup.cards;
      if (backup.settings) State.settings = backup.settings;
      saveToStorage();
      alert('Restaurare reușită!');
      // Re-randăm pagina curentă pentru a reflecta noile date
      const main = getMainContentEl();
      if      (State.currentPage === 'settings')  renderSettings(main);
      else if (State.currentPage === 'dashboard') renderDashboard(main);
    } catch (err) {
      alert('Fișier invalid!');
    }
  };
  reader.readAsText(file);
}


/* ═══════════════════════════════════════════════════════════════════
   MODAL EDITARE CARD
   ═══════════════════════════════════════════════════════════════════
   Modalul permite crearea unui card nou sau editarea unuia existent.
   Lucrează pe o copie a cardului (State.editingCard) și salvează
   în State.cards doar la apăsarea butonului "Salvează".
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Deschide modalul pentru crearea unui card nou.
 * Inițializează State.editingCard cu valori implicite și marchează _isNew=true.
 */
function openNewCard() {
  State.editingCard = {
    id:       Date.now().toString(),     // ID unic bazat pe timestamp
    order:    State.cards.length + 1,    // Se adaugă la finalul listei
    type:     'kpi',
    title:    'Card Nou',
    subtitle: '',
    cols:     3,
    rows:     1,
    config: {
      metric:      'CURENT_Cost',
      color:       'text-slate-900',
      aggregation: 'sum',
      chartType:   'bar',
      metrics:     ['CURENT_Cost']
    },
    _isNew: true  // Marker intern: card nou vs. editare existentă
  };
  renderModal();
}

/**
 * Deschide modalul pentru editarea unui card existent.
 * Lucrăm pe o copie deep (JSON parse/stringify) pentru a nu modifica
 * State.cards până la apăsarea butonului "Salvează".
 *
 * @param {string} id – ID-ul cardului de editat
 */
function openEditCard(id) {
  const card = State.cards.find(c => c.id === id);
  if (!card) return;
  State.editingCard = JSON.parse(JSON.stringify(card));  // Copie deep
  renderModal();
}

/**
 * Închide modalul și resetează State.editingCard.
 * Restaurează scroll-ul pe body.
 */
function closeModal() {
  State.editingCard = null;
  document.getElementById('card-modal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

/**
 * Randează conținutul modalului pe baza cardului din State.editingCard.
 * Structura modalului:
 *   • Header: titlu + buton închidere (sticky)
 *   • Body: câmpuri comune (titlu, tip, dimensiune) + secțiune config specifică
 *   • Footer: butoane Anulează / Salvează (sticky)
 */
function renderModal() {
  const card = State.editingCard;
  if (!card) return;

  const configSection = getModalConfigSection(card);

  document.getElementById('modal-inner').innerHTML = `
    <div class="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
      <h3 class="text-lg font-bold text-slate-800">
        ${card._isNew ? 'Card Nou' : 'Editare Card'}
      </h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-slate-600">
        <span class="material-icons">close</span>
      </button>
    </div>

    <div class="p-6 space-y-4">
      <!-- Câmpuri comune tuturor tipurilor de carduri -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Titlu</label>
          <input id="m-title" type="text" value="${card.title}"
                 class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 text-sm p-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Subtitlu</label>
          <input id="m-subtitle" type="text" value="${card.subtitle || ''}"
                 class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 text-sm p-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Tip Card</label>
          <!--
            La schimbarea tipului, onModalTypeChange() re-randează doar
            secțiunea de configurare specifică (fără a re-randa tot modalul).
          -->
          <select id="m-type" onchange="onModalTypeChange()"
                  class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 text-sm p-2">
            <option value="kpi"   ${card.type === 'kpi'   ? 'selected' : ''}>KPI Simplu</option>
            <option value="chart" ${card.type === 'chart' ? 'selected' : ''}>Grafic</option>
            <option value="table" ${card.type === 'table' ? 'selected' : ''}>Tabel</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Ordine (1-99)</label>
          <input id="m-order" type="number" value="${card.order}" min="1" max="99"
                 class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 text-sm p-2">
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Lățime (coloane din 15)</label>
          <select id="m-cols"
                  class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 text-sm p-2">
            <option value="3"  ${card.cols == 3  ? 'selected' : ''}>3 (1/5)</option>
            <option value="6"  ${card.cols == 6  ? 'selected' : ''}>6 (2/5)</option>
            <option value="9"  ${card.cols == 9  ? 'selected' : ''}>9 (3/5)</option>
            <option value="12" ${card.cols == 12 ? 'selected' : ''}>12 (4/5)</option>
            <option value="15" ${card.cols == 15 ? 'selected' : ''}>15 (5/5)</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Înălțime (rânduri)</label>
          <select id="m-rows"
                  class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 text-sm p-2">
            <option value="1" ${card.rows == 1 ? 'selected' : ''}>1 Rând</option>
            <option value="2" ${card.rows == 2 ? 'selected' : ''}>2 Rânduri</option>
            <option value="3" ${card.rows == 3 ? 'selected' : ''}>3 Rânduri</option>
            <option value="6" ${card.rows == 6 ? 'selected' : ''}>6 Rânduri</option>
          </select>
        </div>
      </div>

      <!-- Configurare specifică tipului de card (KPI / Chart / Table) -->
      <div class="border-t border-slate-200 pt-4">
        <h4 class="font-medium text-slate-800 mb-3">Configurare Specifică</h4>
        <div id="modal-config-section">${configSection}</div>
      </div>
    </div>

    <!-- Footer sticky cu butoane de acțiune -->
    <div class="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
      <button onclick="closeModal()"
              class="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">
        Anulează
      </button>
      <button onclick="saveCard()"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
        Salvează Card
      </button>
    </div>`;

  // Afișăm modalul și blocăm scroll-ul body-ului
  document.getElementById('card-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

/**
 * Generează secțiunea HTML de configurare specifică tipului de card.
 * Fiecare tip (kpi/chart/table) are câmpuri diferite de configurare.
 *
 * @param {Object} card – Cardul în editare
 * @returns {string}    – HTML-ul secțiunii de configurare
 */
function getModalConfigSection(card) {
  if (card.type === 'kpi') {
    // KPI: selecție metrică + tip agregare + culoare text
    const metricOpts = KPI_METRICS.map(m =>
      `<option value="${m.value}" ${card.config.metric === m.value ? 'selected' : ''}>${m.label}</option>`
    ).join('');
    const colorOpts = KPI_COLORS.map(c =>
      `<option value="${c.value}" ${card.config.color === c.value ? 'selected' : ''}>${c.label}</option>`
    ).join('');

    return `<div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Metrică</label>
        <select id="m-metric" class="w-full rounded-md border border-slate-300 shadow-sm text-sm p-2">
          ${metricOpts}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Agregare</label>
        <select id="m-aggregation" class="w-full rounded-md border border-slate-300 shadow-sm text-sm p-2">
          <option value="sum"  ${card.config.aggregation === 'sum'  ? 'selected' : ''}>Sumă</option>
          <option value="avg"  ${card.config.aggregation === 'avg'  ? 'selected' : ''}>Medie</option>
          <option value="unit" ${card.config.aggregation === 'unit' ? 'selected' : ''}>Pret unitar</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Culoare Text</label>
        <select id="m-color" class="w-full rounded-md border border-slate-300 shadow-sm text-sm p-2">
          ${colorOpts}
        </select>
      </div>
    </div>`;

  } else if (card.type === 'chart') {
    // Chart: tip grafic (bar/line) + lista de metrici (separator virgulă)
    return `<div class="grid grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Tip Grafic</label>
        <select id="m-charttype" class="w-full rounded-md border border-slate-300 shadow-sm text-sm p-2">
          <option value="bar"  ${card.config.chartType === 'bar'  ? 'selected' : ''}>Bar Chart</option>
          <option value="line" ${card.config.chartType === 'line' ? 'selected' : ''}>Line Chart</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Metrici (separate prin virgulă)</label>
        <input id="m-metrics" type="text" value="${(card.config.metrics || []).join(',')}"
               placeholder="ex: CURENT_Cost,APA_Cost"
               class="w-full rounded-md border border-slate-300 shadow-sm text-sm p-2">
      </div>
    </div>`;

  } else {
    // Table: lista de metrici de afișat în coloanele tabelului
    return `<div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        Metrici afișate (separate prin virgulă)
      </label>
      <input id="m-table-metrics" type="text"
             value="${(card.config.metrics || ['CURENT_Cost', 'APA_Cost']).join(',')}"
             placeholder="ex: CURENT_Cost,APA_Cost"
             class="w-full rounded-md border border-slate-300 shadow-sm text-sm p-2">
    </div>`;
  }
}

/**
 * Handler pentru schimbarea tipului de card în modal.
 * Re-randează doar secțiunea de configurare specifică (nu tot modalul),
 * păstrând valorile câmpurilor comune deja completate de utilizator.
 */
function onModalTypeChange() {
  State.editingCard.type = document.getElementById('m-type').value;
  document.getElementById('modal-config-section').innerHTML =
    getModalConfigSection(State.editingCard);
}

/**
 * Salvează modificările din modal în State.cards și localStorage.
 * Citește valorile din toate câmpurile modalului, actualizează
 * State.editingCard, apoi îl inserează/actualizează în State.cards.
 */
function saveCard() {
  const card = State.editingCard;
  if (!card) return;

  // Citim valorile câmpurilor comune
  card.title    = document.getElementById('m-title')?.value    || card.title;
  card.subtitle = document.getElementById('m-subtitle')?.value || '';
  card.type     = document.getElementById('m-type')?.value     || card.type;
  card.order    = parseInt(document.getElementById('m-order')?.value)  || card.order;
  card.cols     = parseInt(document.getElementById('m-cols')?.value)   || card.cols;
  card.rows     = parseInt(document.getElementById('m-rows')?.value)   || card.rows;

  // Citim câmpurile specifice tipului de card
  if (card.type === 'kpi') {
    card.config.metric      = document.getElementById('m-metric')?.value      || card.config.metric;
    card.config.aggregation = document.getElementById('m-aggregation')?.value || card.config.aggregation;
    card.config.color       = document.getElementById('m-color')?.value       || card.config.color;
  } else if (card.type === 'chart') {
    card.config.chartType = document.getElementById('m-charttype')?.value || card.config.chartType;
    const raw = document.getElementById('m-metrics')?.value || '';
    card.config.metrics   = raw.split(',').map(s => s.trim()).filter(Boolean);
  } else if (card.type === 'table') {
    const raw = document.getElementById('m-table-metrics')?.value || '';
    card.config.metrics = raw.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Inserăm sau actualizăm cardul în State.cards
  const cards = [...State.cards];
  const idx   = cards.findIndex(c => c.id === card.id);
  if (idx >= 0) {
    cards[idx] = card;  // Actualizăm card existent
  } else {
    cards.push(card);   // Adăugăm card nou
  }
  State.cards = cards;
  saveToStorage();

  closeModal();
  renderSettings(getMainContentEl());
}

/**
 * Șterge un card din State.cards după ID.
 * @param {string} id – ID-ul cardului de șters
 */
function deleteCard(id) {
  State.cards = State.cards.filter(c => c.id !== id);
  saveToStorage();
  renderSettings(getMainContentEl());
}


/* ═══════════════════════════════════════════════════════════════════
   11. PAGINA DATE
   ═══════════════════════════════════════════════════════════════════
   Conține:
     • Import CSV (upload fișier)
     • Formular adăugare înregistrare manuală
     • Tabel cu primele 20 de înregistrări
     • Buton ștergere toate datele (cu confirmare)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Randează pagina Date cu tabelul și formularele de import.
 * @param {HTMLElement} container – Elementul #main-content
 */
function renderData(container) {
  const dp      = State.dataPage;
  const nr      = dp.newRow;
  const allData = State.rawData;

  // Generăm rândurile tabelului (maxim 20 pentru performanță)
  const tableRows = allData.slice(0, 20).map(row => `
    <tr class="hover:bg-slate-50">
      <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">${row.AN} / ${row.LUNA}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.CURENT_Cost)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.CURENT_KWh)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.GAZE_Parter_Cost)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.GAZE_Parter_KWh)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.GAZE_Etaj_Cost)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.GAZE_Etaj_KWh)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.APA_Cost)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.APA_m3)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.Internet)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.GUNOI)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">${formatNum(row.IMPOZIT)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
        <!-- Butonul de ștergere identifică rândul prin AN+LUNA (cheie compusă) -->
        <button onclick="deleteDataRow(${row.AN},${row.LUNA})" class="text-red-500 hover:text-red-700">
          <span class="material-icons" style="font-size:18px">delete</span>
        </button>
      </td>
    </tr>`).join('');

  // HTML pentru zona de confirmare ștergere totală
  const clearConfirmHtml = dp.showClearConfirm
    ? `<div class="flex items-center gap-2">
         <span class="text-sm text-red-600 font-medium">Ești sigur?</span>
         <button onclick="clearAllData()"
                 class="px-3 py-1 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700">
           Da
         </button>
         <button onclick="setClearConfirm(false)"
                 class="px-3 py-1 bg-slate-200 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-300">
           Nu
         </button>
       </div>`
    : `<button onclick="setClearConfirm(true)"
               class="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md text-sm font-medium transition-colors flex items-center gap-1">
         <span class="material-icons" style="font-size:16px">delete_sweep</span> Șterge Toate
       </button>`;

  container.innerHTML = `
    <div class="p-8 max-w-7xl mx-auto">
      <div class="mb-8">
        <h2 class="text-2xl font-bold tracking-tight text-slate-900">Date și Import</h2>
        <p class="text-slate-500 mt-1">Gestionează datele aplicației, importă CSV și adaugă înregistrări noi.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

        <!-- ── Card Import CSV ── -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-1">
          <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span class="material-icons text-indigo-600" style="font-size:22px">upload_file</span>
            Importă Date
          </h3>
          <p class="text-sm text-slate-600 mb-4">
            Încarcă un fișier CSV cu datele inițiale. Delimitatorul trebuie să fie
            <strong>punct și virgulă (;)</strong>.
          </p>
          <!--
            Zona de drag & drop simulată:
            Input-ul file este poziționat absolut și transparent peste tot containerul.
            Click-ul pe container declanșează selectorul de fișiere.
          -->
          <div class="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
            <input type="file" accept=".csv,.txt" onchange="onCsvFileSelected(event)"
                   class="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
            <span class="material-icons text-slate-400" style="font-size:40px;display:block;margin-bottom:8px">
              cloud_upload
            </span>
            <div class="text-sm font-medium text-indigo-600">Apasă pentru a încărca</div>
            <div class="text-xs text-slate-500 mt-1">CSV (max. 5MB)</div>
          </div>
          <!-- Mesaj de succes afișat 3 secunde după import reușit -->
          ${dp.importSuccess
            ? `<div class="mt-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
                 <span class="material-icons" style="font-size:18px">check_circle</span>
                 Date importate cu succes!
               </div>`
            : ''}
        </div>

        <!-- ── Card Adăugare Înregistrare Manuală ── -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:col-span-2">
          <h3 class="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span class="material-icons text-indigo-600" style="font-size:22px">add_box</span>
            Adaugă Înregistrare Nouă
          </h3>
          <!--
            Câmpurile formularului sunt generate dinamic dintr-un array de definiții.
            Format: [eticheta, cheiaInDate, tipInput]
            ID-urile input-urilor: "nr-{CHEIE}" (ex: "nr-AN", "nr-CURENT_Cost")
          -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            ${[
              ['An',                'AN',               'number'],
              ['Lună',              'LUNA',             'number'],
              ['Impozit',           'IMPOZIT',          'number'],
              ['Curent Cost (lei)', 'CURENT_Cost',      'number'],
              ['Curent (kWh)',      'CURENT_KWh',       'number'],
              ['Gaze Parter Cost',  'GAZE_Parter_Cost', 'number'],
              ['Gaze Parter (kWh)', 'GAZE_Parter_KWh',  'number'],
              ['Gaze Etaj Cost',    'GAZE_Etaj_Cost',   'number'],
              ['Gaze Etaj (kWh)',   'GAZE_Etaj_KWh',    'number'],
              ['Apă Cost (lei)',    'APA_Cost',         'number'],
              ['Apă (m³)',          'APA_m3',            'number'],
              ['Internet (lei)',    'Internet',         'number'],
              ['Gunoi (lei)',       'GUNOI',            'number'],
              ['Telefon (lei)',     'Telefon',          'number'],
            ].map(([label, field]) => `
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">${label}</label>
                <input id="nr-${field}" type="number" step="0.01" value="${nr[field] || 0}"
                       class="w-full rounded-md border border-slate-300 shadow-sm focus:border-indigo-500 text-sm p-2">
              </div>`).join('')}
          </div>
          <button onclick="addDataRow()"
                  class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
            Salvează Înregistrare
          </button>
        </div>
      </div>

      <!-- ── Tabel Date ── -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 class="font-semibold text-slate-800">Tabel Date (${allData.length} înregistrări)</h3>
          ${clearConfirmHtml}
        </div>
        <div class="data-table-wrap">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">An/Lună</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Curent</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Curent KWh</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gaze P.</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gaze P. KWh</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gaze E.</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gaze E. KWh</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Apă</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Apă m³</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Internet</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Gunoi</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Impozit</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acțiuni</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-slate-200">${tableRows}</tbody>
          </table>
          <!-- Notă de paginare (afișată dacă există mai mult de 20 de înregistrări) -->
          ${allData.length > 20
            ? `<div class="p-3 text-center text-sm text-slate-500 bg-slate-50 border-t border-slate-200">
                 Afișare primele 20 din ${allData.length} înregistrări.
               </div>`
            : ''}
        </div>
      </div>
    </div>`;
}

/**
 * Handler pentru selectarea unui fișier CSV.
 * Citește fișierul ca text UTF-8 și îl importă.
 * Afișează mesajul de succes 3 secunde, apoi îl ascunde.
 *
 * @param {Event} event – Evenimentul change al input-ului file
 */
function onCsvFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    importCsv(e.target.result);
    State.dataPage.importSuccess = true;
    renderData(getMainContentEl());

    // Ascundem mesajul de succes după 3 secunde
    setTimeout(() => {
      State.dataPage.importSuccess = false;
      const el = getMainContentEl();
      if (el && State.currentPage === 'data') renderData(el);
    }, 3000);
  };
  reader.readAsText(file, 'UTF-8');
}

/**
 * Citește valorile din formularul de adăugare și inserează un rând nou în rawData.
 * Validare minimă: AN și LUNA sunt obligatorii (nu pot fi 0).
 * Noul rând este adăugat la începutul array-ului (cel mai recent = primul).
 * Formularul este pre-completat cu luna următoare după salvare.
 */
function addDataRow() {
  const fields = [
    'AN', 'LUNA', 'IMPOZIT',
    'CURENT_Cost', 'CURENT_KWh',
    'GAZE_Parter_Cost', 'GAZE_Parter_KWh',
    'GAZE_Etaj_Cost', 'GAZE_Etaj_KWh',
    'APA_Cost', 'APA_m3',
    'Internet', 'GUNOI', 'Telefon'
  ];

  // Construim obiectul rând din valorile input-urilor
  const row = {};
  for (const f of fields) {
    const el = document.getElementById('nr-' + f);
    row[f] = el ? (parseFloat(el.value) || 0) : 0;
  }

  if (!row.AN || !row.LUNA) {
    alert('An și Lună sunt obligatorii!');
    return;
  }

  // Adăugăm la început (cel mai recent apare primul în tabel)
  State.rawData = [row, ...State.rawData];
  saveToStorage();

  // Pre-completăm formularul cu luna următoare (modulo 12 pentru overflow Decembrie→Ianuarie)
  State.dataPage.newRow = {
    AN:   row.AN,
    LUNA: (row.LUNA % 12) + 1
  };
  renderData(getMainContentEl());
}

/**
 * Șterge un rând din rawData identificat prin an și lună.
 * Folosim filtrare (creează un array nou fără rândul respectiv).
 *
 * @param {number} an   – Anul înregistrării de șters
 * @param {number} luna – Luna înregistrării de șters
 */
function deleteDataRow(an, luna) {
  State.rawData = State.rawData.filter(d => !(d.AN === an && d.LUNA === luna));
  saveToStorage();
  renderData(getMainContentEl());
}

/**
 * Activează sau dezactivează starea de confirmare pentru ștergerea totală.
 * @param {boolean} val – true = afișează confirmarea, false = ascunde
 */
function setClearConfirm(val) {
  State.dataPage.showClearConfirm = val;
  renderData(getMainContentEl());
}

/**
 * Șterge toate datele din rawData după confirmarea utilizatorului.
 * Resetează starea de confirmare și re-randează pagina.
 */
function clearAllData() {
  State.rawData = [];
  saveToStorage();
  State.dataPage.showClearConfirm = false;
  renderData(getMainContentEl());
}


/* ═══════════════════════════════════════════════════════════════════
   13. GESTIUNEA TEMEI (Dark / Light Mode)
   ═══════════════════════════════════════════════════════════════════
   Strategia de implementare:
     • Tema este controlată prin clasa `.dark` pe elementul <html>
     • Preferința este persistată în localStorage ('theme': 'dark'/'light')
     • La încărcarea paginii, verificăm în ordine:
         1. localStorage (preferința explicită a utilizatorului)
         2. prefers-color-scheme (preferința OS/browser)
         3. Fallback: light mode
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Aplică o temă și o persistează în localStorage.
 * Actualizează și iconița butonului de toggle.
 *
 * @param {boolean} isDark – true = dark mode, false = light mode
 */
function setTheme(isDark) {
  if (isDark) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
    document.getElementById('theme-icon').textContent = 'light_mode';  // Iconiță soare
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
    document.getElementById('theme-icon').textContent = 'dark_mode';   // Iconiță lună
  }
}

/**
 * Comută tema curentă (dark ↔ light).
 * Apelată de butonul de toggle din header-ul sidebar-ului.
 */
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  setTheme(!isDark);
}

/**
 * Detectează și aplică tema preferată la încărcarea aplicației.
 * Prioritate: localStorage > prefers-color-scheme > light.
 */
function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && prefersSystemDark)) {
    setTheme(true);
  } else {
    setTheme(false);
  }
}

// Aplicăm tema imediat (înainte de randarea paginilor)
loadTheme();


/* ═══════════════════════════════════════════════════════════════════
   14. INIȚIALIZARE ȘI ROUTING
   ═══════════════════════════════════════════════════════════════════
   Bootstrapping-ul aplicației la încărcarea paginii:
     1. Încărcăm datele din localStorage (sau CSV implicit)
     2. Determinăm pagina inițială din hash-ul URL
     3. Navigăm la pagina inițială
     4. Ascultăm evenimentul hashchange pentru navigare din browser
     5. Configurăm comportamentul modalului (close pe click overlay)
   ═══════════════════════════════════════════════════════════════════ */

// Pasul 1: Încărcare date din localStorage sau fallback la CSV
loadFromStorage();

// Pasul 2 & 3: Determinăm pagina inițială și navigăm
// location.hash = '#dashboard' → page = 'dashboard'
// Fallback la 'dashboard' dacă hash-ul lipsește sau este invalid
const initialPage = (location.hash || '#dashboard')
  .replace('#', '')
  .replace('/', '') || 'dashboard';

navigate(PAGES.includes(initialPage) ? initialPage : 'dashboard');

// Pasul 4: Ascultăm schimbările hash-ului pentru navigare înapoi/înainte în browser
window.addEventListener('hashchange', () => {
  const page = location.hash.replace('#', '').replace('/', '');
  // Navigăm doar dacă pagina e validă și diferită de cea curentă
  if (PAGES.includes(page) && page !== State.currentPage) {
    navigate(page);
  }
});

// Pasul 5a: Click pe overlay (fundalul semi-transparent) → închide modalul
document.getElementById('card-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();  // Doar dacă click e DIRECT pe overlay
});

// Pasul 5b: Click pe conținutul intern al modalului → NU se propagă la overlay
document.getElementById('modal-inner').addEventListener('click', (e) => {
  e.stopPropagation();  // Previne bubble la #card-modal și declanșarea closeModal()
});

// Pasul 6a: Click pe overlay-ul popup-ului de documentație → închide popup-ul
document.getElementById('docs-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeInstructionPopup();
});

// Pasul 6b: Click pe conținutul intern al popup-ului de documentație → nu închide
document.getElementById('docs-modal-inner').addEventListener('click', (e) => {
  e.stopPropagation();
});

// Pasul 6c: Tasta ESC închide popup-ul de documentație și modalul cardurilor
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!document.getElementById('docs-modal').classList.contains('hidden')) {
    closeInstructionPopup();
    return;
  }
  if (!document.getElementById('card-modal').classList.contains('hidden')) {
    closeModal();
  }
});
