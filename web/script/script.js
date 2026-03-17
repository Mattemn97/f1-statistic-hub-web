let cached_meetings_for_year = []; 
let cached_session_for_meeting = []; 

import { Logger } from './utils.js';
import { formatTime } from './utils.js';
import { formatGap } from './utils.js';
import { renderTyres } from './utils.js';
import { getSessionType } from './utils.js';

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
            <td class="w3-tiny">${d.team_name}</td>
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
function buildQualiTable(drivers, laps, stints, sessionKey) {
    Logger("info","Elaborazione dati modalità QUALIFICA...");
    const session = cached_session_for_meeting.find(s => s.session_key == sessionKey);
    const startTimeStr = session.date_start; // Es: 2024-05-25T14:00:00
    const startMs = new Date(startTimeStr).getTime();
    
    // Per definire Q1, Q2, Q3 ci basiamo sui minuti passati dall'inizio sessione
    const isShootout = session.session_name.toLowerCase().includes("shootout");
    // Standard: Q1=18m, Q2=15m, Q3=12m (con pause di 7m). Shootout: SQ1=12m, SQ2=10m, SQ3=8m.
    const q1_end = startMs + (isShootout ? 14 : 20) * 60000;
    const q2_end = startMs + (isShootout ? 26 : 40) * 60000;

    let stats = {};
    drivers.forEach(d => {
        stats[d.driver_number] = {
            ...d,
            q1_best: Infinity, q1_lap: null,
            q2_best: Infinity, q2_lap: null,
            q3_best: Infinity, q3_lap: null,
            overall_best: Infinity,
            stints: stints.filter(s => s.driver_number === d.driver_number)
        };
    });

    laps.forEach(lap => {
        if (!lap.lap_duration) return;
        let st = stats[lap.driver_number];
        if (!st) return;
        
        let lapTimeMs = new Date(lap.date_start).getTime();
        
        // Identifica in che fase è stato fatto il giro
        if (lapTimeMs < q1_end) {
            if (lap.lap_duration < st.q1_best) { st.q1_best = lap.lap_duration; st.q1_lap = lap; }
        } else if (lapTimeMs < q2_end) {
            if (lap.lap_duration < st.q2_best) { st.q2_best = lap.lap_duration; st.q2_lap = lap; }
        } else {
            if (lap.lap_duration < st.q3_best) { st.q3_best = lap.lap_duration; st.q3_lap = lap; }
        }
        
        if (lap.lap_duration < st.overall_best) st.overall_best = lap.lap_duration;
    });

    // Ordinamento Qualifica: Chi ha tempo in Q3 ordina per Q3, altrimenti Q2, altrimenti Q1
    let leaderboard = Object.values(stats).filter(d => d.overall_best !== Infinity);
    leaderboard.sort((a, b) => {
        if (a.q3_best !== Infinity && b.q3_best !== Infinity) return a.q3_best - b.q3_best;
        if (a.q3_best !== Infinity) return -1;
        if (b.q3_best !== Infinity) return 1;
        
        if (a.q2_best !== Infinity && b.q2_best !== Infinity) return a.q2_best - b.q2_best;
        if (a.q2_best !== Infinity) return -1;
        if (b.q2_best !== Infinity) return 1;

        return a.q1_best - b.q1_best;
    });

    // Estrae mescola da un giro basandosi sul lap_number e stint
    const getLapCompound = (lapObj, driverStints) => {
        if (!lapObj) return "";
        let stint = driverStints.find(s => lapObj.lap_number >= s.lap_start && lapObj.lap_number <= s.lap_end);
        return renderTyres(stint ? [stint] : []);
    };

    const thead = `<tr>
        <th rowspan="2">POS</th><th rowspan="2">PILOTA</th><th rowspan="2">TEAM</th>
        <th colspan="6" class="w3-border-left">Q3 / SQ3</th>
        <th colspan="6" class="w3-border-left">Q2 / SQ2</th>
        <th colspan="6" class="w3-border-left">Q1 / SQ1</th>
    </tr>
    <tr>
        <th class="w3-border-left">TIME</th><th>GAP L</th><th>GAP P</th><th>S1</th><th>S2</th><th>S3</th>
        <th class="w3-border-left">TIME</th><th>GAP L</th><th>GAP P</th><th>S1</th><th>S2</th><th>S3</th>
        <th class="w3-border-left">TIME</th><th>GAP L</th><th>GAP P</th><th>S1</th><th>S2</th><th>S3</th>
    </tr>`;

    let tbody = "";
    
    // Tempi Leader per fase
    let l_q3 = leaderboard.find(d => d.q3_best !== Infinity)?.q3_best;
    let l_q2 = leaderboard.find(d => d.q2_best !== Infinity)?.q2_best;
    let l_q1 = leaderboard.find(d => d.q1_best !== Infinity)?.q1_best;

    leaderboard.forEach((d, i) => {
        let pos = i + 1;
        let imgUrl = d.headshot_url ? `<img src="${d.headshot_url}" style="width:30px; border-radius:50%; background:#fff;" alt="${d.name_acronym}">` : d.name_acronym;
        let nameColor = d.team_colour ? `#${d.team_colour}` : "#000";

        // Funzione per generare le colonne di una sessione Q
        const genQCols = (bestTime, lapObj, leaderTime, prevTime) => {
            if (bestTime === Infinity) return `<td class="w3-border-left">-</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>`;
            let gapL = formatGap(bestTime - leaderTime);
            let gapP = formatGap(bestTime - prevTime);
            if (bestTime === leaderTime) { gapL = "-"; gapP = "-"; }
            
            return `
                <td class="w3-border-left w3-text-purple"><b>${formatTime(bestTime)}</b> ${getLapCompound(lapObj, d.stints)}</td>
                <td>${gapL}</td><td class="w3-text-grey">${gapP}</td>
                <td>${lapObj?.duration_sector_1?.toFixed(3) || '-'}</td>
                <td>${lapObj?.duration_sector_2?.toFixed(3) || '-'}</td>
                <td>${lapObj?.duration_sector_3?.toFixed(3) || '-'}</td>
            `;
        };

        // Calcolo Prev Time per Q3, Q2, Q1
        let prev_q3 = i > 0 && leaderboard[i-1].q3_best !== Infinity ? leaderboard[i-1].q3_best : l_q3;
        let prev_q2 = i > 0 && leaderboard[i-1].q2_best !== Infinity ? leaderboard[i-1].q2_best : l_q2;
        let prev_q1 = i > 0 && leaderboard[i-1].q1_best !== Infinity ? leaderboard[i-1].q1_best : l_q1;

        tbody += `<tr>
            <td><b>${pos}</b></td>
            <td style="text-align:left;">${imgUrl} <span style="color:${nameColor}; font-weight:bold; margin-left:8px;">${d.broadcast_name}</span> <span class="w3-tiny w3-text-grey">#${d.driver_number}</span></td>
            <td class="w3-tiny">${d.team_name}</td>
            ${genQCols(d.q3_best, d.q3_lap, l_q3, prev_q3)}
            ${genQCols(d.q2_best, d.q2_lap, l_q2, prev_q2)}
            ${genQCols(d.q1_best, d.q1_lap, l_q1, prev_q1)}
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
            htmlData = buildQualiTable(driversData, lapsData, stintsData, sessionKey);
        }

        // 3. Renderizziamo
        thead.innerHTML = htmlData.thead;
        tbody.innerHTML = htmlData.tbody;
        
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