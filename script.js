// ==========================================
// 1. LOGICA LEADERBOARD (OPENF1 API REAL DATA)
// ==========================================

function renderLeaderboardFromData(data) {
    const tbody = document.getElementById('timing-body');
    tbody.innerHTML = '';

    data.forEach(d => {
        const tr = document.createElement('tr');
        tr.className = `team-${d.team}`;
        
        tr.innerHTML = `
            <td>${d.pos}</td>
            <td class="driver-name">${d.name} (${d.id})</td>
            <td>${d.gapLeader}</td>
            <td>${d.gapPrev}</td>
            <td><span class="tyre ${d.tyre}">${d.tyre}</span></td>
            <td class="time-${d.s1Status === 'purple' && d.s2Status === 'purple' ? 'purple' : 'yellow'}">${d.lastLap}</td>
            <td>${d.bestLap}</td>
            <td class="time-${d.s1Status}">${d.s1}</td>
            <td class="time-${d.s2Status}">${d.s2}</td>
            <td class="time-${d.s3Status}">${d.s3}</td>
        `;
        tbody.appendChild(tr);
    });
}

async function fetchRealData() {
    try {
        const tbody = document.getElementById('timing-body');
        if (tbody.innerHTML === '') tbody.innerHTML = '<tr><td colspan="10">Caricamento dati live da OpenF1...</td></tr>';

        // 1. Otteniamo l'ultima sessione disponibile
        const sessionResponse = await fetch('https://api.openf1.org/v1/sessions?latest=true');
        const sessionData = await sessionResponse.json();
        const sessionKey = sessionData[0].session_key;

        // 2. Otteniamo i piloti di questa specifica sessione
        const driversResponse = await fetch(`https://api.openf1.org/v1/drivers?session_key=${sessionKey}`);
        const driversData = await driversResponse.json();

        // 3. Otteniamo lo storico delle posizioni
        const positionResponse = await fetch(`https://api.openf1.org/v1/position?session_key=${sessionKey}`);
        const positionData = await positionResponse.json();

        // 4. Estrapoliamo solo l'ULTIMA posizione nota per ogni pilota
        const latestPositions = {};
        positionData.forEach(p => {
            latestPositions[p.driver_number] = p.position; 
        });

        // 5. Uniamo i dati
        let liveDrivers = driversData
            .filter(driver => latestPositions[driver.driver_number] !== undefined)
            .map(driver => {
                const pos = latestPositions[driver.driver_number];
                
                let teamClass = 'MER'; // Default
                const teamName = driver.team_name ? driver.team_name.toLowerCase() : '';
                if (teamName.includes('red bull')) teamClass = 'RBR';
                else if (teamName.includes('ferrari')) teamClass = 'FER';
                else if (teamName.includes('mclaren')) teamClass = 'MCL';

                return {
                    pos: pos,
                    id: driver.name_acronym,
                    name: driver.last_name.toUpperCase(),
                    team: teamClass,
                    gapLeader: 'API...', 
                    gapPrev: 'API...', 
                    tyre: 'M', 
                    lastLap: '-', 
                    bestLap: '-', 
                    s1: '-', s1Status: 'yellow', 
                    s2: '-', s2Status: 'yellow', 
                    s3: '-', s3Status: 'yellow'
                };
        });

        // 6. Ordiniamo la classifica
        liveDrivers.sort((a, b) => a.pos - b.pos);

        // 7. Stampiamo a schermo
        renderLeaderboardFromData(liveDrivers);

    } catch (error) {
        console.error("Errore nel recupero dei dati:", error);
        document.getElementById('timing-body').innerHTML = '<tr><td colspan="10" style="color:red; text-align:center;">Errore di connessione API OpenF1</td></tr>';
    }
}

// Avvia il caricamento dei dati della classifica
fetchRealData();


// ==========================================
// 2. LOGICA GRAFICI TELEMETRIA (CHART.JS)
// ==========================================

Chart.defaults.color = '#aaaaaa';
Chart.defaults.borderColor = '#333333';

const trackDistance = Array.from({length: 100}, (_, i) => i * 50);
const colors = { P1: '#3671C6', P2: '#E8002D' };

// Dati simulati come placeholder
const speedP1 = trackDistance.map(x => 150 + Math.sin(x/300)*150 + Math.random()*10);
const speedP2 = trackDistance.map((x, i) => speedP1[i] * 0.98 + Math.random()*5);

// GRAFICO 1: Velocità
const ctxSpeed = document.getElementById('speedChart').getContext('2d');
new Chart(ctxSpeed, {
    type: 'line',
    data: {
        labels: trackDistance,
        datasets: [
            { label: 'Pilota 1 - Velocità', data: speedP1, borderColor: colors.P1, borderWidth: 2, pointRadius: 0, tension: 0.2 },
            { label: 'Pilota 2 - Velocità', data: speedP2, borderColor: colors.P2, borderWidth: 2, pointRadius: 0, tension: 0.2 }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Velocità vs Spazio Percorso' } },
        scales: { 
            x: { title: { display: true, text: 'Distanza (m)' } },
            y: { title: { display: true, text: 'km/h' }, min: 0, max: 350 }
        }
    }
});

// GRAFICO 2: Acceleratore e Freno
const throttleP1 = speedP1.map(s => s > 200 ? 100 : (s/200)*100);
const brakeP1 = speedP1.map((s, i, arr) => (i < arr.length-1 && arr[i+1] < s - 10) ? -100 : 0);

const ctxInputs = document.getElementById('throttleBrakeChart').getContext('2d');
new Chart(ctxInputs, {
    type: 'line',
    data: {
        labels: trackDistance,
        datasets: [
            { label: 'P1 - Throttle (%)', data: throttleP1, borderColor: '#00ff00', borderWidth: 1, pointRadius: 0, fill: true, backgroundColor: 'rgba(0,255,0,0.1)' },
            { label: 'P1 - Brake (On/Off)', data: brakeP1, borderColor: '#ff0000', borderWidth: 1, pointRadius: 0, fill: true, backgroundColor: 'rgba(255,0,0,0.2)' }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Input Pilota (Acceleratore vs Freno)' } },
        scales: { 
            y: { min: -100, max: 100, ticks: { callback: value => Math.abs(value) + '%' } }
        }
    }
});

// GRAFICO 3: Marce
const gearP1 = speedP1.map(s => Math.max(1, Math.min(8, Math.floor(s / 40) + 1)));

const ctxGear = document.getElementById('gearRpmChart').getContext('2d');
new Chart(ctxGear, {
    type: 'line',
    data: {
        labels: trackDistance,
        datasets: [
            { label: 'P1 - Marcia', data: gearP1, borderColor: colors.P1, borderWidth: 2, pointRadius: 0, stepped: true }
        ]
    },
    options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { title: { display: true, text: 'Marce Inserite' } },
        scales: { 
            y: { min: 0, max: 9, ticks: { stepSize: 1 } }
        }
    }
});
