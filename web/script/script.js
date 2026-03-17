let currentSessionsData = []; // Salva i dati grezzi delle sessioni per filtrare velocemente

// --- GESTIONE DEI MENU A TENDINA ---

async function initDropdowns() {
    const yearSelect = document.getElementById('year-select');
    const currentYear = new Date().getFullYear();
    
    // OpenF1 possiede dati storici solidi dal 2023 in poi
    for (let y = currentYear; y >= 2023; y--) {
        yearSelect.options.add(new Option(y, y));
    }
    // Scarica i GP per l'anno di default appena caricata la pagina
    await fetchMeetings();
}

async function fetchMeetings() {
    const year = document.getElementById('year-select').value;
    const gpSelect = document.getElementById('gp-select');
    const sessionSelect = document.getElementById('session-select');
    
    gpSelect.innerHTML = '<option value="">Caricamento GP...</option>';
    gpSelect.disabled = true;
    sessionSelect.innerHTML = '<option value="">Attendi...</option>';
    sessionSelect.disabled = true;

    try {
        // Chiamata all'API per ottenere tutte le sessioni dell'anno selezionato
        const res = await fetch(`https://api.openf1.org/v1/sessions?year=${year}`);
        currentSessionsData = await res.json();

        // Estraiamo i Gran Premi univoci (Meeting) dall'elenco delle sessioni
        const uniqueMeetings = [];
        const meetingKeysSet = new Set();
        
        currentSessionsData.forEach(session => {
            if (!meetingKeysSet.has(session.meeting_key)) {
                meetingKeysSet.add(session.meeting_key);
                uniqueMeetings.push({
                    key: session.meeting_key,
                    name: session.meeting_name || session.country_name
                });
            }
        });

        gpSelect.innerHTML = '<option value="">-- Seleziona Gran Premio --</option>';
        uniqueMeetings.forEach(m => {
            gpSelect.options.add(new Option(m.name, m.key));
        });
        gpSelect.disabled = false;

    } catch (error) {
        console.error("Errore fetch GP:", error);
        gpSelect.innerHTML = '<option value="">Errore API</option>';
    }
}

function updateSessionsDropdown() {
    const meetingKey = document.getElementById('gp-select').value;
    const sessionSelect = document.getElementById('session-select');
    
    sessionSelect.innerHTML = '<option value="">-- Seleziona Sessione --</option>';
    
    if (!meetingKey) {
        sessionSelect.disabled = true;
        return;
    }

    // Filtriamo l'elenco in memoria per trovare solo le sessioni di questo GP
    const filteredSessions = currentSessionsData.filter(s => s.meeting_key == meetingKey);
    
    filteredSessions.forEach(s => {
        sessionSelect.options.add(new Option(s.session_name, s.session_key));
    });
    sessionSelect.disabled = false;
}

// Funzione per formattare i secondi in MM:SS.ms (equivalente a _format_time in Python)
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "-";
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(3);
    return m > 0 ? `${m}:${s.padStart(6, '0')}` : s.padStart(6, '0');
}

async function fetchLeaderboardData() {
    const loading = document.getElementById('loading-indicator');
    const tableWrapper = document.getElementById('table-wrapper');
    const tbody = document.getElementById('leaderboard-body');
    
    // Mostra caricamento, nascondi tabella
    loading.style.display = 'block';
    tableWrapper.style.display = 'none';
    tbody.innerHTML = '';

    try {
        // 1. Chiamiamo OpenF1 per ottenere la lista dei piloti e le sigle (es. VER, LEC)
        const driversRes = await fetch('https://api.openf1.org/v1/drivers?session_key=latest');
        const driversData = await driversRes.json();
        
        let driverMap = {};
        driversData.forEach(d => {
            driverMap[d.driver_number] = d.name_acronym;
        });

        // 2. Chiamiamo OpenF1 per ottenere TUTTI i giri dell'ultima sessione
        const lapsRes = await fetch('https://api.openf1.org/v1/laps?session_key=latest');
        const lapsData = await lapsRes.json();

        // 3. Elaborazione Dati (equivalente a Pandas groupby)
        let driverStats = {};

        lapsData.forEach(lap => {
            let dNum = lap.driver_number;
            if (!driverStats[dNum]) {
                driverStats[dNum] = {
                    id: driverMap[dNum] || dNum,
                    laps: [],
                    best_lap: Infinity,
                    best_lap_num: "-",
                    pb_s1: Infinity,
                    pb_s2: Infinity,
                    pb_s3: Infinity,
                    last_lap: null
                };
            }

            let stats = driverStats[dNum];
            stats.laps.push(lap);
            stats.last_lap = lap; // L'ultimo giro processato sarà il Last Lap

            // Personal Bests
            if (lap.lap_duration && lap.lap_duration < stats.best_lap) {
                stats.best_lap = lap.lap_duration;
                stats.best_lap_num = lap.lap_number;
            }
            if (lap.duration_sector_1 && lap.duration_sector_1 < stats.pb_s1) stats.pb_s1 = lap.duration_sector_1;
            if (lap.duration_sector_2 && lap.duration_sector_2 < stats.pb_s2) stats.pb_s2 = lap.duration_sector_2;
            if (lap.duration_sector_3 && lap.duration_sector_3 < stats.pb_s3) stats.pb_s3 = lap.duration_sector_3;
        });

        // 4. Convertiamo in array, calcoliamo Ideal Lap e ordiniamo per Best Lap (Classifica base)
        let leaderboard = Object.values(driverStats).filter(d => d.best_lap !== Infinity);
        
        leaderboard.sort((a, b) => a.best_lap - b.best_lap);

        // 5. Generiamo l'HTML per la tabella
        leaderboard.forEach((driver, index) => {
            let pos = index + 1;
            let last = driver.last_lap || {};
            let ideal = driver.pb_s1 + driver.pb_s2 + driver.pb_s3;

            let row = `<tr>
                <td>${pos}</td>
                <td><b>${driver.id}</b></td>
                <td class="w3-text-purple"><b>${formatTime(driver.best_lap)}</b></td>
                <td>${driver.best_lap_num}</td>
                <td>${formatTime(last.lap_duration)}</td>
                <td>${last.duration_sector_1 ? last.duration_sector_1.toFixed(3) : '-'}</td>
                <td>${last.duration_sector_2 ? last.duration_sector_2.toFixed(3) : '-'}</td>
                <td>${last.duration_sector_3 ? last.duration_sector_3.toFixed(3) : '-'}</td>
                <td class="w3-text-green">${driver.pb_s1 !== Infinity ? driver.pb_s1.toFixed(3) : '-'}</td>
                <td class="w3-text-green">${driver.pb_s2 !== Infinity ? driver.pb_s2.toFixed(3) : '-'}</td>
                <td class="w3-text-green">${driver.pb_s3 !== Infinity ? driver.pb_s3.toFixed(3) : '-'}</td>
                <td class="w3-text-blue"><b>${formatTime(ideal)}</b></td>
            </tr>`;
            tbody.innerHTML += row;
        });

    } catch (error) {
        console.error("Errore durante il fetch dei dati:", error);
        tbody.innerHTML = `<tr><td colspan="12" class="w3-text-red">Errore nel caricamento dei dati dall'API. Riprova.</td></tr>`;
    } finally {
        // Nascondi caricamento, mostra tabella
        loading.style.display = 'none';
        tableWrapper.style.display = 'block';
    }
}

// Carica i dati automaticamente all'apertura della pagina
window.onload = fetchLeaderboardData;