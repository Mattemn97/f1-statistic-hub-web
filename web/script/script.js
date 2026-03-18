let cached_meetings_for_year = []; 
let cached_session_for_meeting = [];

// Funzione di supporto per creare una pausa (delay)
const delay = ms => new Promise(res => setTimeout(res, ms));


// ==========================================
// 1. FUNZIONI DI SUPPORTO (UTILITY)
// ==========================================

function Logger(type, msg, data = "") {
    switch (type) {
        case "info": console.info(`🔵 [F1-APP] ${msg}`, data); break;
        case "success": console.log(`🟢 [F1-APP] ${msg}`, data); break;
        case "warn": console.warn(`🟠 [F1-APP] ${msg}`, data); break;
        case "error": console.error(`🔴 [F1-APP] ${msg}`, data); break;
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "-";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = (seconds % 60).toFixed(3);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(6, '0')}`;
    else if (m > 0) return `${m}:${s.padStart(6, '0')}`;
    else return s.padStart(6, '0');
}

function formatGap(gapSeconds, isLapped = false) {
    if (isLapped) return `<span class="w3-text-grey">+${gapSeconds} Lap${gapSeconds > 1 ? 's' : ''}</span>`;
    if (!gapSeconds || isNaN(gapSeconds) || gapSeconds === 0) return "-";
    return `+${gapSeconds.toFixed(3)}`;
}

// --- NUOVE FUNZIONI CENTRALIZZATE PER GOMME E STATUS ---

// 1.1 Restituisce i dati stilistici di una singola mescola
function getTyreInfo(compound) {
    const types = {
        "SOFT": { color: "#ff2800", text: "#fff", letter: "S" },
        "MEDIUM": { color: "#f5d033", text: "#fff", letter: "M" },
        "HARD": { color: "#ffffff", text: "#000", letter: "H" },
        "INTERMEDIATE": { color: "#39b54a", text: "#fff", letter: "I" },
        "WET": { color: "#0aeeef", text: "#fff", letter: "W" }
    };
    return types[compound] || { color: "#333", text: "#fff", letter: "?" };
}

// 1.2 Crea l'HTML del pallino per una gomma (supporta due grandezze)
function createTyreBadgeHtml(compound, size = 18) {
    if (!compound) return "-";
    const info = getTyreInfo(compound);
    const fontSize = size === 18 ? 10 : 8;
    const margin = size === 18 ? "margin-right:2px;" : "margin-left:5px;";
    const border = size === 18 ? "border: 1px solid #ccc;" : "";
    return `<span style="display:inline-block; width:${size}px; height:${size}px; border-radius:50%; background-color:${info.color}; color:${info.text}; text-align:center; line-height:${size}px; font-weight:bold; font-size:${fontSize}px; ${margin} ${border} vertical-align:middle;">${info.letter}</span>`;
}

// 1.3 Utilizza createTyreBadgeHtml per mappare gli stint di un pilota (Risultati Gara)
function renderTyres(stintsArray) {
    if (!stintsArray || stintsArray.length === 0) return "-";
    let sortedStints = [...stintsArray].sort((a, b) => a.stint_number - b.stint_number);
    return sortedStints.map(s => createTyreBadgeHtml(s.compound, 18)).join("");
}

// 1.4 Trova lo stint corretto basato sul numero del giro
function getLapStint(lapNumber, driverStints) {
    if (!driverStints) return null;
    return driverStints.find(s => lapNumber >= s.lap_start && lapNumber <= s.lap_end);
}

// 1.5 Valuta il Track Status restituendo il badge HTML corretto
function getTrackStatusBadge(lapTime, raceControlData) {
    if (!raceControlData || raceControlData.length === 0 || !lapTime) return `<span class="w3-text-green">CLEAR</span>`;
    
    let currentEvent = raceControlData
        .filter(rc => new Date(rc.date).getTime() <= lapTime)
        .filter(rc => rc.category === "Flag" || rc.category === "SafetyCar")
        .pop(); 
    
    if (currentEvent) {
        if (currentEvent.category === "SafetyCar") {
            return currentEvent.message && currentEvent.message.includes("VIRTUAL") 
                ? `<span class="w3-text-orange w3-bold">VSC</span>` 
                : `<span class="w3-text-orange w3-bold">SC</span>`;
        } else if (currentEvent.category === "Flag") {
            switch(currentEvent.flag) {
                case "YELLOW": return `<span class="w3-text-yellow w3-bold">YF</span>`;
                case "DOUBLE YELLOW": return `<span class="w3-text-yellow w3-bold">DYF</span>`;
                case "RED": return `<span class="w3-text-red w3-bold">RF</span>`;
                case "GREEN":
                case "CLEAR": return `<span class="w3-text-green"> - </span>`;
            }
        }
    }
    return `<span class="w3-text-green"> - </span>`;
}

function calcolaMediana(numeri) {
    if (!numeri || numeri.length === 0) return null;
    let arrayOrdinato = [...numeri].sort((a, b) => a - b);
    let meta = Math.floor(arrayOrdinato.length / 2);
    return arrayOrdinato.length % 2 !== 0 ? arrayOrdinato[meta] : (arrayOrdinato[meta - 1] + arrayOrdinato[meta]) / 2;
}

function calcolaDeviazioneStandard(numeri) {
    if (!numeri || numeri.length === 0) return null;
    let media = numeri.reduce((a, b) => a + b, 0) / numeri.length;
    let varianza = numeri.reduce((a, b) => a + Math.pow(b - media, 2), 0) / numeri.length;
    return Math.sqrt(varianza);
}

// Crea una linea temporale degli stati della pista per filtrare i giri sporchi
function creaTimelinePista(raceControlData) {
    let timeline = [{ time: 0, status: "GREEN" }];
    if(!raceControlData) return timeline;
    
    let rc = [...raceControlData].sort((a, b) => new Date(a.date) - new Date(b.date));
    for (let event of rc) {
        let time = new Date(event.date).getTime();
        if (event.category === "SafetyCar") {
            if (event.message && event.message.includes("CLEAR")) timeline.push({time, status: "GREEN"});
            else if (event.message && event.message.includes("VIRTUAL")) timeline.push({time, status: "VSC"});
            else timeline.push({time, status: "SC"});
        } else if (event.category === "Flag") {
            if (event.flag === "GREEN" || event.flag === "CLEAR") timeline.push({time, status: "GREEN"});
            else if (event.flag === "YELLOW" || event.flag === "DOUBLE YELLOW") timeline.push({time, status: "YELLOW"});
            else if (event.flag === "RED") timeline.push({time, status: "RED"});
        }
    }
    return timeline;
}

// Determina se un giro è pulito (niente pit, niente bandiere, esclude il giro 1)
function isGiroPulito(lap, timeline) {
    if (!lap.lap_duration || lap.pit_in_time || lap.pit_out_time || lap.lap_number === 1) return false;
    
    let start = new Date(lap.date_start).getTime();
    let end = start + (lap.lap_duration * 1000);
    
    // Controlla lo stato all'inizio del giro
    let currentStatus = "GREEN";
    for (let t of timeline) {
        if (t.time <= start) currentStatus = t.status;
        else break;
    }
    if (currentStatus !== "GREEN") return false;
    
    // Controlla se ci sono stati cambi di stato (bandiere) DURANTE il giro
    for (let t of timeline) {
        if (t.time > start && t.time < end && t.status !== "GREEN") {
            return false;
        }
    }
    return true;
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
// 2. INIZIALIZZAZIONE E FETCH CONDIVISE
// ==========================================

function carica_anni() {
    Logger("info","Caricamento anni iniziali...");
    const yearSelect = document.getElementById('year-select');
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 2023; y--) {
        yearSelect.options.add(new Option(y, y));
    }
    Logger("success","Anni caricati con successo.");
}

async function carica_granpremi() {
    const year = document.getElementById('year-select').value;
    const gpSelect = document.getElementById('gp-select');
    const sessionSelect = document.getElementById('session-select');
    
    if (!year) {
        gpSelect.innerHTML = '<option value="">-- Seleziona prima l\'anno --</option>';
        sessionSelect.innerHTML = '<option value="">-- Seleziona prima un GP --</option>';
        return;
    }

    gpSelect.innerHTML = '<option value="">Caricamento GP...</option>';
    sessionSelect.innerHTML = '<option value="">-- Seleziona prima un GP --</option>';

    try {
        const res = await fetch(`https://api.openf1.org/v1/meetings?year=${year}`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        
        cached_meetings_for_year = await res.json();
        gpSelect.innerHTML = '<option value="">-- Seleziona Gran Premio --</option>';
        
        const meetingKeysSet = new Set();
        cached_meetings_for_year.forEach(meeting => {
            if (!meetingKeysSet.has(meeting.meeting_key)) {
                meetingKeysSet.add(meeting.meeting_key);
                gpSelect.options.add(new Option(meeting.meeting_name, meeting.meeting_key));
            }
        });
    } catch (error) {
        Logger("error","Errore caricamento GP:", error);
        gpSelect.innerHTML = '<option value="">Errore di caricamento</option>';
    }
}

// Funzione base unificata per caricare le sessioni
async function fetch_sessions_core(filterRaceOnly = false) {
    const gp = document.getElementById('gp-select').value;
    const sessionSelect = document.getElementById('session-select');
    
    if (!gp) {
        sessionSelect.innerHTML = '<option value="">-- Seleziona prima un GP --</option>';
        return;
    }

    sessionSelect.innerHTML = '<option value="">Caricamento Sessioni... </option>';

    try {
        const res = await fetch(`https://api.openf1.org/v1/sessions?meeting_key=${gp}`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

        let sessions = await res.json();
        
        if (filterRaceOnly) {
            cached_session_for_meeting = sessions.filter(s => {
                const name = s.session_name.toLowerCase();
                return name.includes("race") || (name.includes("sprint") && !name.includes("shootout") && !name.includes("qualifying"));
            });
        } else {
            cached_session_for_meeting = sessions;
        }

        sessionSelect.innerHTML = '<option value="">-- Seleziona Sessione --</option>';
        cached_session_for_meeting.forEach(session => {
            sessionSelect.options.add(new Option(session.session_name, session.session_key));
        });
    } catch (error) {
        Logger("error","Errore caricamento Sessioni:", error);
        sessionSelect.innerHTML = '<option value="">Errore di caricamento</option>';
    }
}

// Wrapper per l'interfaccia UI
async function carica_sessioni() { await fetch_sessions_core(false); }
async function carica_sessioni_solo_gare() { await fetch_sessions_core(true); }

// Nuovo: MOTORE DI FETCH UNIFICATO CON RATE LIMITING INTEGRATO
async function fetch_telemetria_sessione(sessionKey, necessitaRaceControl = false) {
    Logger("info", "Scaricamento dati Telemetria in sequenza (anti-rate limit)...");
    
    const fetchAPI = async (endpoint) => {
        const res = await fetch(`https://api.openf1.org/v1/${endpoint}?session_key=${sessionKey}`);
        if (!res.ok) throw new Error(`Errore API ${endpoint}: ${res.status}`);
        return await res.json();
    };

    const driversData = await fetchAPI("drivers");
    await delay(300);
    const lapsData = await fetchAPI("laps");
    await delay(300);
    const stintsData = await fetchAPI("stints");

    let raceControlData = [];
    if (necessitaRaceControl) {
        await delay(300);
        try {
            const rcRes = await fetch(`https://api.openf1.org/v1/race_control?session_key=${sessionKey}`);
            if (rcRes.ok) {
                raceControlData = await rcRes.json();
                if (!Array.isArray(raceControlData)) raceControlData = [];
            } else {
                Logger("warn", "Rate Limit su Race Control");
            }
        } catch (e) {
            Logger("warn", "Chiamata Race Control fallita.");
        }
    }

    if (lapsData.length === 0) throw new Error("Dati di telemetria non ancora disponibili per questa sessione.");
    
    return { driversData, lapsData, stintsData, raceControlData };
}

// ==========================================
// 3. COSTRUTTORI TABELLE (BUSINESS LOGIC)
// ==========================================

function crea_tabella_risultati_gara(drivers, laps, stints) {
    let stats = {};
    drivers.forEach(d => {
        stats[d.driver_number] = {
            ...d, laps_completed: 0, total_time: 0, best_lap: Infinity, best_lap_num: "-",
            last_lap: null, stints: stints.filter(s => s.driver_number === d.driver_number)
        };
    });

    laps.forEach(lap => {
        let st = stats[lap.driver_number];
        if (!st) return;

        st.laps_completed++;
        st.total_time += (lap.lap_duration || 0);
        st.last_lap = lap;

        if (lap.lap_duration && lap.lap_duration < st.best_lap) {
            st.best_lap = lap.lap_duration;
            st.best_lap_num = lap.lap_number;
        }
    });

    let leaderboard = Object.values(stats).filter(d => d.laps_completed > 0);
    leaderboard.sort((a, b) => b.laps_completed !== a.laps_completed ? b.laps_completed - a.laps_completed : a.total_time - b.total_time);

    const thead = `<tr><th>POS</th><th>PILOTA</th><th>TEAM</th><th>TEMPO TOTALE</th><th>GAP LEADER</th><th>GAP PREV</th><th>LAST LAP</th><th>L-S1</th><th>L-S2</th><th>L-S3</th><th>BEST LAP</th><th>L#</th><th>PITS</th><th>GOMME</th></tr>`;
    let tbody = "";
    let leaderLaps = leaderboard.length > 0 ? leaderboard[0].laps_completed : 0;
    let leaderTime = leaderboard.length > 0 ? leaderboard[0].total_time : 0;

    leaderboard.forEach((d, i) => {
        let prevTime = i > 0 ? leaderboard[i-1].total_time : leaderTime;
        let gapLeader = "-", gapPrev = "-";
        
        if (i > 0) {
            if (d.laps_completed < leaderLaps) {
                gapLeader = formatGap(leaderLaps - d.laps_completed, true);
                gapPrev = leaderboard[i-1].laps_completed > d.laps_completed ? formatGap(leaderboard[i-1].laps_completed - d.laps_completed, true) : formatGap(d.total_time - prevTime);
            } else {
                gapLeader = formatGap(d.total_time - leaderTime);
                gapPrev = formatGap(d.total_time - prevTime);
            }
        }

        let imgUrl = d.headshot_url ? `<img src="${d.headshot_url}" style="width:30px; border-radius:50%; background:#fff;" alt="${d.name_acronym}">` : d.name_acronym;
        let nameColor = d.team_colour ? `#${d.team_colour}` : "#000";

        tbody += `<tr>
            <td><b>${i + 1}</b></td>
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
            <td>${Math.max(0, d.stints.length - 1)}</td>
            <td>${renderTyres(d.stints)}</td>
        </tr>`;
    });

    return { thead, tbody };
}

function crea_tabella_risultati_qualifiche(drivers, laps, stints) {
    let stats = {};
    drivers.forEach(d => {
        stats[d.driver_number] = {
            ...d, best_lap: Infinity, best_lap_obj: null,
            pb_s1: Infinity, pb_s2: Infinity, pb_s3: Infinity,
            stints: stints.filter(s => s.driver_number === d.driver_number)
        };
    });

    laps.forEach(lap => {
        let st = stats[lap.driver_number];
        if (!st) return;
        
        if (lap.lap_duration && lap.lap_duration < st.best_lap) {
            st.best_lap = lap.lap_duration;
            st.best_lap_obj = lap;
        }
        
        if (lap.duration_sector_1 && lap.duration_sector_1 < st.pb_s1) st.pb_s1 = lap.duration_sector_1;
        if (lap.duration_sector_2 && lap.duration_sector_2 < st.pb_s2) st.pb_s2 = lap.duration_sector_2;
        if (lap.duration_sector_3 && lap.duration_sector_3 < st.pb_s3) st.pb_s3 = lap.duration_sector_3;
    });

    let leaderboard = Object.values(stats).filter(d => d.best_lap !== Infinity);
    leaderboard.sort((a, b) => a.best_lap - b.best_lap);

    const thead = `<tr><th>POS</th><th>PILOTA</th><th>TEAM</th><th>BEST LAP</th><th>GAP LEADER</th><th>GAP PREV</th><th>PB S1</th><th>PB S2</th><th>PB S3</th><th>IDEAL LAP</th><th>GOMMA</th></tr>`;
    let tbody = "";
    let leaderTime = leaderboard.length > 0 ? leaderboard[0].best_lap : 0;

    leaderboard.forEach((d, i) => {
        let prevTime = i > 0 ? leaderboard[i-1].best_lap : leaderTime;
        let ideal = (d.pb_s1 !== Infinity ? d.pb_s1 : 0) + (d.pb_s2 !== Infinity ? d.pb_s2 : 0) + (d.pb_s3 !== Infinity ? d.pb_s3 : 0);
        let imgUrl = d.headshot_url ? `<img src="${d.headshot_url}" style="width:30px; border-radius:50%; background:#fff;" alt="${d.name_acronym}">` : d.name_acronym;
        let nameColor = d.team_colour ? `#${d.team_colour}` : "#000";
        
        // Uso della nuova funzione unificata per trovare lo stint e renderizzare il pallino
        let bestLapStint = getLapStint(d.best_lap_obj?.lap_number, d.stints);
        let tyreHtml = bestLapStint ? createTyreBadgeHtml(bestLapStint.compound, 18) : "-";

        tbody += `<tr>
            <td><b>${i + 1}</b></td>
            <td style="text-align:left;">${imgUrl} <span style="color:${nameColor}; font-weight:bold; margin-left:8px;">${d.broadcast_name}</span> <span class="w3-tiny w3-text-grey">#${d.driver_number}</span></td>
            <td class="w3-tiny">${d.team_name}</td>
            <td class="w3-text-purple"><b>${formatTime(d.best_lap)}</b></td>
            <td>${i === 0 ? "-" : formatGap(d.best_lap - leaderTime)}</td>
            <td class="w3-text-grey">${i === 0 ? "-" : formatGap(d.best_lap - prevTime)}</td>
            <td class="w3-text-green">${d.pb_s1 !== Infinity ? d.pb_s1.toFixed(3) : '-'}</td>
            <td class="w3-text-green">${d.pb_s2 !== Infinity ? d.pb_s2.toFixed(3) : '-'}</td>
            <td class="w3-text-green">${d.pb_s3 !== Infinity ? d.pb_s3.toFixed(3) : '-'}</td>
            <td class="w3-text-blue"><b>${ideal !== 0 ? formatTime(ideal) : '-'}</b></td>
            <td>${tyreHtml}</td>
        </tr>`;
    });

    return { thead, tbody };
}

// ==========================================
// 4. AZIONI UI PRINCIPALI
// ==========================================

async function genera_tabella_risultati() {
    const sessionKey = document.getElementById('session-select').value;
    if (!sessionKey) return alert("Seleziona una Sessione.");

    const ui = {
        loading: document.getElementById('loading-indicator'),
        wrapper: document.getElementById('table-wrapper'),
        thead: document.getElementById('leaderboard-head'),
        tbody: document.getElementById('leaderboard-body'),
        error: document.getElementById('error-message')
    };
    
    ui.loading.style.display = 'block';
    ui.wrapper.style.display = 'none';
    if(ui.error) ui.error.style.display = 'none';

    try {
        // Usa la nuova funzione unificata
        const data = await fetch_telemetria_sessione(sessionKey, false);
        const type = getSessionType(sessionKey);

        let htmlData = type === "RACE" 
            ? crea_tabella_risultati_gara(data.driversData, data.lapsData, data.stintsData)
            : crea_tabella_risultati_qualifiche(data.driversData, data.lapsData, data.stintsData);

        ui.thead.innerHTML = htmlData.thead;
        ui.tbody.innerHTML = htmlData.tbody;
        ui.wrapper.style.display = 'block';

    } catch (error) {
        Logger("error","Errore elaborazione risultati:", error);
        if(ui.error) { ui.error.style.display = 'block'; ui.error.innerHTML = `<p><i class="fa fa-exclamation-triangle"></i> ${error.message}</p>`; }
    } finally {
        ui.loading.style.display = 'none';
    }
}


async function genera_tabella_passo_gara() {
    const sessionKey = document.getElementById('session-select').value;
    if (!sessionKey) return alert("Seleziona una Sessione.");

    const ui = {
        loading: document.getElementById('loading-indicator'),
        wrapper: document.getElementById('table-wrapper'),
        thead: document.getElementById('leaderboard-head'),
        tbody: document.getElementById('leaderboard-body'),
        error: document.getElementById('error-message')
    };
    
    ui.loading.style.display = 'block';
    ui.wrapper.style.display = 'none';
    if(ui.error) ui.error.style.display = 'none';

    try {
        const { driversData, lapsData, stintsData, raceControlData } = await fetch_telemetria_sessione(sessionKey, true);

        const driversWithLaps = [...new Set(lapsData.map(l => l.driver_number))];
        let activeDrivers = driversData.filter(d => driversWithLaps.includes(d.driver_number));
        let maxLaps = Math.max(...lapsData.map(l => l.lap_number));

        // ORDINAMENTO PILOTI (Dal 1° all'ultimo)
        let sortingStats = {};
        activeDrivers.forEach(d => {
            sortingStats[d.driver_number] = { laps_completed: 0, total_time: 0 };
        });

        lapsData.forEach(lap => {
            let st = sortingStats[lap.driver_number];
            if (st) {
                st.laps_completed++;
                st.total_time += (lap.lap_duration || 0);
            }
        });

        activeDrivers.sort((a, b) => {
            let stA = sortingStats[a.driver_number];
            let stB = sortingStats[b.driver_number];
            if (stB.laps_completed !== stA.laps_completed) {
                return stB.laps_completed - stA.laps_completed;
            }
            return stA.total_time - stB.total_time;
        });

        // HEADER
        let trHead = `<tr><th style="background-color:#fff; vertical-align:center; padding-bottom:15px;">GIRO</th>`;
        activeDrivers.forEach(d => {
            let color = d.team_colour ? `#${d.team_colour}` : "#fff";
            let imgUrl = d.headshot_url ? `<img src="${d.headshot_url}" style="width:35px; border-radius:50%; background:#fff; display:block; margin: 0 auto 5px auto;" alt="${d.name_acronym}">` : '';
            trHead += `<th style="border-bottom: 3px solid ${color}; text-align:center; min-width:80px; vertical-align:bottom; padding-bottom:10px;">${imgUrl}<span style="color:${color}; font-weight:bold; font-size:14px;">${d.name_acronym}</span><br><span class="w3-tiny w3-text-grey">#${d.driver_number}</span></th>`;
        });
        trHead += `<th style="background-color:#fff; vertical-align:center; padding-bottom:15px;">TRACK STATUS</th></tr>`;
        ui.thead.innerHTML = trHead;

        // ==========================================
        // 1. CALCOLIAMO IL BEST LAP ASSOLUTO DI OGNI PILOTA (Il Viola)
        // ==========================================
        let absolutePersonalBests = {};
        activeDrivers.forEach(d => {
            let driverLaps = lapsData.filter(l => l.driver_number === d.driver_number && l.lap_duration);
            if (driverLaps.length > 0) {
                absolutePersonalBests[d.driver_number] = Math.min(...driverLaps.map(l => l.lap_duration));
            } else {
                absolutePersonalBests[d.driver_number] = Infinity;
            }
        });

        // ==========================================
        // 2. INIZIALIZZIAMO I TEMPI PROGRESSIVI (Per i Verdi)
        // ==========================================
        let currentPersonalBests = {};
        activeDrivers.forEach(d => { 
            currentPersonalBests[d.driver_number] = Infinity; 
        });

        // BODY
        let tbodyHtml = "";
        for (let lapNum = 1; lapNum <= maxLaps; lapNum++) {
            let lapRecords = lapsData.filter(l => l.lap_number === lapNum);
            let tr = `<tr><td style="background-color:#eee;"><b>${lapNum}</b></td>`;
            
            let lapStartTime = (lapRecords.length > 0 && lapRecords[0].date_start) ? new Date(lapRecords[0].date_start).getTime() : null;
            let statusBadge = getTrackStatusBadge(lapStartTime, raceControlData);

            // Dati piloti
            activeDrivers.forEach(d => {
                let lap = lapRecords.find(l => l.driver_number === d.driver_number);
                if (!lap || !lap.lap_duration) {
                    tr += `<td>-</td>`; return;
                }

                let colorStyle = "";
                
                // LOGICA DEI COLORI
                if (lap.pit_in_time || lap.pit_out_time) {
                    // CIANO: Pitstop
                    colorStyle = "color: #0aeeef; font-weight: bold;"; 
                } else if (lap.lap_duration === absolutePersonalBests[d.driver_number]) {
                    // VIOLA: È il miglior giro in assoluto del pilota
                    colorStyle = "color: #b92df7; font-weight: bold;"; 
                    currentPersonalBests[d.driver_number] = lap.lap_duration; // Aggiorna il progressivo
                } else if (currentPersonalBests[d.driver_number] !== Infinity && lap.lap_duration < currentPersonalBests[d.driver_number]) {
                    // VERDE: Migliora il suo record precedente, ma NON è il suo miglior giro assoluto
                    colorStyle = "color: #39b54a; font-weight: bold;"; 
                    currentPersonalBests[d.driver_number] = lap.lap_duration; // Aggiorna il progressivo
                } else if (currentPersonalBests[d.driver_number] === Infinity) {
                    // NEUTRO: È il primissimo giro valido. Stabilisce il tempo base, ma non si colora di verde
                    currentPersonalBests[d.driver_number] = lap.lap_duration;
                }

                let stint = getLapStint(lapNum, stintsData.filter(s => s.driver_number === d.driver_number));
                let compHtml = stint ? createTyreBadgeHtml(stint.compound, 12) : "";

                tr += `<td style="${colorStyle}">${formatTime(lap.lap_duration)}${compHtml}</td>`;
            });

            tr += `<td style="background-color:#eee; font-size:12px; vertical-align:middle;">${statusBadge}</td></tr>`;
            tbodyHtml += tr;
        }

        ui.tbody.innerHTML = tbodyHtml;
        ui.wrapper.style.display = 'block';

    } catch (error) {
        Logger("error", "Errore Passo Gara:", error);
        if(ui.error) { ui.error.style.display = 'block'; ui.error.innerHTML = `<p><i class="fa fa-exclamation-triangle"></i> ${error.message}</p>`; }
    } finally {
        ui.loading.style.display = 'none';
    }
}

async function genera_tabella_analisi_passo_gara() {
    const sessionKey = document.getElementById('session-select').value;
    if (!sessionKey) return alert("Seleziona una Sessione.");

    const ui = {
        loading: document.getElementById('loading-indicator'),
        wrapper: document.getElementById('table-wrapper'),
        thead: document.getElementById('leaderboard-head'),
        tbody: document.getElementById('leaderboard-body'),
        error: document.getElementById('error-message')
    };
    
    ui.loading.style.display = 'block';
    ui.wrapper.style.display = 'none';
    if(ui.error) ui.error.style.display = 'none';

    try {
        const { driversData, lapsData, raceControlData } = await fetch_telemetria_sessione(sessionKey, true);

        // 1. Ordina i piloti in base all'arrivo della gara
        const driversWithLaps = [...new Set(lapsData.map(l => l.driver_number))];
        let activeDrivers = driversData.filter(d => driversWithLaps.includes(d.driver_number));
        
        let sortingStats = {};
        activeDrivers.forEach(d => sortingStats[d.driver_number] = { laps_completed: 0, total_time: 0 });
        lapsData.forEach(lap => {
            if (sortingStats[lap.driver_number]) {
                sortingStats[lap.driver_number].laps_completed++;
                sortingStats[lap.driver_number].total_time += (lap.lap_duration || 0);
            }
        });
        activeDrivers.sort((a, b) => {
            let stA = sortingStats[a.driver_number], stB = sortingStats[b.driver_number];
            if (stB.laps_completed !== stA.laps_completed) return stB.laps_completed - stA.laps_completed;
            return stA.total_time - stB.total_time;
        });

        // 2. Costruzione Timeline e Calcolo Statistiche Piloti
        let trackTimeline = creaTimelinePista(raceControlData);
        let driverStats = {};
        let absoluteBest = Infinity;

        activeDrivers.forEach(d => {
            let driverLaps = lapsData.filter(l => l.driver_number === d.driver_number);
            let cleanLaps = driverLaps.filter(l => isGiroPulito(l, trackTimeline));
            
            let best_lap = cleanLaps.length > 0 ? Math.min(...cleanLaps.map(l => l.lap_duration)) : null;
            if (best_lap && best_lap < absoluteBest) absoluteBest = best_lap;

            let pb_s1 = cleanLaps.length > 0 ? Math.min(...cleanLaps.map(l => l.duration_sector_1 || Infinity)) : null;
            let pb_s2 = cleanLaps.length > 0 ? Math.min(...cleanLaps.map(l => l.duration_sector_2 || Infinity)) : null;
            let pb_s3 = cleanLaps.length > 0 ? Math.min(...cleanLaps.map(l => l.duration_sector_3 || Infinity)) : null;
            
            let theoretical_best = (pb_s1 !== Infinity && pb_s2 !== Infinity && pb_s3 !== Infinity) ? (pb_s1 + pb_s2 + pb_s3) : null;
            
            let cleanDurations = cleanLaps.map(l => l.lap_duration).filter(v => v);

            driverStats[d.driver_number] = {
                best_lap: best_lap,
                theoretical_best: theoretical_best,
                median: calcolaMediana(cleanDurations),
                std_dev: calcolaDeviazioneStandard(cleanDurations)
            };
        });

        let winnerMedian = activeDrivers.length > 0 ? driverStats[activeDrivers[0].driver_number].median : null;

        // 3. Render Header (Piloti per colonna)
        let trHead = `<tr><th style="background-color:#fff; min-width: 200px; border-right: 2px solid #ccc; vertical-align: middle;">Metriche</th>`;
        activeDrivers.forEach(d => {
            let color = d.team_colour ? `#${d.team_colour}` : "#fff";
            let imgUrl = d.headshot_url ? `<img src="${d.headshot_url}" style="width:30px; border-radius:50%; background:#fff; display:block; margin: 0 auto 5px auto;" alt="${d.name_acronym}">` : '';
            trHead += `<th style="border-bottom: 3px solid ${color}; text-align:center; min-width:100px;">${imgUrl}<span style="color:${color}; font-weight:bold;">${d.name_acronym}</span></th>`;
        });
        trHead += `</tr>`;
        ui.thead.innerHTML = trHead;

        // 4. Funzioni per la formattazione di righe
        const formatCell = (val, isDiff = false) => {
            if (!val || val === Infinity) return '<span class="w3-text-grey">-</span>';
            if (isDiff) return `<span class="w3-text-grey">${val > 0 ? '+' : ''}${val.toFixed(3)}</span>`;
            return `<b>${formatTime(val)}</b>`;
        };

        // 5. Costruzione delle Righe (Metriche)
        let rowsHtml = "";
        const metriche = [
            { id: 'best_lap', label: 'Migliore Personale', format: (d) => formatCell(d.best_lap), color: 'w3-text-purple' },
            { id: 'diff_abs', label: 'MP - Migliore Assoluto', format: (d) => formatCell(d.best_lap ? d.best_lap - absoluteBest : null, true), color: '' },
            { id: 'theoretical_best', label: 'Migliore Teorico', format: (d) => formatCell(d.theoretical_best), color: 'w3-text-blue' },
            { id: 'diff_theo', label: 'MP - Teorico', format: (d) => formatCell(d.best_lap && d.theoretical_best ? d.best_lap - d.theoretical_best : null, true), color: '' },
            { id: 'median', label: 'Mediano', format: (d) => formatCell(d.median), color: 'w3-text-green' },
            { id: 'diff_median', label: 'Mediano (Personale - Vincitore)', format: (d) => formatCell(d.median && winnerMedian ? d.median - winnerMedian : null, true), color: '' },
            { id: 'std_dev', label: 'Costanza', format: (d) => d.std_dev !== null ? `<b>${d.std_dev.toFixed(3)} s</b>` : '-', color: 'w3-text-orange' }
        ];

        metriche.forEach((m, index) => {
            let rowBg = index % 2 === 0 ? "background-color: #fafafa;" : "background-color: #fff;";
            let tr = `<tr style="${rowBg}">
                        <td style="border-right: 2px solid #ccc; vertical-align:middle;"><b class="${m.color}">${m.label}</b></td>`;
            activeDrivers.forEach(d => {
                let stats = driverStats[d.driver_number];
                tr += `<td style="text-align:center; vertical-align:middle;">${m.format(stats)}</td>`;
            });
            tr += `</tr>`;
            rowsHtml += tr;
        });

        ui.tbody.innerHTML = rowsHtml;
        ui.wrapper.style.display = 'block';

    } catch (error) {
        console.error("Errore Analisi Passo Gara:", error);
        if(ui.error) { ui.error.style.display = 'block'; ui.error.innerHTML = `<p><i class="fa fa-exclamation-triangle"></i> ${error.message}</p>`; }
    } finally {
        ui.loading.style.display = 'none';
    }
}

// ==========================================
// ESPORTAZIONE TABELLA IN PNG
// ==========================================

async function stampa_tabella(prefisso_nome = "Esportazione") {
    const tableContainer = document.getElementById('table-wrapper');
    
    if (!tableContainer || tableContainer.style.display === 'none') {
        alert("Nessuna tabella da esportare. Calcola prima le statistiche!");
        return;
    }

    const originalOverflow = tableContainer.style.overflowX;
    tableContainer.style.overflowX = 'visible';

    try {
        const canvas = await html2canvas(tableContainer, {
            scale: 3,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false
        });

        tableContainer.style.overflowX = originalOverflow;
        const imgData = canvas.toDataURL('image/png');

        const year = document.getElementById('year-select').value || "Anno";
        const gpSelect = document.getElementById('gp-select');
        const gpName = gpSelect.options[gpSelect.selectedIndex]?.text || "GP";
        const sessionSelect = document.getElementById('session-select');
        const sessionName = sessionSelect.options[sessionSelect.selectedIndex]?.text || "Sessione";
        
        // Usa il prefisso dinamico per il nome del file
        const safeFileName = `${prefisso_nome}_${year}_${gpName}_${sessionName}`.replace(/[^a-z0-9]/gi, '_').toLowerCase();

        const downloadLink = document.createElement('a');
        downloadLink.download = `${safeFileName}.png`;
        downloadLink.href = imgData;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

    } catch (error) {
        console.error("Errore durante la generazione del PNG:", error);
        alert("Si è verificato un errore durante la creazione dell'immagine. Riprova.");
        tableContainer.style.overflowX = originalOverflow;
    }
}


// ==========================================
// AVVIO APPLICAZIONE
// ==========================================

window.onload = carica_anni;