// js/graph.js

function popolaSelectDaJson(idSelect, datiJson) {
    const select = document.getElementById(idSelect);
    if (!select) return;
    
    select.innerHTML = "";
    
    if (!Array.isArray(datiJson) || datiJson.length === 0) return;

    for (const elemento of datiJson) {
        const opzione = document.createElement("option");
        // Legge le chiavi formattate dal Cuoco
        opzione.value = elemento.valore || Object.values(elemento)[0];
        opzione.innerText = elemento.testo || Object.values(elemento)[0];
        select.appendChild(opzione);
    }
}

function aggiornaInterfacciaSchede(bottoneCliccato, idScheda) {
    const bottoni = document.querySelectorAll('.tab-link');
    bottoni.forEach(btn => btn.classList.remove('w3-blue'));
    if (bottoneCliccato) bottoneCliccato.classList.add('w3-blue');

    const contenuti = document.querySelectorAll('.tab-content');
    contenuti.forEach(contenuto => contenuto.style.display = 'none');

    const schedaTarget = document.getElementById(idScheda);
    if (schedaTarget) schedaTarget.style.display = 'block';
}

function mostraContenitoreDati(idScheda, sessioneEsiste) {
    const suffisso = idScheda.replace('scheda-', '');
    const contenitore = document.getElementById(`contenitore-dati-${suffisso}`);
    const avviso = document.getElementById(`avviso-assenza-${suffisso}`);

    if (sessioneEsiste) {
        if (contenitore) contenitore.style.display = 'block';
        if (avviso) avviso.style.display = 'none';
    } else {
        if (contenitore) contenitore.style.display = 'none';
        if (avviso) avviso.style.display = 'block';
    }
}

function popolaTabellaDaJson(idTabella, datiJson) {
    const tabella = document.getElementById(idTabella);
    if (!tabella) return;
    
    if (!Array.isArray(datiJson) || datiJson.length === 0) {
        tabella.innerHTML = "<tr><td class='w3-center w3-padding-16'>Nessun dato disponibile.</td></tr>";
        return;
    }

    tabella.innerHTML = "";
    const intestazione = document.createElement("thead");
    const corpo = document.createElement("tbody");
    const chiaviColonne = Object.keys(datiJson[0]);

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
}

/**
 * Crea dinamicamente un grafico lineare (o a gradini) dentro un contenitore specificato.
 * Utilizza la libreria Chart.js.
 * @param {string} idContenitore - L'ID del <div> che ospiterà il grafico.
 * @param {Object} config - Oggetto con i dati del grafico (titolo, etichetteX, datiY, colore, isStep).
 */
function disegnaGraficoLineare(idContenitore, config) {
    const contenitore = document.getElementById(idContenitore);
    if (!contenitore) {
        console.error(`Contenitore grafico ${idContenitore} non trovato.`);
        return;
    }

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
}

/**
 * Disegna un grafico lineare con sfondi colorati in base allo stato della pista.
 */
function disegnaGraficoConStatoPista(idContenitore, config) {
    const contenitore = document.getElementById(idContenitore);
    if (!contenitore) return;
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
}

/**
 * Disegna un grafico lineare con DUE dataset sovrapposti (Confronto Piloti).
 */
function disegnaGraficoDoppioConStatoPista(idContenitore, configA, configB, zoneSfondo) {
    const contenitore = document.getElementById(idContenitore);
    if (!contenitore || !configA || !configB) return;
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
}

/**
 * Disegna un grafico a coordinate spaziali X-Y (Scatter connesso).
 * Permette l'allineamento per Kilometri percorsi.
 */
function disegnaGraficoSpaziale(idContenitore, configA, configB) {
    const contenitore = document.getElementById(idContenitore);
    if (!contenitore || !configA || !configB) return;
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
}