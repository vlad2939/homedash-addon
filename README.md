# HomeDash – Addon pentru Home Assistant

> **Tracker vizual pentru cheltuielile lunare ale casei** – curent, gaze, apă, internet, gunoi, telefon, impozit. Integrat direct în sidebar-ul Home Assistant.

---

## Cuprins

1. [Descriere aplicație](#1-descriere-aplicație)
2. [Cerințe preliminare](#2-cerințe-preliminare)
3. [Instalare prin GitHub Repository](#3-instalare-prin-github-repository)
4. [Accesare din sidebar](#4-accesare-din-sidebar)
5. [Configurare addon](#5-configurare-addon)
6. [Funcționalitățile aplicației HomeDash](#6-funcționalitățile-aplicației-homedash)
7. [Import date CSV](#7-import-date-csv)
8. [Backup și Restore](#8-backup-și-restore)
9. [Depanare (Troubleshooting)](#9-depanare-troubleshooting)
10. [Actualizare addon](#10-actualizare-addon)
11. [Securitate](#11-securitate)
12. [Întrebări frecvente (FAQ)](#12-întrebări-frecvente-faq)

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

- **Home Assistant OS** versiunea **2024.1.0 sau mai nouă** (testat pe v17.2+)
- Cont gratuit pe **[github.com](https://github.com)**
- Conexiune la internet activă (pentru descărcarea imaginii Docker la prima instalare)
- Minim **50 MB** spațiu liber pe dispozitiv

---

## 3. Instalare prin GitHub Repository

Aceasta este **singura metodă funcțională** pentru Home Assistant OS modern (2024+). HA nu mai acceptă addons locale din filesystem — toate addon-urile custom trebuie distribuite printr-un repository GitHub public.

> ⚠️ **Notă importantă despre `config.yaml`:** Fișierul NU trebuie să conțină câmpul `image: ""`. O valoare goală pentru `image` îi spune lui HA că addonul folosește o imagine Docker pre-built de pe un registry extern, ceea ce face addonul invizibil în store. Câmpul trebuie absent complet pentru ca HA să buildeze local din `Dockerfile`.

### Pasul 1 — Fork sau upload pe GitHub

Ai două opțiuni:

**Opțiunea A — Fork direct** (dacă repository-ul original este public):
1. Mergi la repository-ul sursă pe GitHub
2. Click **Fork** → **Create fork**
3. Ai acum propriul tău repository cu toate fișierele gata

**Opțiunea B — Repository nou** (upload manual):
1. Creează cont pe [github.com](https://github.com) dacă nu ai
2. Click **+** → **New repository**
3. Nume: `homedash-addon`, vizibilitate: **Public**
4. Click **Create repository**
5. Încarcă fișierele (drag & drop sau GitHub Desktop) cu structura de mai jos

### Structura obligatorie în repository:

```
repository.yaml          ← în root-ul repository-ului
homedash/
    config.yaml          ← FĂRĂ linia "image: """
    Dockerfile
    nginx.conf
    run.sh
    build.yaml
    webapp/
        index.html
        script.js
        styles.css
        assets/
            ...
```

### Conținut `repository.yaml` (în root):

```yaml
name: "HomeDash"
url: "https://github.com/USERUL_TAU/homedash-addon"
maintainer: "USERUL_TAU"
```

> Înlocuiește `USERUL_TAU` cu username-ul tău real de GitHub.

### Conținut `homedash/config.yaml`:

```yaml
name: "HomeDash – Costuri Casă"
description: "Aplicație web pentru analiza și vizualizarea cheltuielilor lunare ale casei."
version: "4.5"
slug: "homedash"
init: false
arch:
  - aarch64
  - amd64
  - armhf
  - armv7
  - i386
startup: application
boot: auto
map: []
ports:
  8099/tcp: 8099
ports_description:
  8099/tcp: "HomeDash Web UI"
ingress: true
ingress_port: 8099
ingress_stream: false
panel_icon: "mdi:home-analytics"
panel_title: "HomeDash"
panel_admin: false
homeassistant: "2024.1.0"
options: {}
schema: {}
```

**Linia `image: ""` trebuie să lipsească complet** — aceasta era cauza pentru care addonul nu apărea în store.

### Pasul 2 — Adaugă repository-ul în Home Assistant

1. HA UI → **Setări** → **Add-ons** → **Add-on Store**
2. Click **⋮** (trei puncte, dreapta sus) → **Repositories**
3. În câmpul de text introdu URL-ul repository-ului tău:
   ```
   https://github.com/USERUL_TAU/homedash-addon
   ```
4. Click **Add**
5. Repository-ul apare în listă cu numele „HomeDash" și maintainer-ul tău

### Pasul 3 — Instalează addonul

1. Închide fereastra Repositories (click în afara ei sau pe X)
2. În **Add-on Store**, derulează în jos — apare secțiunea **„HomeDash"**
3. Click pe **„HomeDash – Costuri Casă"**
4. Click **„Install"**
5. Așteaptă finalizarea build-ului Docker (1–5 minute la prima instalare, depinde de dispozitiv)

### Pasul 4 — Pornește addonul

1. În pagina addon-ului, tab **„Info"**
2. Activează **„Start on boot"**
3. Activează **„Watchdog"**
4. Click **„Start"**
5. Verifică tab-ul **„Log"** — trebuie să apară:
   ```
   HomeDash – Costuri Casă  v4.5
   Pornire server nginx pe portul 8099...
   ```

---

## 4. Accesare din sidebar

### Activare automată prin Ingress

Addonul folosește **HA Ingress** — sistemul nativ de integrare UI al Home Assistant. Aplicația se deschide direct în interfața HA, fără tab nou, reutilizând autentificarea HA.

### Cum apare în sidebar:

1. După pornirea addon-ului, mergi la tab-ul **„Info"**
2. Activează **„Show in sidebar"**
3. În sidebar-ul stâng al HA apare iconița **📊 HomeDash**
4. Click pe ea — aplicația se deschide în panoul principal

### Accesare directă prin browser:

```
http://<IP-HA>:8099
```

---

## 5. Configurare addon

Addonul **nu necesită configurare** suplimentară — funcționează imediat după instalare. Toate setările aplicației se fac din interiorul HomeDash.

### Parametri `config.yaml` — referință:

| Parametru | Valoare | Descriere |
|-----------|---------|-----------|
| `slug` | `homedash` | Identificator unic (= numele folderului din repository) |
| `ingress` | `true` | Integrare nativă în UI-ul HA |
| `ingress_port` | `8099` | Portul intern al serverului nginx |
| `panel_icon` | `mdi:home-analytics` | Iconița din sidebar |
| `panel_title` | `HomeDash` | Eticheta din sidebar |
| `boot` | `auto` | Pornire automată odată cu HA |

### Modificare iconița din sidebar:

Editează `panel_icon` în `config.yaml` cu orice icon din [Material Design Icons](https://pictogrammers.com/library/mdi/):
```yaml
panel_icon: "mdi:currency-eur"
panel_icon: "mdi:chart-line"
panel_icon: "mdi:home-city"
```

După orice modificare în `config.yaml`, este necesară reinstalarea addonului din HA.

---

## 6. Funcționalitățile aplicației HomeDash

### 6.1 Dashboard

- **Carduri KPI configurabile** – total lunar, medie pe categorie, comparație față de luna precedentă / același an trecut
- **Grafic sumă totală lunară** – evoluție vizuală pe luni
- **Selector an** – filtrare rapidă pentru oricare an din date
- **Dark mode** – comutare temă întunecată/luminoasă

### 6.2 Analiză

- **Filtru multi-an** – selectare simultană mai mulți ani pentru comparație
- **Filtru categorii** – afișare selectivă pe tipuri (curent, gaze, apă etc.)
- **Filtru luni** – zoom pe interval de luni specific
- **Grafice suprapuse** – comparație vizuală an vs an

### 6.3 Date

- **Vizualizare tabel complet** – toate înregistrările sortate cronologic
- **Adăugare manuală** – formular pentru introducere lună cu lună
- **Import CSV** – încărcare fișier CSV cu date istorice
- **Ștergere înregistrări** – individual sau în bloc

### 6.4 Setări

- **Configurare carduri Dashboard** – activare/dezactivare și reordonare carduri KPI
- **Calcul impozit** – configurare procente și parametri
- **Backup date** – export complet JSON cu date + setări
- **Restore date** – import backup JSON
- **Resetare date** – revenire la datele demo

---

## 7. Import date CSV

### Format CSV acceptat:

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

- Separatorul zecimal poate fi `.` sau `,`
- Separatorul CSV poate fi `,` sau `;`
- Ordinea coloanelor **contează**

---

## 8. Backup și Restore

### De ce e important backup-ul:

Datele sunt în `localStorage` al browser-ului — se pierd dacă ștergi cookie-urile, nu se sincronizează între dispozitive și nu sunt incluse în backup-ul Home Assistant.

### Creare backup:

**HomeDash** → **Setări** → **„Backup date"** → se descarcă `homedash-backup-YYYY-MM-DD.json`

### Restore backup:

**HomeDash** → **Setări** → **„Restore date"** → selectează fișierul `.json`

---

## 9. Depanare (Troubleshooting)

### Addonul nu apare în Add-on Store după adăugarea repository-ului

1. Verifică că `repository.yaml` din root-ul repository-ului GitHub conține URL-ul **real și corect**:
   ```yaml
   url: "https://github.com/USERUL_TAU/homedash-addon"
   ```
2. Verifică că `homedash/config.yaml` **nu conține** linia `image: ""` — aceasta face addonul invizibil
3. Verifică că repository-ul GitHub este **Public** (nu Private)
4. Șterge repository-ul din HA și adaugă-l din nou
5. Dă reboot la HA: **Setări** → **Sistem** → **Repornire**

### Build eșuat la instalare

Verifică log-ul: Add-ons → HomeDash → tab **„Log"**

Cauze frecvente:
- Lipsă conexiune internet la primul build
- Spațiu insuficient pe disc: `df -h /` în terminal
- Arhitectură nesuportată: `uname -m` în terminal

### Addonul pornit dar pagina nu se încarcă

```bash
# Verifică că nginx rulează pe portul corect
ha apps logs homedash
```

### Iconița nu apare în sidebar

1. Addon rulează (status „Running" verde)
2. Add-on → Info → activează **„Show in sidebar"**
3. Reîncarcă pagina HA (Ctrl+F5)

---

## 10. Actualizare addon

### Actualizare versiune nouă:

1. Modifică fișierele în repository-ul GitHub (webapp sau config)
2. Incrementează `version` în `config.yaml` (ex: `4.5` → `4.6`)
3. În HA: Add-ons → HomeDash → **„Update"** (sau Rebuild)

> Datele din `localStorage` nu sunt afectate de actualizări sau reinstalare.

---

## 11. Securitate

- Addonul servește exclusiv fișiere statice prin nginx
- Nu accesează API-ul Home Assistant
- Nu citește entități, istorice sau configurații HA
- Nu face conexiuni externe
- Accesul prin Ingress necesită autentificarea în HA
- Nu expune portul 8099 pe internet fără un reverse proxy cu HTTPS

---

## 12. Întrebări frecvente (FAQ)

**Î: De ce addonul nu apărea în store deși repository-ul era adăugat?**
R: Câmpul `image: ""` din `config.yaml` îi spunea lui HA că addonul folosește o imagine Docker pre-built externă (care nu exista). Eliminarea completă a acestei linii rezolvă problema — HA buildează local din `Dockerfile`.

**Î: Funcționează și pe Raspberry Pi?**
R: Da, suportă arhitecturile `aarch64` și `armv7` (RPi 3/4/5).

**Î: Pot accesa HomeDash de pe telefon?**
R: Da. Dacă HA este accesibil de pe telefon (local sau prin Nabu Casa), HomeDash apare în sidebar și funcționează în browser mobil.

**Î: Datele mele sunt trimise undeva?**
R: Nu. Toate datele rămân în `localStorage` al browser-ului. Nici addonul, nici aplicația nu fac cereri externe.

**Î: Pot schimba titlul din sidebar?**
R: Da, editează `panel_title` în `config.yaml` pe GitHub și reinstalează addonul.

**Î: Addonul consumă mult procesor / RAM?**
R: Nginx cu fișiere statice consumă neglijabil (< 5MB RAM, 0% CPU în idle).

**Î: De ce nu pot folosi calea locală `/addons` în loc de GitHub?**
R: Home Assistant OS 2024+ nu mai acceptă repository-uri locale din filesystem — acceptă exclusiv URL-uri GitHub (sau alte URL-uri HTTP/HTTPS publice). Singura metodă funcțională pentru addons custom este un repository GitHub public.

---

*HomeDash v4.5 – concept și realizare vlad39*
*Addon HA creat pentru Home Assistant OS v17.2+*
