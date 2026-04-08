function popolaSelectDaJson(idSelect, datiJson) {
    const select = document.getElementById(idSelect);
    if (!select) {
        console.warn(`[UI] Elemento select '${idSelect}' non trovato nel DOM.`);
        return;
    }
    
    select.innerHTML = "";
    
    if (!Array.isArray(datiJson) || datiJson.length === 0) {
        console.debug(`[UI] Nessun dato fornito per popolare la select '${idSelect}'.`);
        return;
    }

    console.debug(`[UI] Popolamento select '${idSelect}' con ${datiJson.length} elementi.`);
    for (const elemento of datiJson) {
        const opzione = document.createElement("option");
        // Legge le chiavi formattate dal Cuoco
        opzione.value = elemento.valore || Object.values(elemento)[0];
        opzione.innerText = elemento.testo || Object.values(elemento)[0];
        select.appendChild(opzione);
    }
}

function aggiornaInterfacciaSchede(bottoneCliccato, idScheda) {
    console.debug(`[UI] Aggiornamento schede: attivazione vista '${idScheda}'.`);
    const bottoni = document.querySelectorAll('.tab-link');
    bottoni.forEach(btn => btn.classList.remove('w3-blue'));
    if (bottoneCliccato) bottoneCliccato.classList.add('w3-blue');

    const contenuti = document.querySelectorAll('.tab-content');
    contenuti.forEach(contenuto => contenuto.style.display = 'none');

    const schedaTarget = document.getElementById(idScheda);
    if (schedaTarget) {
        schedaTarget.style.display = 'block';
    } else {
        console.warn(`[UI] Scheda target '${idScheda}' non trovata nel DOM.`);
    }
}

function mostraContenitoreDati(idScheda, sessioneEsiste) {
    const suffisso = idScheda.replace('scheda-', '');
    const contenitore = document.getElementById(`contenitore-dati-${suffisso}`);
    const avviso = document.getElementById(`avviso-assenza-${suffisso}`);

    console.debug(`[UI] Gestione visibilità dati per '${suffisso}': Sessione ${sessioneEsiste ? 'Presente' : 'Assente'}.`);

    if (sessioneEsiste) {
        if (contenitore) contenitore.style.display = 'block';
        if (avviso) avviso.style.display = 'none';
    } else {
        if (contenitore) contenitore.style.display = 'none';
        if (avviso) avviso.style.display = 'block';
    }
}

function popolaStringaMeteo(stringaMeteo, datiMeteo) {
    console.groupCollapsed("[DATA] Elaborazione Dati Meteo");
    
    if (!stringaMeteo || !Array.isArray(datiMeteo) || datiMeteo.length === 0) {
        console.warn("[DATA] Dati meteo mancanti o non validi, formattazione annullata.");
        console.groupEnd();
        return;
    }

    const n = datiMeteo.length;
    console.log(`Analisi di ${n} record meteo.`);

    // Funzione interna per calcolare Min, Media, Max
    const getStats = (key) => {
        const vals = datiMeteo.map(d => d[key]);
        const min = Math.min(...vals).toFixed(1);
        const max = Math.max(...vals).toFixed(1);
        const avg = (vals.reduce((a, b) => a + b, 0) / n).toFixed(1);
        return `min: ${min}, med: ${avg}, max: ${max}`;
    };

    // Calcolo la presenza o meno di pioggia durante la sessione (calcolo il max)
    let sessioneBagnata = Math.max(...datiMeteo.map(d => d.rainfall)).toFixed(1);
    if (sessioneBagnata > 0) {
        sessioneBagnata = "Sessione con pioggia";
    } else {
        sessioneBagnata = "Sessione senza pioggia";
    }

    // Calcolo della sola media per la direzione del vento
    const windDirAvg = (datiMeteo.reduce((a, b) => a + b.wind_direction, 0) / n).toFixed(0);

    console.debug(`Condizioni rilevate: ${sessioneBagnata}, Dir. Vento media: ${windDirAvg}°`);

    // Costruzione della stringa testuale
    const rigaMeteo = [
        `<strong>Aria:</strong> ${getStats('air_temperature')}°C`,
        `<strong>Pista:</strong> ${getStats('track_temperature')}°C`,
        `<strong>Umidità:</strong> ${getStats('humidity')}%`,
        `<strong>Pressione:</strong> ${getStats('pressure')} hPa`,
        `<strong>${sessioneBagnata}</strong>`,
        `<strong>Vento:</strong> ${getStats('wind_speed')} m/s`,
        `<strong>Dir. Vento (Med):</strong> ${windDirAvg}°`
    ].join(' | ');

    // Output in una riga W3.CSS
    stringaMeteo.innerHTML = rigaMeteo;
    console.log("[UI] Stringa meteo iniettata nel DOM.");
    console.groupEnd();
}

function popolaTabellaDaJson(idTabella, datiJson) {
    console.groupCollapsed(`[UI] Creazione Tabella Dinamica: ${idTabella}`);
    const tabella = document.getElementById(idTabella);
    
    if (!tabella) {
        console.warn(`[UI] Elemento tabella '${idTabella}' non trovato.`);
        console.groupEnd();
        return;
    }
    
    if (!Array.isArray(datiJson) || datiJson.length === 0) {
        console.debug("[DATA] Nessun dato fornito, mostro avviso tabella vuota.");
        tabella.innerHTML = "<tr><td class='w3-center w3-padding-16'>Nessun dato disponibile.</td></tr>";
        console.groupEnd();
        return;
    }

    tabella.innerHTML = "";
    const intestazione = document.createElement("thead");
    const corpo = document.createElement("tbody");
    const chiaviColonne = Object.keys(datiJson[0]);

    console.log(`Generazione di ${datiJson.length} righe su ${chiaviColonne.length} colonne (${chiaviColonne.join(', ')}).`);

    const rigaIntestazione = document.createElement("tr");
    rigaIntestazione.className = "w3-dark-grey";
    for (const chiave of chiaviColonne) {
        const cellaIntestazione = document.createElement("th");
        cellaIntestazione.innerHTML = chiave; 
        cellaIntestazione.className = "w3-center";
        rigaIntestazione.appendChild(cellaIntestazione);
    }
    intestazione.appendChild(rigaIntestazione);

    for (const elemento of datiJson) {
        const riga = document.createElement("tr");
        riga.className = "w3-hover-light-grey";

        for (const chiave of chiaviColonne) {
            const cellaDato = document.createElement("td");
            let valore = elemento[chiave];
            
            if (valore === null || valore === undefined) {
                valore = "-";
            } else if (typeof valore === "object") {
                valore = JSON.stringify(valore); 
            }

            cellaDato.innerHTML = valore; // Modifica fondamentale per interpretare l'HTML!
            cellaDato.className = "w3-center";
            if (chiave === "Pilota") cellaDato.style.textAlign = "left"; // Allinea a sx il nome pilota
            riga.appendChild(cellaDato);
        }
        corpo.appendChild(riga);
    }

    tabella.appendChild(intestazione);
    tabella.appendChild(corpo);
    console.log("[UI] Tabella generata e agganciata al DOM.");
    console.groupEnd();
}

/**
 * Crea dinamicamente un grafico lineare (o a gradini) dentro un contenitore specificato.
 * Utilizza la libreria Chart.js.
 */
function disegnaGraficoLineare(idContenitore, config) {
    console.groupCollapsed(`[CHART] Grafico Lineare: ${config.titolo || 'Senza Titolo'}`);
    const contenitore = document.getElementById(idContenitore);
    if (!contenitore) {
        console.error(`[CHART] Contenitore grafico '${idContenitore}' non trovato.`);
        console.groupEnd();
        return;
    }

    console.debug(`Punti dati: ${config.datiY ? config.datiY.length : 0}, Tipo: ${config.isStep ? 'A gradini' : 'Curvo'}`);

    // Crea l'elemento canvas dinamicamente
    const canvas = document.createElement('canvas');
    canvas.style.height = '200px'; 
    canvas.style.maxHeight = '200px';
    canvas.style.marginBottom = '20px'; // Spazio tra un grafico e l'altro
    contenitore.appendChild(canvas);

    // Inizializza Chart.js sul nuovo canvas
    new Chart(canvas, {
        type: 'line',
        data: {
            labels: config.etichetteX,
            datasets: [{
                label: config.titolo,
                data: config.datiY,
                borderColor: config.colore,
                backgroundColor: config.colore + "33", // Aggiunge trasparenza al colore (hex 33)
                fill: true,
                tension: config.isStep ? 0 : 0.3, // 0 per pioggia (step), 0.3 per curve morbide (temperature)
                stepped: config.isStep,
                pointRadius: 2,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: config.titolo, align: 'start', color: config.colore, font: { size: 16 } }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#666', font: { size: 10 } }
                },
                y: {
                    beginAtZero: false, // Per le temperature è meglio non partire da 0
                    title: { display: true, text: config.titolo, color: config.colore },
                    ticks: { color: '#666' }
                }
            }
        }
    });
    console.log("[CHART] Rendering completato.");
    console.groupEnd();
}

/**
 * Disegna un grafico lineare con sfondi colorati in base allo stato della pista.
 */
function disegnaGraficoConStatoPista(idContenitore, config) {
    console.groupCollapsed(`[CHART] Grafico + Stato Pista: ${config.titolo || 'Senza Titolo'}`);
    const contenitore = document.getElementById(idContenitore);
    if (!contenitore) {
        console.warn(`[CHART] Contenitore '${idContenitore}' non trovato.`);
        console.groupEnd();
        return;
    }
    
    console.debug(`Punti dati: ${config.datiY ? config.datiY.length : 0}, Zone Sfondo: ${config.zoneSfondo ? config.zoneSfondo.length : 0}`);
    contenitore.innerHTML = ""; // Pulisce il canvas precedente

    const canvas = document.createElement('canvas');
    canvas.style.height = '300px'; 
    canvas.style.maxHeight = '300px';
    contenitore.appendChild(canvas);

    // 💡 PLUGIN CUSTOM: Disegna rettangoli di sfondo per Bandiere Gialle/Rosse/SC
    const pluginSfondoPista = {
        id: 'sfondoStatoPista',
        beforeDraw: (chart) => {
            if (!config.zoneSfondo || config.zoneSfondo.length === 0) return;
            const ctx = chart.canvas.getContext('2d');
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y;

            config.zoneSfondo.forEach(zona => {
                // Calcola le coordinate X in base al numero di giro
                const startX = xAxis.getPixelForValue(zona.daGiro - 1);
                const endX = xAxis.getPixelForValue(zona.aGiro - 1);
                
                ctx.save();
                ctx.fillStyle = zona.colore;
                ctx.fillRect(startX, yAxis.top, endX - startX, yAxis.bottom - yAxis.top);
                ctx.restore();
            });
        }
    };

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: config.etichetteX,
            datasets: [{
                label: config.titolo,
                data: config.datiY,
                borderColor: config.colore,
                backgroundColor: config.colore,
                tension: 0.2,
                pointRadius: 4,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                title: { display: true, text: config.titolo, color: config.colore }
            }
        },
        plugins: [pluginSfondoPista] // <--- Attiviamo il nostro plugin!
    });
    console.log("[CHART] Rendering completato.");
    console.groupEnd();
}

/**
 * Disegna un grafico lineare con DUE dataset sovrapposti (Confronto Piloti).
 */
function disegnaGraficoDoppioConStatoPista(idContenitore, configA, configB, zoneSfondo) {
    console.groupCollapsed(`[CHART] Grafico Doppio Confronto: ${configA?.titolo || 'A'} vs ${configB?.titolo || 'B'}`);
    const contenitore = document.getElementById(idContenitore);
    if (!contenitore || !configA || !configB) {
        console.warn("[CHART] Requisiti mancanti per generare il grafico doppio (Contenitore o Configurazioni).");
        console.groupEnd();
        return;
    }
    
    console.debug(`Dataset A: ${configA.datiY.length} punti, Dataset B: ${configB.datiY.length} punti, Zone Sfondo: ${zoneSfondo ? zoneSfondo.length : 0}`);
    contenitore.innerHTML = ""; 

    const canvas = document.createElement('canvas');
    canvas.style.height = '350px'; 
    canvas.style.maxHeight = '350px';
    contenitore.appendChild(canvas);

    const pluginSfondo = {
        id: 'sfondoStatoPistaDoppio',
        beforeDraw: (chart) => {
            if (!zoneSfondo || zoneSfondo.length === 0) return;
            const ctx = chart.canvas.getContext('2d');
            const xAxis = chart.scales.x;
            const yAxis = chart.scales.y;
            zoneSfondo.forEach(zona => {
                const startX = xAxis.getPixelForValue(zona.daGiro - 1);
                const endX = xAxis.getPixelForValue(zona.aGiro - 1);
                ctx.save();
                ctx.fillStyle = zona.colore;
                ctx.fillRect(startX, yAxis.top, endX - startX, yAxis.bottom - yAxis.top);
                ctx.restore();
            });
        }
    };

    // Usiamo le etichette dell'asse X del pilota che ha fatto più giri
    const labels = configA.etichetteX.length > configB.etichetteX.length ? configA.etichetteX : configB.etichetteX;

    new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: configA.titolo,
                    data: configA.datiY,
                    borderColor: configA.colore,
                    backgroundColor: configA.colore,
                    tension: 0.2, pointRadius: 3, borderWidth: 3
                },
                {
                    label: configB.titolo,
                    data: configB.datiY,
                    borderColor: configB.colore,
                    backgroundColor: configB.colore,
                    borderDash: [5, 5], // Linea tratteggiata per distinguerli
                    tension: 0.2, pointRadius: 3, borderWidth: 3
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } }
        },
        plugins: [pluginSfondo]
    });
    console.log("[CHART] Rendering completato.");
    console.groupEnd();
}

/**
 * Disegna un grafico a coordinate spaziali X-Y (Scatter connesso).
 * Permette l'allineamento per Kilometri percorsi.
 */
function disegnaGraficoSpaziale(idContenitore, configA, configB) {
    console.groupCollapsed(`[CHART] Grafico Spaziale X-Y: ${configA?.titolo || 'A'} vs ${configB?.titolo || 'B'}`);
    const contenitore = document.getElementById(idContenitore);
    if (!contenitore || !configA || !configB) {
        console.warn("[CHART] Requisiti mancanti per generare il grafico spaziale.");
        console.groupEnd();
        return;
    }
    
    console.debug(`Dataset A: ${configA.datiXY.length} coordinate, Dataset B: ${configB.datiXY.length} coordinate.`);
    contenitore.innerHTML = ""; 

    const canvas = document.createElement('canvas');
    canvas.style.height = '100%';
    contenitore.appendChild(canvas);

    new Chart(canvas, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: configA.titolo,
                    data: configA.datiXY,
                    borderColor: configA.colore,
                    backgroundColor: 'transparent',
                    showLine: true, pointRadius: 0, borderWidth: 2, tension: 0.1
                },
                {
                    label: configB.titolo,
                    data: configB.datiXY,
                    borderColor: configB.colore,
                    backgroundColor: 'transparent',
                    showLine: true, pointRadius: 0, borderWidth: 2, tension: 0.1, borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { 
                    type: 'linear', 
                    title: { display: true, text: 'Distanza Percorsa (km)' },
                    ticks: { callback: function(value) { return value + ' km'; } }
                }
            },
            plugins: { legend: { display: true, position: 'top' } }
        }
    });
    console.log("[CHART] Rendering completato.");
    console.groupEnd();
}