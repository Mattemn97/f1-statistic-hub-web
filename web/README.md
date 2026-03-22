# 🏎️ F1 Situation Awareness
F1 Situation Awareness è un'applicazione web interattiva progettata per fornire una panoramica dettagliata e in tempo reale (o storica) dei dati dei weekend di gara di Formula 1. Sfruttando gli endpoint forniti da OpenF1 API, il progetto permette agli utenti di selezionare uno specifico anno e un Gran Premio, visualizzando tabelle e grafici avanzati divisi per sessione.

# ✨ Funzionalità Principali
- **Selezione Dinamica**: L'utente può scegliere l'anno e il Gran Premio desiderato tramite un'interfaccia intuitiva.

- **Gestione delle Sessioni (Tab)**: I dati sono suddivisi in schede (tab) basate sulle varie sessioni del weekend (Classifiche, Prove Libere, ecc.).

- **Gestione Assenze**: Se una sessione (es. Sprint Race) non è prevista per il GP selezionato, la scheda mostrerà chiaramente il messaggio: "Sessione non presente nel GP selezionato".

# 📊 Struttura delle Schede
## Scheda Principale: Classifiche di Campionato
Questa scheda offre una visione d'insieme sullo stato del campionato al momento del GP selezionato, suddivisa in due tabelle principali.

### Campionato Piloti:
- **Righe**: Singolo pilota (identificato da volto ufficiale, nome completo e colori della scuderia).

- **Colonne**: Punteggi ottenuti nelle Sprint Race e nelle Gare (Gara).

- **Totali**: Somma dei punti e percentuale calcolata sui punti totali teoricamente disponibili fino a quel momento.

### Campionato Costruttori:

- **Righe**: Scuderia (identificata da logo ufficiale, nome ufficiale e colori del team).

- **Colonne**: Punteggi ottenuti dal team nelle Sprint Race e nelle Gare.

- **Totali**: Somma dei punti e percentuale sui punti totali disponibili per i costruttori.

## Schede Specifiche
### Prove Libere (1, 2 e 3)
Ogni sessione di prove libere ha una sua scheda dedicata contenente una tabella riassuntiva delle performance:

- **Dati visualizzati**: Icona del pilota, nome del pilota, giro migliore personale, migliori tempi personali per ogni settore (Settore 1, 2, 3) e numero di giri totali percorsi.

- **Evidenziazioni (Viola/Fucsia)**: Il miglior tempo sul giro assoluto della sessione e i migliori tempi assoluti di ogni singolo settore vengono evidenziati in viola, seguendo lo standard grafico televisivo della F1.


# 🛠️ Tecnologie Utilizzate
- **HTML5:** Struttura base della pagina.

- **W3.CSS:** Framework CSS leggero e reattivo per la gestione del layout, delle schede (tab) e dello stile generale senza appesantire il caricamento.

- **JavaScript (Vanilla ES6+):** Logica di base, chiamate API e utility di formattazione.

- **Vue.js:** Utilizzato per il rendering dinamico delle tabelle dati e per la gestione futura di canvas complessi (es. la tracciatura della mappa del circuito).

- **OpenF1 API:** Fonte dati principale per l'estrazione di telemetrie, tempi e informazioni del campionato.

# 📂 Struttura del Progetto
Il progetto è organizzato per mantenere una netta separazione tra markup, stili, logica di rete e componenti visivi di Vue/JS:

``` Plaintext
📁 f1-situation-awareness/
├── 📄 index.html
├── 📁 css/
│   └── 📄 style.css
└── 📁 js/
    ├── 📄 utils.js
    ├── 📄 api.js
    ├── 📄 main.js
    └── 📁 schede/
        ├── 📄 tabella_risultati_gara.js
        ├── 📄 tabella_risultati_qualifica.js
        ├── 📄 tabella_risultati_provelibere.js
        └── 📄 tabella_campionato_costruttori.js
        └── 📄 tabella_campionato_piloti.js
```

# 📜 Standard di Codifica e Linee Guida
Per mantenere il codice pulito, leggibile e facilmente manutenibile, questo progetto adotta le seguenti convenzioni rigorose:

- **Nomenclatura in Italiano**: Tutte le variabili, le funzioni e i commenti devono usare termini italiani esplicativi. Nessun inglesismo (es. usa tempoMiglioreSulGiro invece di bestLapTime, usa recuperaDatiGranPremio invece di fetchGPData).

- **Variabili Parlanti**: I nomi devono descrivere esattamente il contenuto della variabile (es. percentualePuntiOttenuti invece di perc).

- **Documentazione Integrata**: Ogni funzione deve essere preceduta da un blocco di commento (es. JSDoc) che ne spieghi lo scopo, i parametri in ingresso e il valore di ritorno.

- **Formattazione**: Codice indentato in modo coerente e suddiviso in moduli logici.