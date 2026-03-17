let cached_meetings_for_year = []; 
let cached_session_for_meeting = []; 

// ==========================================
// FUNZIONI DI SUPPORTO (UTILITY)
// ==========================================

function Logger(type, msg, data = "") {
    switch (type) {
        case "info":
            console.info(`🔵 [F1-APP] ${msg}`, data);
            break;
        case "success":
            console.log(`🟢 [F1-APP] ${msg}`, data);
            break;
        case "warn":
            console.warn(`🟠 [F1-APP] ${msg}`, data);
            break;
        case "error":
            console.error(`🔴 [F1-APP] ${msg}`, data);
            break;
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "-";
    
    // Calcolo ore, minuti e secondi
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(3);

    // Formattazione condizionale in base alla durata
    if (h > 0) {
        // Se c'è almeno un'ora (es. 1:35:05.123)
        // PadStart(2, '0') assicura che i minuti sotto il 10 abbiano lo zero davanti (es. 1:05:...)
        return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(6, '0')}`;
    } else if (m > 0) {
        // Se ci sono solo minuti (es. 25:05.123)
        return `${m}:${s.padStart(6, '0')}`;
    } else {
        // Se ci sono solo secondi (es. 05.123)
        return s.padStart(6, '0');
    }
}

function formatGap(gapSeconds, isLapped = false) {
    if (isLapped) return `<span class="w3-text-grey">+${gapSeconds} Lap${gapSeconds > 1 ? 's' : ''}</span>`;
    if (!gapSeconds || isNaN(gapSeconds) || gapSeconds === 0) return "-";
    return `+${gapSeconds.toFixed(3)}`;
}

// Funzione per tradurre la gomma in un pallino colorato
function renderTyres(stintsArray) {
    if (!stintsArray || stintsArray.length === 0) return "-";
    // Ordiniamo per numero stint
    stintsArray.sort((a, b) => a.stint_number - b.stint_number);
    let html = "";
    stintsArray.forEach(s => {
        let color = "#333"; // default unknown
        let letter = "?";
        if (s.compound === "SOFT") { color = "#ff2800"; letter = "S"; }
        else if (s.compound === "MEDIUM") { color = "#f5d033"; letter = "M"; }
        else if (s.compound === "HARD") { color = "#ffffff"; letter = "H"; }
        else if (s.compound === "INTERMEDIATE") { color = "#39b54a"; letter = "I"; }
        else if (s.compound === "WET") { color = "#0aeeef"; letter = "W"; }
        
        html += `<span style="display:inline-block; width:18px; height:18px; border-radius:50%; background-color:${color}; color:${s.compound === 'HARD' ? '#000' : '#fff'}; text-align:center; line-height:18px; font-weight:bold; font-size:10px; margin-right:2px; border: 1px solid #ccc;">${letter}</span>`;
    });
    return html;
}

function getSessionType(sessionKey) {
    const session = cached_session_for_meeting.find(s => s.session_key == sessionKey);
    if (!session) return "UNKNOWN";
    const name = session.session_name.toLowerCase();
    if (name.includes("race") || (name.includes("sprint") && !name.includes("shootout") && !name.includes("qualifying"))) {
        return "RACE";
    }
    return "QUALI";
}

// ==========================================
// INIZIALIZZAZIONE E GESTIONE UI (MENU)
// ==========================================

// 1. DA CHIAMARE ALL'AVVIO (es. window.onload)
function carica_anni() {
    Logger("info","Caricamento anni iniziali...");
    const yearSelect = document.getElementById('year-select');
    const currentYear = new Date().getFullYear();
    
    for (let y = currentYear; y >= 2023; y--) {
        yearSelect.options.add(new Option(y, y));
    }
    Logger("success","Anni caricati con successo.");
}

// 2. DA LEGARE AL MENU ANNI (onchange)
async function carica_granpremi() {
    const year = document.getElementById('year-select').value;
    const gpSelect = document.getElementById('gp-select');
    const sessionSelect = document.getElementById('session-select');
    
    if (!year) {
        Logger("warn","Nessun anno selezionato. Svuoto le tendine.");
        gpSelect.innerHTML = '<option value="">-- Seleziona prima l\'anno --</option>';
        sessionSelect.innerHTML = '<option value="">-- Seleziona prima un GP --</option>';
        return;
    }

    Logger("info",`Richiesto caricamento Gran Premi per l'anno: ${year}`);
    gpSelect.innerHTML = '<option value="">Caricamento GP...</option>';
    sessionSelect.innerHTML = '<option value="">-- Seleziona prima un GP --</option>';

    try {
        const query = `https://api.openf1.org/v1/meetings?year=${year}`;
        Logger("info",`Eseguo fetch: ${query}`);
        
        const res = await fetch(query);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        cached_meetings_for_year = await res.json();
        Logger("success",`Dati meeting scaricati (${cached_meetings_for_year.length} record).`);

        gpSelect.innerHTML = '<option value="">-- Seleziona Gran Premio --</option>';
        const meetingKeysSet = new Set();
        
        cached_meetings_for_year.forEach(meeting => {
            if (!meetingKeysSet.has(meeting.meeting_key)) {
                meetingKeysSet.add(meeting.meeting_key);
                gpSelect.options.add(new Option(meeting.meeting_name, meeting.meeting_key));
            }
        });
        Logger("info","Tendina GP popolata.");
    } catch (error) {
        Logger("error","Errore durante il caricamento dei Gran Premi:", error);
        gpSelect.innerHTML = '<option value="">Errore di caricamento</option>';
    }
}

// 3. DA LEGARE AL MENU GRAN PREMI (onchange)
async function carica_sessioni() {
    const gp = document.getElementById('gp-select').value;
    const sessionSelect = document.getElementById('session-select');
    
    if (!gp) {
        Logger("warn","Nessun GP selezionato. Svuoto la tendina sessioni.");
        sessionSelect.innerHTML = '<option value="">-- Seleziona prima un GP --</option>';
        return;
    }

    Logger("info",`Richiesto caricamento Sessioni per meeting_key: ${gp}`);
    sessionSelect.innerHTML = '<option value="">Caricamento Sessioni... </option>';

    try {
        const query = `https://api.openf1.org/v1/sessions?meeting_key=${gp}`;
        Logger("info",`Eseguo fetch: ${query}`);
        
        const res = await fetch(query);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        cached_session_for_meeting = await res.json();
        Logger("success",`Dati sessioni scaricati (${cached_session_for_meeting.length} record).`);

        sessionSelect.innerHTML = '<option value="">-- Seleziona Sessione --</option>';
        
        cached_session_for_meeting.forEach(session => {
            sessionSelect.options.add(new Option(session.session_name, session.session_key));
        });
        Logger("info","Tendina Sessioni popolata.");
    } catch (error) {
        Logger("error","Errore durante il caricamento delle Sessioni:", error);
        sessionSelect.innerHTML = '<option value="">Errore di caricamento</option>';
    }
}

// ==========================================
// GESTIONE DELLA TABELLA DEI RISULTATI
// ==========================================

// Logica Specifica per Gara/Sprint
function buildRaceTable(drivers, laps, stints) {
    Logger("info","Elaborazione dati modalità GARA...");
    
    // Raggruppiamo i dati per pilota
    let stats = {};
    drivers.forEach(d => {
        stats[d.driver_number] = {
            ...d,
            laps_completed: 0,
            total_time: 0,
            best_lap: Infinity,
            best_lap_num: "-",
            last_lap: null,
            stints: stints.filter(s => s.driver_number === d.driver_number),
            status: "DNF" // Default, aggiornato dopo
        };
    });

    laps.forEach(lap => {
        let st = stats[lap.driver_number];
        if (!st) return;

        st.laps_completed++;
        st.total_time += (lap.lap_duration || 0); // Somma tempo totale
        st.last_lap = lap;

        if (lap.lap_duration && lap.lap_duration < st.best_lap) {
            st.best_lap = lap.lap_duration;
            st.best_lap_num = lap.lap_number;
        }
    });

    // Filtriamo e ordiniamo: 1° Giri completati (desc), 2° Tempo totale (asc)
    let leaderboard = Object.values(stats).filter(d => d.laps_completed > 0);
    leaderboard.sort((a, b) => {
        if (b.laps_completed !== a.laps_completed) return b.laps_completed - a.laps_completed;
        return a.total_time - b.total_time;
    });

    const thead = `<tr>
        <th>POS</th><th>PILOTA</th><th>TEAM</th><th>TEMPO TOTALE</th>
        <th>GAP LEADER</th><th>GAP PREV</th><th>LAST LAP</th><th>L-S1</th><th>L-S2</th><th>L-S3</th>
        <th>BEST LAP</th><th>L#</th><th>PITS</th><th>GOMME</th>
    </tr>`;

    let tbody = "";
    let leaderLaps = leaderboard.length > 0 ? leaderboard[0].laps_completed : 0;
    let leaderTime = leaderboard.length > 0 ? leaderboard[0].total_time : 0;

    leaderboard.forEach((d, i) => {
        let pos = i + 1;
        let prevTime = i > 0 ? leaderboard[i-1].total_time : leaderTime;
        
        let gapLeader = "";
        let gapPrev = "";
        
        // Calcolo Gap
        if (i === 0) { gapLeader = "-"; gapPrev = "-"; }
        else if (d.laps_completed < leaderLaps) {
            let lapsDown = leaderLaps - d.laps_completed;
            gapLeader = formatGap(lapsDown, true);
            gapPrev = leaderboard[i-1].laps_completed > d.laps_completed ? formatGap(leaderboard[i-1].laps_completed - d.laps_completed, true) : formatGap(d.total_time - prevTime);
        } else {
            gapLeader = formatGap(d.total_time - leaderTime);
            gapPrev = formatGap(d.total_time - prevTime);
        }

        let imgUrl = d.headshot_url ? `<img src="${d.headshot_url}" style="width:30px; border-radius:50%; background:#fff;" alt="${d.name_acronym}">` : d.name_acronym;
        let nameColor = d.team_colour ? `#${d.team_colour}` : "#000";
        let pits = Math.max(0, d.stints.length - 1);

        tbody += `<tr>
            <td><b>${pos}</b></td>
            <td style="text-align:left;">${imgUrl} <span style="color:${nameColor}; font-weight:bold; margin-left:8px;">${d.broadcast_name}</span> <span class="w3-tiny w3-text-grey">#${d.driver_number}</span></td>
            <td>${d.team_name}</td>
            <td><b>${formatTime(d.total_time)}</b></td>
            <td>${gapLeader}</td>
            <td class="w3-text-grey">${gapPrev}</td>
            <td>${formatTime(d.last_lap?.lap_duration)}</td>
            <td>${d.last_lap?.duration_sector_1?.toFixed(3) || '-'}</td>
            <td>${d.last_lap?.duration_sector_2?.toFixed(3) || '-'}</td>
            <td>${d.last_lap?.duration_sector_3?.toFixed(3) || '-'}</td>
            <td class="w3-text-purple"><b>${formatTime(d.best_lap)}</b></td>
            <td>${d.best_lap_num}</td>
            <td>${pits}</td>
            <td>${renderTyres(d.stints)}</td>
        </tr>`;
    });

    return { thead, tbody };
}

// Logica Specifica per Qualifiche / Sprint Shootout
function buildQualiTable(drivers, laps, stints) {
    Logger("info", "Elaborazione dati modalità QUALIFICA (Miglior Giro e Ideal Lap)...");

    let stats = {};
    drivers.forEach(d => {
        stats[d.driver_number] = {
            ...d,
            best_lap: Infinity,
            best_lap_obj: null,
            pb_s1: Infinity,
            pb_s2: Infinity,
            pb_s3: Infinity,
            stints: stints.filter(s => s.driver_number === d.driver_number)
        };
    });

    laps.forEach(lap => {
        let st = stats[lap.driver_number];
        if (!st) return;
        
        // Trova il giro migliore assoluto della sessione
        if (lap.lap_duration && lap.lap_duration < st.best_lap) {
            st.best_lap = lap.lap_duration;
            st.best_lap_obj = lap;
        }
        
        // Trova i Personal Bests (PB) per ogni settore
        if (lap.duration_sector_1 && lap.duration_sector_1 < st.pb_s1) st.pb_s1 = lap.duration_sector_1;
        if (lap.duration_sector_2 && lap.duration_sector_2 < st.pb_s2) st.pb_s2 = lap.duration_sector_2;
        if (lap.duration_sector_3 && lap.duration_sector_3 < st.pb_s3) st.pb_s3 = lap.duration_sector_3;
    });

    // Filtra chi non ha un tempo e ordina per Best Lap (dal più veloce al più lento)
    let leaderboard = Object.values(stats).filter(d => d.best_lap !== Infinity);
    leaderboard.sort((a, b) => a.best_lap - b.best_lap);

    // Estrae mescola da un giro basandosi sul lap_number e lo stint corrispondente
    const getLapCompound = (lapObj, driverStints) => {
        if (!lapObj) return "-";
        let stint = driverStints.find(s => lapObj.lap_number >= s.lap_start && lapObj.lap_number <= s.lap_end);
        return renderTyres(stint ? [stint] : []);
    };

    const thead = `<tr>
        <th>POS</th><th>PILOTA</th><th>TEAM</th>
        <th>BEST LAP</th><th>GAP LEADER</th><th>GAP PREV</th>
        <th>PB S1</th><th>PB S2</th><th>PB S3</th>
        <th>IDEAL LAP</th><th>GOMMA</th>
    </tr>`;

    let tbody = "";
    let leaderTime = leaderboard.length > 0 ? leaderboard[0].best_lap : 0;

    leaderboard.forEach((d, i) => {
        let pos = i + 1;
        let prevTime = i > 0 ? leaderboard[i-1].best_lap : leaderTime;
        
        let gapLeader = i === 0 ? "-" : formatGap(d.best_lap - leaderTime);
        let gapPrev = i === 0 ? "-" : formatGap(d.best_lap - prevTime);

        // Calcolo dell'Ideal Lap (somma dei migliori settori personali)
        let ideal = (d.pb_s1 !== Infinity ? d.pb_s1 : 0) + 
                    (d.pb_s2 !== Infinity ? d.pb_s2 : 0) + 
                    (d.pb_s3 !== Infinity ? d.pb_s3 : 0);
        if (ideal === 0) ideal = Infinity;

        let imgUrl = d.headshot_url ? `<img src="${d.headshot_url}" style="width:30px; border-radius:50%; background:#fff;" alt="${d.name_acronym}">` : d.name_acronym;
        let nameColor = d.team_colour ? `#${d.team_colour}` : "#000";

        tbody += `<tr>
            <td><b>${pos}</b></td>
            <td style="text-align:left;">${imgUrl} <span style="color:${nameColor}; font-weight:bold; margin-left:8px;">${d.broadcast_name}</span> <span class="w3-tiny w3-text-grey">#${d.driver_number}</span></td>
            <td class="w3-tiny">${d.team_name}</td>
            <td class="w3-text-purple"><b>${formatTime(d.best_lap)}</b></td>
            <td>${gapLeader}</td>
            <td class="w3-text-grey">${gapPrev}</td>
            <td class="w3-text-green">${d.pb_s1 !== Infinity ? d.pb_s1.toFixed(3) : '-'}</td>
            <td class="w3-text-green">${d.pb_s2 !== Infinity ? d.pb_s2.toFixed(3) : '-'}</td>
            <td class="w3-text-green">${d.pb_s3 !== Infinity ? d.pb_s3.toFixed(3) : '-'}</td>
            <td class="w3-text-blue"><b>${ideal !== Infinity ? formatTime(ideal) : '-'}</b></td>
            <td>${getLapCompound(d.best_lap_obj, d.stints)}</td>
        </tr>`;
    });

    return { thead, tbody };
}

// DA LEGARE AL BOTTONE (onclick)
async function generate_results_table() {
    const sessionKey = document.getElementById('session-select').value;
    
    if (!sessionKey) {
        Logger("warn","Tentativo di generazione tabella interrotto: sessione non selezionata.");
        alert("Per favore, seleziona una Sessione prima di procedere.");
        return;
    }

    const loading = document.getElementById('loading-indicator');
    const tableWrapper = document.getElementById('table-wrapper');
    const thead = document.getElementById('leaderboard-head');
    const tbody = document.getElementById('leaderboard-body');
    const errorMsg = document.getElementById('error-message');
    
    loading.style.display = 'block';
    tableWrapper.style.display = 'none';
    if(errorMsg) errorMsg.style.display = 'none';

    Logger("info",`Inizio elaborazione risultati per la session_key: ${sessionKey}`);

    try {
        Logger("info","Scaricamento parallelo (Drivers, Laps, Stints)...");
        const [driversRes, lapsRes, stintsRes] = await Promise.all([
            fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`),
            fetch(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`),
            fetch(`https://api.openf1.org/v1/stints?session_key=${sessionKey}`)
        ]);

        if (!driversRes.ok || !lapsRes.ok) throw new Error("Errore HTTP API OpenF1.");

        const driversData = await driversRes.json();
        const lapsData = await lapsRes.json();
        const stintsData = await stintsRes.json();

        if (lapsData.length === 0) throw new Error("Dati di telemetria non ancora disponibili per questa sessione.");

        Logger("success",`Dati pronti: ${driversData.length} Piloti, ${lapsData.length} Giri, ${stintsData.length} Stint.`);

        // 1. Capiamo se Gara o Qualifica
        const type = getSessionType(sessionKey);
        Logger("info",`Tipo sessione identificato: ${type}`);

        // 2. Costruiamo l'HTML in base al tipo
        let htmlData;
        if (type === "RACE") {
            htmlData = buildRaceTable(driversData, lapsData, stintsData);
        } else {
            htmlData = buildQualiTable(driversData, lapsData, stintsData);
        }

        // 3. Renderizziamo
        thead.innerHTML = htmlData.thead;
        
        tableWrapper.style.display = 'block';
        Logger("success","Tabella html renderizzata e mostrata all'utente.");

    } catch (error) {
        Logger("error","Errore critico durante l'elaborazione dei risultati:", error);
        if(errorMsg) {
            errorMsg.style.display = 'block';
            errorMsg.innerHTML = `<p><i class="fa fa-exclamation-triangle"></i> ${error.message}</p>`;
        }
    } finally {
        loading.style.display = 'none';
    }
}

// ==========================================
// AVVIO APPLICAZIONE
// ==========================================

window.onload = carica_anni;