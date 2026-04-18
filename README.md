# HomeDash – Addon pentru Home Assistant

> **Tracker vizual pentru cheltuielile lunare ale casei** – curent, gaze, apă, internet, gunoi, telefon, impozit. Integrat direct în sidebar-ul Home Assistant.

---

## Cuprins

1. [Descriere aplicație](#1-descriere-aplicație)  
2. [Cerințe preliminare](#2-cerințe-preliminare)  
3. [Structura fișierelor addon](#3-structura-fișierelor-addon)  
4. [Instalare pas cu pas](#4-instalare-pas-cu-pas)  
5. [Accesare din sidebar](#5-accesare-din-sidebar)  
6. [Configurare addon](#6-configurare-addon)  
7. [Funcționalitățile aplicației HomeDash](#7-funcționalitățile-aplicației-homedash)  
8. [Import date CSV](#8-import-date-csv)  
9. [Backup și Restore](#9-backup-și-restore)  
10. [Depanare (Troubleshooting)](#10-depanare-troubleshooting)  
11. [Actualizare addon](#11-actualizare-addon)  
12. [Securitate](#12-securitate)  
13. [Întrebări frecvente (FAQ)](#13-întrebări-frecvente-faq)  

---

## 1. Descriere aplicație

**HomeDash** este o aplicație web **Single Page Application (SPA)** care rulează local în browser-ul tău, fără conexiune la internet și fără trimiterea datelor pe niciun server extern.

### Ce face aplicația:

| Funcție | Descriere |
|--------|-----------|
| **Dashboard** | Vedere de ansamblu cu KPI-uri configurabile (total lunar, medii, comparații an/an) |
| **Analiză** | Grafice interactive bar/line cu filtre dinamice pe ani, luni și tipuri de cheltuieli |
| **Date** | Import CSV, adăugare/ștergere manuală înregistrări, vizualizare tabel complet |
| **Setări** | Configurare carduri dashboard, calcul impozit, backup/restore date |

### Tehnologii folosite (toate locale, fără CDN extern):

- **HTML5 + JavaScript** – fără framework, fără build step
- **Tailwind CSS** – stiluri utilitare (bundled local)
- **Chart.js v4** – grafice interactive (bundled local)
- **PapaParse v5** – parsare fișiere CSV (bundled local)
- **Material Icons + Font Inter** – iconițe și tipografie (bundled local)

### Persistența datelor:

Datele sunt salvate **exclusiv în `localStorage`** al browser-ului. Nu există bază de date externă. Dacă ștergi datele browser-ului sau folosești un browser diferit, datele nu vor fi disponibile decât dacă faci un **backup** din secțiunea Setări.

---

## 2. Cerințe preliminare

Înainte de instalare, asigură-te că ai:

- **Home Assistant OS** versiunea **2024.1.0 sau mai nouă** (testat pe v17.2+)
- Acces **SSH** sau **Terminal** în Home Assistant (prin addon-ul „Terminal & SSH" sau „Advanced SSH")
- Acces **File Editor** sau **Samba** pentru a transfera fișiere (opțional, dacă nu folosești SSH)
- Conexiune la internet activă **o singură dată** (pentru descărcarea imaginii Docker de bază la prima instalare)
- Minim **50 MB** spațiu liber pe dispozitiv

### Addon-uri HA recomandate pentru instalare:

- `Terminal & SSH` – pentru comenzi în linia de comandă
- `File Editor` sau `Studio Code Server` – pentru editare fișiere direct din HA UI
- `Samba share` – pentru transfer fișiere de pe calculator

---

## 3. Structura fișierelor addon

După ce copiezi fișierele, structura din folderul `addons` al Home Assistant trebuie să arate astfel:

```
/addons/
└── homedash/                      ← folderul principal al addon-ului
    ├── config.yaml                ← configurația addon-ului (nume, port, ingress)
    ├── Dockerfile                 ← instrucțiuni build container Docker
    ├── nginx.conf                 ← configurație server web nginx
    ├── run.sh                     ← script pornire serviciu
    ├── build.yaml                 ← configurație build multi-arhitectură
    └── webapp/                    ← aplicația web HomeDash
        ├── index.html             ← pagina principală SPA
        ├── script.js              ← logica aplicației
        ├── styles.css             ← stiluri globale + dark theme
        └── assets/
            ├── chart.umd.min.js   ← Chart.js bundled
            ├── default-data.js    ← date demonstrative implicite
            ├── papaparse.min.js   ← PapaParse bundled
            ├── tailwind.js        ← Tailwind CSS bundled
            ├── inter.css          ← declarație font Inter
            ├── material-icons.css ← declarație Material Icons
            ├── fonts/             ← fișiere .woff2 pentru fonturi locale
            │   ├── inter-latin-400-normal.woff2
            │   ├── inter-latin-500-normal.woff2
            │   ├── inter-latin-600-normal.woff2
            │   ├── inter-latin-700-normal.woff2
            │   └── MaterialIcons-Regular.woff2
            └── doc/
                ├── readme.html    ← documentație internă aplicație
                └── instructiuni.html
```

> ⚠️ **Important:** Numele folderului (`homedash`) trebuie să coincidă cu câmpul `slug` din `config.yaml`. Nu redenumi folderul fără a actualiza și `config.yaml`.

---

## 4. Instalare pas cu pas

### Metoda 1 – Prin SSH (recomandat)

#### Pasul 1: Activează SSH în Home Assistant

1. Deschide **Home Assistant UI** → **Setări** → **Add-ons**
2. Caută și instalează **„Terminal & SSH"**
3. Pornește addon-ul și activează **„Show in sidebar"**

#### Pasul 2: Copiază fișierele addon-ului

Ai două opțiuni:

**Opțiunea A – Transfer prin Samba:**
1. Instalează și configurează addon-ul **Samba share** în HA
2. Conectează-te de pe calculator la share-ul `\\<IP-HA>\addons`
3. Copiază folderul `homedash` (cu tot conținutul) în acea locație

**Opțiunea B – Transfer prin SCP (linie de comandă):**
```bash
# De pe calculatorul tău (înlocuiește <IP-HA> cu IP-ul real al HA):
scp -r ./homedash root@<IP-HA>:/addons/
```

#### Pasul 3: Verifică structura fișierelor

Conectează-te prin SSH la HA și rulează:
```bash
ls -la /addons/homedash/
```

Ar trebui să vezi: `config.yaml`, `Dockerfile`, `nginx.conf`, `run.sh`, `build.yaml`, `webapp/`

#### Pasul 4: Reîncarcă lista de addon-uri locale

1. Deschide **HA UI** → **Setări** → **Add-ons**
2. Click pe **„Add-on store"** (butonul din colțul din dreapta-sus)
3. Click pe **meniul cu trei puncte** (⋮) din dreapta sus
4. Selectează **„Check for updates"** sau **„Reload"**

Alternativ, din bara de adrese a browser-ului navighează direct la:
```
http://<IP-HA>:8123/hassio/store
```
și apasă **Reload**.

#### Pasul 5: Instalează addon-ul

1. În **Add-on Store**, derulează în jos la secțiunea **„Local add-ons"**
2. Ar trebui să apară **„HomeDash – Costuri Casă"**
3. Click pe el → Click **„Install"**
4. Așteaptă finalizarea build-ului Docker (poate dura 1-3 minute la prima instalare)

#### Pasul 6: Configurează și pornește addon-ul

1. În pagina addon-ului, mergi la tab-ul **„Info"**
2. Activează **„Start on boot"** (pornire automată la repornirea HA)
3. Activează **„Watchdog"** (repornire automată dacă se oprește)
4. Click **„Start"**
5. Verifică **„Log"** – ar trebui să vezi:
   ```
   ═══════════════════════════════════════════
     HomeDash – Costuri Casă  v4.5
   ═══════════════════════════════════════════
   Pornire server nginx pe portul 8099...
   ```

---

### Metoda 2 – Prin File Editor (UI)

1. Instalează addon-ul **„Studio Code Server"** sau **„File Editor"** în HA
2. Navighează la folderul `/addons/`
3. Creează manual folderul `homedash`
4. Copiază/lipeste conținutul fiecărui fișier (config.yaml, Dockerfile etc.) din arhiva furnizată
5. Continuă cu **Pasul 4** din Metoda 1

---

## 5. Accesare din sidebar

### Activare automată prin Ingress

Addon-ul folosește **HA Ingress** – sistemul nativ de integrare UI al Home Assistant. Asta înseamnă:

- Aplicația se deschide **direct în interfața HA**, fără tab nou
- Autentificarea HA este reutilizată (nu trebuie să te loghezi separat)
- Funcționează prin HTTPS dacă HA este configurat cu SSL

### Cum apare în sidebar:

1. După pornirea addon-ului, mergi la tab-ul **„Info"** al addon-ului
2. Activează **„Show in sidebar"** (dacă nu apare automat)
3. În sidebar-ul stâng al HA va apărea iconița **📊 HomeDash**
4. Click pe ea – aplicația se deschide în panoul principal

### Accesare directă (fără sidebar):

Poți accesa și direct prin browser la:
```
http://<IP-HA>:8123/api/hassio_ingress/<token>/
```
sau prin portul direct (dacă portul 8099 este expus):
```
http://<IP-HA>:8099
```

---

## 6. Configurare addon

Addon-ul **nu necesită configurare** suplimentară – funcționează „out of the box". Toate setările aplicației se fac **din interiorul aplicației HomeDash**, nu din HA.

### Parametri `config.yaml` (referință):

| Parametru | Valoare | Descriere |
|-----------|---------|-----------|
| `name` | `HomeDash – Costuri Casă` | Numele afișat în HA Add-on Store |
| `version` | `4.5` | Versiunea addon-ului |
| `slug` | `homedash` | Identificator unic (= numele folderului) |
| `ingress` | `true` | Integrare nativă în UI-ul HA |
| `ingress_port` | `8099` | Portul intern al serverului nginx |
| `panel_icon` | `mdi:home-analytics` | Iconița din sidebar (Material Design Icons) |
| `panel_title` | `HomeDash` | Eticheta din sidebar |
| `panel_admin` | `false` | Disponibil tuturor utilizatorilor (nu doar admin) |
| `boot` | `auto` | Pornire automată odată cu HA |
| `startup` | `application` | Tip addon (nu serviciu de sistem) |

### Modificare port (dacă 8099 este ocupat):

Editează `config.yaml` și modifică ambele referințe la port:
```yaml
ports:
  8100/tcp: 8100        # ← noul port
ingress_port: 8100      # ← același port nou
```
Apoi editează și `nginx.conf`:
```nginx
listen 8100;            # ← același port nou
```
Reinstalează addon-ul după orice modificare a `config.yaml`.

### Modificare iconița din sidebar:

Editează câmpul `panel_icon` în `config.yaml` cu orice icon din [Material Design Icons](https://pictogrammers.com/library/mdi/):
```yaml
panel_icon: "mdi:currency-eur"    # exemplu: iconița Euro
panel_icon: "mdi:chart-line"      # exemplu: grafic linie
panel_icon: "mdi:home-city"       # exemplu: casă oraș
```

---

## 7. Funcționalitățile aplicației HomeDash

### 7.1 Dashboard

Secțiunea principală cu vedere de ansamblu:

- **Carduri KPI configurabile** – total lunar, medie pe categorie, comparație față de luna precedentă / același an trecut
- **Grafic sumă totală lunară** – evoluție vizuală pe luni (bar sau line chart)
- **Selector an** – filtrare rapidă pentru oricare an din date
- **Dark mode** – comutare temă întunecată/luminoasă (buton în header sidebar)

### 7.2 Analiză

Instrumente avansate de comparație:

- **Filtru multi-an** – selectare simultană mai mulți ani pentru comparație
- **Filtru categorii** – afișare selectivă pe tipuri (curent, gaze, apă etc.)
- **Filtru luni** – zoom pe interval de luni specific
- **Grafice suprapuse** – comparație vizuală an vs an pe aceeași axă

### 7.3 Date

Gestionare înregistrări:

- **Vizualizare tabel complet** – toate înregistrările sortate cronologic
- **Adăugare manuală** – formular pentru introducere lună cu lună
- **Import CSV** – încărcare fișier CSV cu date istorice (detalii în secțiunea 8)
- **Ștergere înregistrări** – individual sau în bloc

### 7.4 Setări

- **Configurare carduri Dashboard** – activare/dezactivare și reordonare carduri KPI
- **Calcul impozit** – configurare procente și parametri pentru estimarea impozitului pe proprietate
- **Backup date** – export complet JSON cu date + setări
- **Restore date** – import backup JSON
- **Resetare date** – ștergere completă și revenire la datele demo
- **Documentație** – pagina readme și instrucțiuni din app

---

## 8. Import date CSV

### Format CSV acceptat:

Fișierul CSV trebuie să aibă **header pe prima linie** și coloanele în această ordine:

```csv
an,luna,curent,gaze,apa,internet,gunoi,telefon,impozit
2024,1,320.50,180.00,45.00,60.00,15.00,25.00,0
2024,2,290.00,210.50,48.00,60.00,15.00,25.00,0
2024,3,260.00,150.00,42.00,60.00,15.00,25.00,1200.00
```

### Reguli format:

| Coloană | Tip | Descriere |
|---------|-----|-----------|
| `an` | întreg (ex: 2024) | Anul înregistrării |
| `luna` | întreg 1-12 | Luna (1 = Ianuarie) |
| `curent` | zecimal | Cheltuială electricitate (RON) |
| `gaze` | zecimal | Cheltuială gaze naturale (RON) |
| `apa` | zecimal | Cheltuială apă + canal (RON) |
| `internet` | zecimal | Cheltuială internet (RON) |
| `gunoi` | zecimal | Cheltuială ridicare gunoi (RON) |
| `telefon` | zecimal | Cheltuială telefonie (RON) |
| `impozit` | zecimal | Impozit plătit (0 dacă nu e luna plății) |

- Separatorul zecimal poate fi `.` (punct) sau `,` (virgulă) – PapaParse le detectează automat
- Separatorul CSV poate fi `,` (virgulă) sau `;` (punct și virgulă)
- Valorile lipsă pot fi `0` sau celulă goală
- Ordinea coloanelor **contează** – nu permuta coloanele

### Pași import:

1. Deschide **HomeDash** → tab **„Date"**
2. Click **„Import CSV"**
3. Selectează fișierul `.csv` de pe dispozitiv
4. Verifică preview-ul afișat
5. Click **„Confirmă import"**
6. Datele sunt adăugate (sau înlocuite, dacă există deja acea lună+an)

---

## 9. Backup și Restore

### De ce e important backup-ul:

Datele sunt stocate în `localStorage` al browser-ului, deci:
- Se pierd dacă ștergi datele de navigare / cookies
- Nu se sincronizează automat între dispozitive
- Nu sunt incluse în backup-ul Home Assistant

### Creare backup:

1. **HomeDash** → **Setări** → **„Backup date"**
2. Se descarcă un fișier `homedash-backup-YYYY-MM-DD.json`
3. Salvează-l într-un loc sigur (Google Drive, NAS, etc.)

### Restore backup:

1. **HomeDash** → **Setări** → **„Restore date"**
2. Selectează fișierul `.json` de backup
3. Confirmă – toate datele și setările sunt restaurate

### Conținutul fișierului de backup:

```json
{
  "version": "4.5",
  "exportDate": "2025-04-18",
  "data": [ ... ],          // toate înregistrările lunare
  "settings": { ... },      // setări aplicație (carduri, impozit)
  "dashboardConfig": { ... } // configurație carduri dashboard
}
```

---

## 10. Depanare (Troubleshooting)

### Problema: Addon-ul nu apare în „Local add-ons"

**Cauze posibile și soluții:**

1. **Structura de foldere greșită** – verifică că `config.yaml` este direct în `/addons/homedash/`, nu într-un subfolder
2. **`config.yaml` invalid** – verifică sintaxa YAML (indentare cu spații, nu tab-uri)
3. **Nu ai dat Reload** – mergi la Add-on Store → ⋮ → Reload
4. **Permisiuni greșite** – rulează: `chmod -R 755 /addons/homedash/`

```bash
# Verificare rapidă structură:
ls -la /addons/homedash/
# Ar trebui să apară: config.yaml, Dockerfile, nginx.conf, run.sh, webapp/
```

### Problema: Build eșuat la instalare

**Verifică log-ul de build:**
1. Add-ons → HomeDash → tab „Log"
2. Caută mesaje de eroare

**Cauze frecvente:**
- Lipsă conexiune internet (necesară la primul build pentru imaginea Docker de bază)
- Spațiu insuficient pe disc: `df -h /` pentru verificare
- Arhitectură nesuportată: verifică că arhitectura ta (amd64, aarch64 etc.) este în `config.yaml`

```bash
# Verifică arhitectura dispozitivului:
uname -m
# Rezultat: x86_64 = amd64, aarch64 = aarch64, armv7l = armv7
```

### Problema: Addon pornit dar pagina nu se încarcă

1. **Verifică portul** – asigură-te că portul 8099 nu este folosit de alt serviciu:
   ```bash
   netstat -tlnp | grep 8099
   ```
2. **Verifică log-ul nginx:**
   - Add-ons → HomeDash → tab „Log"
   - Caută erori de tipul `[error]` sau `[crit]`
3. **Testează direct:**
   ```bash
   curl http://localhost:8099
   # Ar trebui să returneze HTML
   ```

### Problema: Iconița nu apare în sidebar

1. Asigură-te că addon-ul rulează (status „Running" verde)
2. Mergi la add-on → Info → activează **„Show in sidebar"**
3. Reîncarcă pagina HA (Ctrl+F5)
4. Deconectează-te și reconectează-te la HA

### Problema: Datele dispar după repornire

Datele sunt în `localStorage` al browser-ului – sunt normale să persiste între sesiuni **în același browser**. Dacă dispar:
- Verifică dacă browser-ul șterge automat `localStorage` la închidere (setare Firefox/Chrome)
- Dezactivează „Clear cookies and site data when you close all windows" în setările browser-ului
- **Soluție permanentă**: Fă backup regulat din Setări → Backup date

### Problema: Aplicația e lentă / nu răspunde

- Verifică că dispozitivul HA nu este supraîncărcat: `top` sau `htop` prin SSH
- Verifică memoria disponibilă: `free -m`
- Nginx este extrem de lightweight – problema e probabil la browser/rețea, nu la addon

---

## 11. Actualizare addon

### Actualizare manuală (versiune nouă a aplicației):

1. Copiază noile fișiere webapp în `/addons/homedash/webapp/` (suprascrie)
2. Actualizează `version` în `config.yaml` (ex: `4.5` → `4.6`)
3. În HA UI → Add-ons → HomeDash → **„Rebuild"** (sau Uninstall + Install)

```bash
# Prin SSH – exemplu actualizare rapidă:
cp -r /tmp/webapp-nou/* /addons/homedash/webapp/
# Apoi din UI: Rebuild
```

### Actualizare configurație (port, icon etc.):

1. Editează `config.yaml`
2. Din HA UI: **Uninstall** → **Install** (rebuild complet necesar pentru modificări de configurație)

> ⚠️ **Atenție:** Uninstall nu șterge datele din browser (`localStorage`). Datele HomeDash sunt în browser, nu în container.

---

## 12. Securitate

### Ce face addon-ul:

- Servește fișiere statice HTML/JS/CSS prin nginx
- **Nu accesează** API-ul Home Assistant
- **Nu citește** entități, istorice sau configurații HA
- **Nu scrie** nimic pe disc (nici în container, nici în `/config` HA)
- **Nu face** conexiuni externe

### Rețea:

- Addon-ul este izolat în propriul container Docker
- Comunicarea cu browser-ul se face prin HA Ingress (proxy securizat)
- Portul 8099 este expus **doar local** (nu prin internet dacă nu ai configurat DuckDNS/Nabu Casa cu forwarding explicit)

### Autentificare:

- Accesul prin sidebar/Ingress necesită autentificarea în HA
- Dacă accesezi direct pe portul 8099 (fără Ingress), **nu există autentificare** – nu expune acest port pe internet

### Recomandat pentru acces extern:

Dacă vrei să accesezi HomeDash din afara rețelei locale:
- Folosește **Nabu Casa** (Home Assistant Cloud) – cel mai simplu și sigur
- Sau configurează un **reverse proxy** (nginx, Caddy, Traefik) cu HTTPS și autentificare

---

## 13. Întrebări frecvente (FAQ)

**Î: Funcționează și pe Raspberry Pi?**  
R: Da, addon-ul suportă arhitecturile `aarch64` și `armv7` (RPi 3/4/5).

**Î: Pot accesa HomeDash de pe telefon?**  
R: Da. Dacă HA este accesibil de pe telefon (acasă sau prin Nabu Casa), HomeDash apare în sidebar și funcționează în browser mobil.

**Î: Datele mele sunt trimise undeva?**  
R: Nu. Toate datele rămân în `localStorage` al browser-ului tău. Nici addon-ul, nici aplicația nu fac cereri externe.

**Î: Pot folosi mai mulți utilizatori HA cu date separate?**  
R: `localStorage` este per-browser, nu per-utilizator HA. Dacă doi utilizatori accesează din același browser pe același dispozitiv, văd aceleași date. Din browsere diferite / dispozitive diferite – date separate.

**Î: Pot schimba titlul din sidebar de la „HomeDash" la altceva?**  
R: Da, editează `panel_title` în `config.yaml` și reinstalează addon-ul.

**Î: Addon-ul consumă mult procesor / RAM?**  
R: Nginx cu fișiere statice consumă neglijabil (< 5MB RAM, 0% CPU în idle).

**Î: Pot rula mai multe instanțe?**  
R: Nu direct – `slug`-ul trebuie să fie unic. Dar poți duplica folderul, schimba slug, port și panel_title pentru o a doua instanță.

**Î: De ce nu funcționează fonturile / iconițele?**  
R: Verifică că fișierele `.woff2` din `webapp/assets/fonts/` sunt prezente și că `nginx.conf` servește corect tipul MIME `font/woff2`. Verifică log-ul nginx pentru erori 404.

---

## Suport

Acest addon a fost creat pentru uz personal/local. Pentru probleme:

1. Verifică secțiunea [Depanare](#10-depanare-troubleshooting) din acest README
2. Consultă log-ul addon-ului din HA UI → Add-ons → HomeDash → Log
3. Verifică documentația internă a aplicației: HomeDash → Setări → Documentație

---

*HomeDash v4.5 – concept și realizare vlad39*  
*Addon HA creat pentru Home Assistant OS v17.2+*
