# 🏎️ F1-TSA: Formula 1 Terminal Situation Awareness

**F1-TSA** è un'interfaccia utente da terminale (TUI) ad alte prestazioni per il monitoraggio telemetrico e l'analisi strategica delle sessioni di Formula 1. Sviluppata in Python con `Textual` e `Plotext`, trasforma il terminale in un muretto box ingegneristico, ottimizzato per la visualizzazione dei dati in tempo reale e l'analisi storica chirurgica.

---

## 🏗️ Architettura del Layout (Grid 3x3)

L'interfaccia utilizza una griglia rigida **3x3** per garantire una posizione fissa a ogni modulo, massimizzando la velocità di lettura del dato durante le sessioni concitate.

| Settore | Modulo | Descrizione e Funzionalità |
| :--- | :--- | :--- |
| **Top-Left** | 🛠️ **Config & Setup** | Menù a tendina per **Modalità** (Live/Storico), **Anno**, **GP**, **Sessione**. Include il tasto `[LOAD DATA]` e la `Label` di stato dell'applicazione. |
| **Top-Center** | 🏁 **Leaderboard A** | Parte sinistra della classifica: Posizione, Numero, Pilota, Team. |
| **Top-Right** | 🏁 **Leaderboard B** | Parte destra della classifica: **Microsettori** (S1, S2, S3), Mescola e Speed Trap ($km/h$). |
| **Mid-Left** | 📈 **Plot: Speed** | Grafico lineare della velocità in $km/h$ (Distanza su X). |
| **Mid-Center** | 📈 **Plot: Throttle** | Grafico dell'acceleratore $0-100\%$ (Distanza su X). |
| **Mid-Right** | 📈 **Plot: Brake** | Grafico della pressione freno (Distanza su X). |
| **Bottom-Left** | 🎛️ **Session Control** | Dati ambiente: Meteo (Aria/Pista), Vento e stato Bandiere. Spazio per feedback comandi rapidi. |
| **Bottom-Center** | 📈 **Plot: Gear** | Grafico a gradini della marcia inserita $1-8$ (Distanza su X). |
| **Bottom-Right** | 📈 **Plot: RPM** | Grafico dei giri motore istantanei (Distanza su X). |

---

## ⌨️ Logica di Controllo "Keyboard-Only"

Il sistema è progettato per essere operato senza mouse in modalità Storico, permettendo una navigazione rapida tra i momenti chiave della sessione:

### Controlli Temporali e Sessione
* **`W` (Play)**: Avvia l'avanzamento automatico (1 giro ogni 10 secondi).
* **`S` (Stop)**: Mette in pausa l'avanzamento automatico.
* **`A` (Indietro)**: 
    * *Gara*: Torna al giro precedente. 
    * *Qualifica*: Torna alla sessione precedente ($Q3 \rightarrow Q2 \rightarrow Q1$).
* **`D` (Avanti)**: 
    * *Gara*: Avanza al giro successivo.
    * *Qualifica*: Avanza alla sessione successiva ($Q1 \rightarrow Q2 \rightarrow Q3$).

### Navigazione Dati
* **`Frecce / Tab`**: Navigazione tra i widget e i selettori di configurazione.
* **`Invio`**: Seleziona il pilota dalla classifica per aggiornare istantaneamente i 5 grafici telemetrici basati sul suo giro corrente (Gara) o sul suo miglior giro della sessione (Qualifica).

---

## 🛡️ Gestione Errori e Resilienza (Smart Try-Catch)

La stabilità è garantita da una gestione degli errori oculata, strutturata su tre livelli per prevenire crash fatali:

1. **Livello Data-Fetch (API)**:
    * `try`: Connessione a OpenF1/FastF1 per il recupero dati.
    * `catch`: Se il server è offline o la sessione non è disponibile, il sistema blocca il caricamento e notifica l'utente tramite la `Label` di stato senza far crashare la UI.

2. **Livello Telemetria (Processing)**:
    * `try`: Estrazione dei campioni per i 5 parametri (Speed, Throttle, Brake, Gear, RPM).
    * `catch`: In caso di dati corrotti o sensori mancanti (es. guasto GPS), il sistema renderizza il grafico vuoto con la dicitura **"DATA N/A"**, mantenendo attivi gli altri moduli.

3. **Livello Sessione (Logic)**:
    * `try`: Calcolo dei tempi ufficiali e dei distacchi per le sessioni Q1, Q2, Q3.
    * `catch`: Gestione dei piloti senza tempo o ritirati, assicurando che la tabella classifica rimanga popolata con placeholder (`--:--.---`) coerenti.

---

## 📊 Specifiche Tecniche Telemetria

Ogni grafico è renderizzato utilizzando la **distanza percorsa sul circuito** come asse $x$, permettendo un confronto spaziale perfetto tra diversi piloti. Tutti i valori telemetrici (Velocità, RPM, etc.) sono visualizzati e processati come numeri **interi** per una lettura immediata e pulita.

---

## 🚀 Requisiti

* Python 3.9 o superiore
* Librerie: `textual`, `fastf1`, `plotext`, `pandas`