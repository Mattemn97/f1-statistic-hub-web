// js/elaborazione_dati.js

function generaAnniSupportati() {
    const annoCorrente = new Date().getFullYear();
    const anni = [];
    for (let y = annoCorrente; y >= 2023; y--) {
        anni.push({ testo: y.toString(), valore: y });
    }
    return anni;
}

function formattaGranPremiPerSelect(datiCrudi) {
    if (!datiCrudi || datiCrudi.length === 0) return [];
    const granPremiUnici = new Map();
    datiCrudi.forEach(gp => {
        if (!granPremiUnici.has(gp.meeting_key)) {
            granPremiUnici.set(gp.meeting_key, { testo: gp.meeting_name, valore: gp.meeting_key });
        }
    });
    return Array.from(granPremiUnici.values());
}

function elaboraSessioniDisponibili(datiCrudi) {
    const dizionarioSessioni = {};
    if (!datiCrudi || datiCrudi.length === 0) return dizionarioSessioni;
    datiCrudi.forEach(sessione => {
        dizionarioSessioni[sessione.session_name] = sessione.session_key;
    });
    return dizionarioSessioni;
}

/**
 * Crea una timeline visiva (a barre) delle strategie gomme per ogni pilota.
 * Calcola statistiche avanzate per ogni stint mostrandole in un popup (tooltip).
 */
function elaboraStrategieGomme(pilotiCrudi, giriCrudi, stintCrudi) {
    if (!giriCrudi || giriCrudi.length === 0 || !stintCrudi || stintCrudi.length === 0) return [];

    let statsPiloti = {};
    let maxGiriGara = 0;

    // 1. Setup base e ricerca del giro massimo (per calcolare le percentuali della barra)
    pilotiCrudi.forEach(p => {
        statsPiloti[p.driver_number] = {
            numero: p.driver_number,
            nome: p.broadcast_name,
            team: p.team_name,
            colore_team: p.team_colour,
            foto: p.headshot_url,
            giri_fatti: 0,
            tempo_totale: 0,
            stints: stintCrudi.filter(s => s.driver_number === p.driver_number).sort((a,b) => a.stint_number - b.stint_number)
        };
    });

    giriCrudi.forEach(giro => {
        let p = statsPiloti[giro.driver_number];
        if (!p || !giro.lap_duration) return;
        p.giri_fatti++;
        p.tempo_totale += giro.lap_duration;
        if (p.giri_fatti > maxGiriGara) maxGiriGara = p.giri_fatti;
    });

    // 2. Ordinamento in stile gara (chi ha fatto più giri, a parità chi ci ha messo meno)
    let classifica = Object.values(statsPiloti).filter(p => p.giri_fatti > 0);
    classifica.sort((a, b) => {
        if (b.giri_fatti !== a.giri_fatti) return b.giri_fatti - a.giri_fatti;
        return a.tempo_totale - b.tempo_totale;
    });

    // 3. Costruzione Tabella Procedurale
    return classifica.map((p, index) => {
        const coloreBordo = p.colore_team ? `#${p.colore_team}` : '#ccc';
        const imgHtml = p.foto ? `<img src="${p.foto}" style="width:30px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : ' ';

        // Costruzione della barra della timeline
        let timelineHtml = `<div style="display:flex; width:100%; height:32px; background-color:#eaeaea; border-radius:4px; overflow:hidden;">`;

        p.stints.forEach(stint => {
            // Estrai i giri fatti dal pilota IN QUESTO STINT
            let giriNelloStint = giriCrudi.filter(g => g.driver_number === p.numero && g.lap_number >= stint.lap_start && g.lap_number <= (stint.lap_end || p.giri_fatti) && g.lap_duration);
            let durateGiri = giriNelloStint.map(g => g.lap_duration);

            let numeroGiriEffettivi = durateGiri.length;
            if (numeroGiriEffettivi === 0) return; // Ignora stint vuoti o senza tempi validi

            // Matematica dello stint
            let migliorGiro = Math.min(...durateGiri);
            
            // Per calcolare il passo reale e la costanza, escludiamo i giri palesemente lenti (Out-lap, traffico, VSC)
            // Consideriamo validi solo i giri che sono entro il 107% del miglior giro di quello stint
            let durateGiriPuliti = durateGiri.filter(t => t <= migliorGiro * 1.07);
            let numeroGiriPuliti = durateGiriPuliti.length > 0 ? durateGiriPuliti.length : 1;

            let media = durateGiriPuliti.reduce((a,b) => a+b, 0) / numeroGiriPuliti;
            
            // Usiamo la Deviazione Standard (dai giri puliti) per misurare la costanza
            let costanza = calcolaDeviazioneStandard(durateGiriPuliti);
            
            let etaInizialeGomma = stint.tyre_age_at_start || 0;
            let infoGomma = ottieniInfoGomma(stint.compound);

            // Calcolo larghezza percentuale della barra rispetto all'intera gara
            let percentualeLarghezza = (numeroGiriEffettivi / maxGiriGara) * 100;

            // Testo del Popup (Tooltip Nativo) usando &#10; per andare a capo nel title
            let tooltipText = `Mescola: ${stint.compound} (Stint ${stint.stint_number})&#10;`;
            tooltipText += `Giri completati: ${numeroGiriEffettivi}&#10;`;
            tooltipText += `Età gomma a inizio stint: ${etaInizialeGomma} giri&#10;`;
            tooltipText += `Miglior giro: ${formattaTempo(migliorGiro)}&#10;`;
            tooltipText += `Passo Medio: ${formattaTempo(media)}&#10;`;
             tooltipText += `Costanza (Dev. Standard): ±${costanza ? costanza.toFixed(3) : "0.000"}s;`;

            // Aggiungiamo il blocco (la barra) al contenitore flex
            timelineHtml += `
                <div class="w3-tooltip" title="${tooltipText}" 
                     style="width:${percentualeLarghezza}%; background-color:${infoGomma.coloreBase}; color:${infoGomma.coloreTesto}; 
                            display:flex; align-items:center; justify-content:center; border-right:2px solid #333; cursor:pointer; font-size:12px; font-weight:bold;">
                    ${infoGomma.lettera}
                </div>`;
        });

        timelineHtml += '</div>'; // Chiudi il contenitore flex

        return {
            "Pos.": `<b>${index + 1}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px; min-width: 180px;">${imgHtml}<div><b>${p.nome}</b><br><span class="w3-tiny w3-text-grey">#${p.numero}</span></div></div>`,
            "Timeline Stint (Passa il mouse sopra per i dati)": timelineHtml
        };
    });
}

/**
 * Elabora i dati meteo crudi, campionandoli nel tempo e preparandoli
 * per il generatore procedurale di grafici in graph.js.
 * @returns {Array<Object>} Un array di configurazioni pronte per essere disegnate.
 */
function elaboraDatiMeteoPerGrafici(datiCrudi) {
    if (!datiCrudi || datiCrudi.length === 0) return [];

    // Campionamento: l'API dà dati ogni minuto, prendiamo un dato ogni 5 minuti per pulizia grafica
    const campionamento = 5; 
    let datiCamp = datiCrudi.filter((_, index) => index % campionamento === 0);
    
    // Generazione dell'asse X (Orario es. 15:00:00)
    const labelsOrario = datiCamp.map(d => new Date(d.date).toISOString().slice(11, 19));

    // Restituiamo un array dove ogni oggetto è il "pacchetto" per un singolo grafico
    return [
        {
            titolo: 'Temperatura Aria (°C)', colore: '#ff9f40', isStep: false,
            etichetteX: labelsOrario, datiY: datiCamp.map(d => d.air_temperature)
        },
        {
            titolo: 'Temperatura Asfalto (°C)', colore: '#ff6384', isStep: false,
            etichetteX: labelsOrario, datiY: datiCamp.map(d => d.track_temperature)
        },
        {
            titolo: 'Umidità (%)', colore: '#4bc0c0', isStep: false,
            etichetteX: labelsOrario, datiY: datiCamp.map(d => d.humidity)
        },
        {
            titolo: 'Velocità Vento (km/h)', colore: '#9966ff', isStep: false,
            etichetteX: labelsOrario, datiY: datiCamp.map(d => d.wind_speed)
        },
        {
            titolo: 'Probabilità Pioggia', colore: '#36a2eb', isStep: true,
            etichetteX: labelsOrario, datiY: datiCamp.map(d => d.rainfall)
        }
    ];
}

/**
 * Crea le opzioni per la tendina dei Piloti.
 */
function elaboraFiltroPilotiRadio(radioCrudi, pilotiCrudi) {
    if (!radioCrudi || radioCrudi.length === 0) return [];
    const numeriUnici = [...new Set(radioCrudi.map(r => r.driver_number))];
    let opzioni = [{ testo: "Tutti i piloti", valore: "TUTTI" }];
    
    numeriUnici.forEach(num => {
        const p = pilotiCrudi.find(pil => pil.driver_number === num);
        if (p) opzioni.push({ testo: p.broadcast_name, valore: p.driver_number });
    });
    return opzioni.sort((a, b) => a.testo.localeCompare(b.testo));
}

/**
 * Crea le opzioni per la tendina dei Giri (dinamica in base ai radio disponibili).
 */
function elaboraFiltroGiriRadio(radioArricchiti) {
    // Estrae i nomi dei giri ("Giro 1", "Box", ecc.) e rimuove i duplicati
    const giriUnici = [...new Set(radioArricchiti.map(r => r.giro_calcolato))];
    
    let opzioni = [{ testo: "Tutti i giri", valore: "TUTTI" }];
    
    // Ordina logicamente (prima "Box/Out", poi Giro 1, 2, 3...)
    giriUnici.sort((a, b) => {
        if (a.includes("Box") && !b.includes("Box")) return -1;
        if (!a.includes("Box") && b.includes("Box")) return 1;
        let numA = parseInt(a.replace("Giro ", "")) || 0;
        let numB = parseInt(b.replace("Giro ", "")) || 0;
        return numA - numB;
    });

    giriUnici.forEach(g => opzioni.push({ testo: g, valore: g }));
    return opzioni;
}

/**
 * Calcola il giro esatto incrociando i tempi, filtra i dati e genera la tabella.
 */
function elaboraTeamRadio(radioCrudi, pilotiCrudi, giriCrudi, filtroPilota, filtroGiro) {
    if (!radioCrudi || radioCrudi.length === 0) return { datiTabella: [], radioArricchiti: [] };

    // 1. MOTORE DI CALCOLO DEL GIRO: Incrocia l'audio con la telemetria!
    let radioArricchiti = radioCrudi.map(radio => {
        let giro_calcolato = "Box / Out-Lap";
        const timeRadio = new Date(radio.date).getTime();
        
        // Cerca i giri di QUESTO specifico pilota
        const giriPilota = giriCrudi.filter(g => g.driver_number === radio.driver_number);
        
        for (let g of giriPilota) {
            if (g.date_start) {
                const inizioGiro = new Date(g.date_start).getTime();
                // Se non c'è durata (es. giro abortito), diamo un cuscinetto di 120 secondi
                const fineGiro = inizioGiro + ((g.lap_duration || 120) * 1000); 
                
                if (timeRadio >= inizioGiro && timeRadio <= fineGiro) {
                    giro_calcolato = `Giro ${g.lap_number}`;
                    break;
                }
            }
        }
        return { ...radio, giro_calcolato };
    });

    // 2. APPLICA I FILTRI
    let radioFiltrati = radioArricchiti;
    if (filtroPilota !== "TUTTI") {
        radioFiltrati = radioFiltrati.filter(r => r.driver_number == filtroPilota);
    }
    if (filtroGiro !== "TUTTI") {
        radioFiltrati = radioFiltrati.filter(r => r.giro_calcolato === filtroGiro);
    }

    // Ordina cronologicamente
    radioFiltrati.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 3. CREA TABELLA
    const datiTabella = radioFiltrati.map(radio => {
        const p = pilotiCrudi.find(pil => pil.driver_number === radio.driver_number) || {};
        const coloreBordo = p.team_colour ? `#${p.team_colour}` : '#ccc';
        const imgHtml = p.headshot_url ? `<img src="${p.headshot_url}" style="width:35px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';
        const orario = new Date(radio.date).toLocaleTimeString('it-IT');

        return {
            "Giro": `<b class="w3-text-dark-grey">${radio.giro_calcolato}</b><br><span class="w3-tiny w3-text-grey">${orario}</span>`,
            "Canale (Pilota ↔ Team)": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px; min-width: 180px;">${imgHtml}<div><b>${p.broadcast_name || "Sconosciuto"}</b><br><span class="w3-tiny w3-text-grey">${p.team_name || "Team"}</span></div></div>`,
            "Ascolta": `<audio controls preload="none" style="height: 35px; outline: none;">
                            <source src="${radio.recording_url}" type="audio/mpeg">
                        </audio>`
        };
    });

    // Ritorna sia la tabella finita, sia l'array arricchito (ci serve per popolare la tendina dei giri)
    return { datiTabella, radioArricchiti };
}

/**
 * Crea l'HTML per l'Identikit visivo del Pilota nel Riassunto Weekend.
 */
function elaboraIdentikitPilota(numeroPilota, pilotiCrudi) {
    const p = pilotiCrudi.find(pil => pil.driver_number == numeroPilota);
    if (!p) return "<p>Dati pilota non trovati.</p>";

    const coloreTeam = p.team_colour ? `#${p.team_colour}` : "#333";

    return `
        <div class="w3-col s3 m2 w3-center">
            <img src="${p.headshot_url || ''}" alt="${p.broadcast_name}" style="width:100%; max-width:120px; border-radius:50%; border:3px solid ${coloreTeam}; background:#f4f4f4;">
        </div>
        <div class="w3-col s9 m10" style="padding-left: 16px;">
            <h2 style="margin:0; color:${coloreTeam};"><b>${p.full_name || p.broadcast_name}</b> <span class="w3-text-grey">#${p.driver_number}</span></h2>
            <p style="margin:4px 0;"><b>Scuderia:</b> ${p.team_name}</p>
            <p style="margin:4px 0;"><b>Acronimo:</b> ${p.name_acronym}</p>
        </div>
    `;
}

/**
 * Calcola lo stato della pista per un determinato giro incrociando i timestamp.
 */
function calcolaStatoPistaGiro(inizioGiroMs, fineGiroMs, direzioneGara) {
    let stato = "🟢 Normale";
    let coloreSfondo = "transparent";

    if (!direzioneGara) return { stato, coloreSfondo };

    // Filtra i messaggi avvenuti DURANTE questo giro
    const messaggiNelGiro = direzioneGara.filter(m => {
        const timeM = new Date(m.date).getTime();
        return timeM >= inizioGiroMs && timeM <= fineGiroMs;
    });

    for (let m of messaggiNelGiro) {
        const flag = (m.flag || "").toUpperCase();
        if (flag.includes("RED")) {
            return { stato: "🔴 Bandiera Rossa", coloreSfondo: "rgba(255, 0, 0, 0.2)" };
        }
        if (flag.includes("DOUBLE YELLOW") || m.message.toUpperCase().includes("VIRTUAL SAFETY CAR")) {
            return { stato: "🟡🟡 Doppia Gialla / VSC", coloreSfondo: "rgba(255, 165, 0, 0.3)" };
        }
        if (flag.includes("YELLOW") || m.message.toUpperCase().includes("SAFETY CAR")) {
            return { stato: "🟡 Bandiera Gialla / SC", coloreSfondo: "rgba(255, 255, 0, 0.2)" };
        }
    }
    return { stato, coloreSfondo };
}

/**
 * Genera la Matrice Tabellare (Giri x Piloti) e prepara i dati per i Grafici.
 * I piloti sono ordinati per POSIZIONE DI ARRIVO (dal 1º a sinistra, fino all'ultimo/ritirato a destra).
 * Colori: Viola = Miglior giro personale in assoluto | Verde = Miglioramento rispetto al proprio giro precedente.
 */
function elaboraAnalisiPasso(giriCrudi, pilotiCrudi, direzioneGara) {
    if (!giriCrudi || giriCrudi.length === 0) return null;

    // 1. Setup base
    let maxLaps = 0;
    let bestPersonali = {};
    let pilotiValidi = [];
    let statsPiloti = {}; 

    // Trova i record, i tempi totali e i giri completati
    pilotiCrudi.forEach(p => {
        let giriPilota = giriCrudi.filter(g => g.driver_number === p.driver_number && g.lap_duration);
        if (giriPilota.length > 0) {
            pilotiValidi.push(p);
            
            // Trova il Personal Best assoluto (per la colorazione Viola)
            let pb = Math.min(...giriPilota.map(g => g.lap_duration));
            bestPersonali[p.driver_number] = pb;
            
            // Trova i giri massimi per stabilire la lunghezza del loop
            let maxGiroPilota = Math.max(...giriPilota.map(g => g.lap_number));
            if (maxGiroPilota > maxLaps) maxLaps = maxGiroPilota;

            // Salva le statistiche di gara per stabilire l'ordine d'arrivo
            statsPiloti[p.driver_number] = {
                giri_fatti: giriPilota.length,
                tempo_totale: giriPilota.reduce((acc, curr) => acc + curr.lap_duration, 0)
            };
        }
    });

    // 🏆 ORDINA I PILOTI PER POSIZIONE D'ARRIVO (Il vincitore a sinistra, i DNF a destra)
    pilotiValidi.sort((a, b) => {
        let statA = statsPiloti[a.driver_number];
        let statB = statsPiloti[b.driver_number];
        if (statB.giri_fatti !== statA.giri_fatti) return statB.giri_fatti - statA.giri_fatti;
        return statA.tempo_totale - statB.tempo_totale;
    });

    let matriceTabella = [];
    let zoneSfondoGrafico = [];
    
    // Oggetto "memoria" per ricordare l'ultimo tempo fatto segnare da ogni pilota
    let ultimoTempoRegistrato = {}; 

    // 2. Costruzione Riga per Riga (Giro per Giro)
    for (let giroNum = 1; giroNum <= maxLaps; giroNum++) {
        let riga = { "Giro": `<b>${giroNum}</b>` };
        
        // Calcolo stato della pista usando il giro del Leader (il primo dell'array ordinato!)
        let leader = pilotiValidi[0];
        let giroRiferimento = giriCrudi.find(g => g.driver_number === leader.driver_number && g.lap_number === giroNum && g.date_start);
        
        let statoPista = { stato: "🟢 Normale", coloreSfondo: "transparent" };
        
        if (giroRiferimento) {
            let inizioMs = new Date(giroRiferimento.date_start).getTime();
            let fineMs = inizioMs + (giroRiferimento.lap_duration * 1000 || 90000);
            statoPista = calcolaStatoPistaGiro(inizioMs, fineMs, direzioneGara);
        }

        riga["Stato Pista"] = statoPista.stato;

        if (statoPista.coloreSfondo !== "transparent") {
            zoneSfondoGrafico.push({ daGiro: giroNum, aGiro: giroNum + 1, colore: statoPista.coloreSfondo });
        }

        // Aggiungi le colonne per ogni pilota
        pilotiValidi.forEach(p => {
            let numPilota = p.driver_number;
            let acronimo = `<b>${p.name_acronym || numPilota}</b>`;
            let giroPilota = giriCrudi.find(g => g.driver_number === numPilota && g.lap_number === giroNum);
            
            if (giroPilota && giroPilota.lap_duration) {
                let tempoAttuale = giroPilota.lap_duration;
                let tempoFormat = formattaTempo(tempoAttuale);
                
                // LOGICA DI COLORAZIONE AGGIORNATA
                if (tempoAttuale === bestPersonali[numPilota]) {
                    // VIOLA: Miglior giro personale in assoluto
                    riga[acronimo] = `<span style="color:#b92df7; font-weight:bold;">${tempoFormat}</span>`; 
                } else if (ultimoTempoRegistrato[numPilota] && tempoAttuale < ultimoTempoRegistrato[numPilota]) {
                    // VERDE: Ha migliorato il suo tempo rispetto al giro precedente!
                    riga[acronimo] = `<span style="color:#39b54a; font-weight:bold;">${tempoFormat}</span>`; 
                } else {
                    // NESSUN COLORE: Tempo peggiore o uguale al giro precedente
                    riga[acronimo] = tempoFormat;
                }

                // Salva questo tempo in memoria per confrontarlo nel giro successivo
                ultimoTempoRegistrato[numPilota] = tempoAttuale;

            } else {
                riga[acronimo] = `<span class="w3-text-grey">-</span>`;
            }
        });

        matriceTabella.push(riga);
    }

    return { matriceTabella, zoneSfondoGrafico, pilotiValidi };
}

/**
 * Prepara il JSON per Chart.js per un singolo pilota.
 */
function preparaConfigGraficoPasso(numeroPilota, giriCrudi, pilotiCrudi, zoneSfondo) {
    const p = pilotiCrudi.find(pil => pil.driver_number == numeroPilota);
    if (!p) return null;

    let giriPilota = giriCrudi.filter(g => g.driver_number == numeroPilota && g.lap_duration).sort((a,b) => a.lap_number - b.lap_number);
    
    // Per pulizia del grafico escludiamo i giri > 115% del miglior giro personale (evita picchi enormi da SC/Pit)
    let pb = Math.min(...giriPilota.map(g => g.lap_duration));
    giriPilota = giriPilota.filter(g => g.lap_duration <= pb * 1.15);

    return {
        titolo: `Passo Gara: ${p.broadcast_name}`,
        colore: p.team_colour ? `#${p.team_colour}` : '#333',
        etichetteX: giriPilota.map(g => `G ${g.lap_number}`),
        datiY: giriPilota.map(g => g.lap_duration),
        zoneSfondo: zoneSfondo // Passa le aree colorate al plugin!
    };
}

/**
 * Calcola le 8 statistiche avanzate (Mediana, Costanza, Ideale, Degrado, ecc.) 
 * SOLO per il pilota selezionato e genera le Card HTML per la Dashboard.
 */
function calcolaStatisticheAvanzatePilota(numeroPilota, giriCrudi, stintCrudi) {
    let giriPilota = giriCrudi.filter(g => g.driver_number == numeroPilota && g.lap_duration);
    if (giriPilota.length === 0) return "";

    let tempi = giriPilota.map(g => g.lap_duration);
    let best = Math.min(...tempi);
    let totaleGiri = tempi.length;
    
    // Filtri
    let tempiPuliti = tempi.filter(t => t <= best * 1.07);

    // 1. PASSO MEDIANO
    let tempiOrdinati = [...tempiPuliti].sort((a, b) => a - b);
    let meta = Math.floor(tempiOrdinati.length / 2);
    let mediana = tempiOrdinati.length % 2 !== 0 ? tempiOrdinati[meta] : (tempiOrdinati[meta - 1] + tempiOrdinati[meta]) / 2;

    // 2. COSTANZA (Deviazione Standard)
    let mediaPulita = tempiPuliti.reduce((a, b) => a + b, 0) / tempiPuliti.length;
    let varianza = tempiPuliti.map(x => Math.pow(x - mediaPulita, 2)).reduce((a, b) => a + b, 0) / tempiPuliti.length;
    let costanza = Math.sqrt(varianza);

    // 3. GIRO IDEALE (Somma S1+S2+S3)
    let bestS1 = Math.min(...giriPilota.filter(g => g.duration_sector_1).map(g => g.duration_sector_1));
    let bestS2 = Math.min(...giriPilota.filter(g => g.duration_sector_2).map(g => g.duration_sector_2));
    let bestS3 = Math.min(...giriPilota.filter(g => g.duration_sector_3).map(g => g.duration_sector_3));
    let giroIdeale = (bestS1 !== Infinity && bestS2 !== Infinity && bestS3 !== Infinity) ? (bestS1 + bestS2 + bestS3) : null;

    // --- 4. DEGRADO MEDIO (Per singolo Stint) ---
    // Filtriamo gli stint di questo pilota e li ordiniamo
    let stintPilota = stintCrudi ? stintCrudi.filter(s => s.driver_number == numeroPilota).sort((a,b) => a.stint_number - b.stint_number) : [];
    let degradoHtml = "";

    if (stintPilota.length > 0) {
        stintPilota.forEach(stint => {
            let start = stint.lap_start;
            // Se non c'è fine stint (es. ultimo stint della gara), prendiamo l'ultimo giro fatto dal pilota
            let end = stint.lap_end || Math.max(...giriPilota.map(g => g.lap_number)); 
            
            // Isoliamo SOLO i giri puliti (<=107%) appartenenti a QUESTO stint
            let giriStint = giriPilota.filter(g => g.lap_number >= start && g.lap_number <= end && g.lap_duration <= best * 1.07);

            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, n = 0;
            giriStint.forEach(g => {
                let x = g.lap_number;
                let y = g.lap_duration;
                sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; n++;
            });

            // Calcolo Regressione Lineare
            let degrado = n > 1 ? ((n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)) : 0;
            
            // Grafica: otteniamo colori e lettere delle gomme dal tuo utils.js
            let infoGomma = ottieniInfoGomma(stint.compound);
            let segnoDegrado = degrado > 0 ? "+" : "";
            let coloreTesto = degrado > 0.02 ? "#f44336" : (degrado < -0.02 ? "#39b54a" : "#333");

            // Aggiungiamo una piccola riga per ogni stint
            degradoHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px; padding-bottom:2px; border-bottom:1px solid #ddd;">
                    <span style="background-color:${infoGomma.coloreBase}; color:${infoGomma.coloreTesto}; padding:1px 6px; border-radius:3px; font-size:10px; font-weight:bold;">${infoGomma.lettera}</span>
                    <span style="font-size:11px; font-weight:bold; color:${coloreTesto};">${segnoDegrado}${degrado.toFixed(3)} s/g</span>
                </div>
            `;
        });
    } else {
        degradoHtml = "<div class='w3-small w3-text-grey'>Dati stint non disponibili</div>";
    }

    // 5. PACE POTENZIALE (Media Top 5 Laps)
    let tempiAssolutiOrdinati = [...tempi].sort((a, b) => a - b);
    let top5 = tempiAssolutiOrdinati.slice(0, 5);
    let mediaTop5 = top5.reduce((a, b) => a + b, 0) / (top5.length || 1);

   // --- 6. INDICE ARIA PULITA (Metodo Fisico: Gap < 1.5s dall'auto davanti) ---
    let giriAriaPulitaFisica = 0;

    giriPilota.forEach(giro => {
        if (!giro.date_start || !giro.lap_duration) return;

        let tempoInizioGiroMs = new Date(giro.date_start).getTime();
        let autoDavantiVicina = false;

        // Controlliamo tutti i giri di tutti gli ALTRI piloti
        for (let g of giriCrudi) {
            if (g.driver_number === numeroPilota || !g.date_start) continue;
            
            let tempoAltroMs = new Date(g.date_start).getTime();
            let distacco = tempoInizioGiroMs - tempoAltroMs;

            // Se un'altra auto è passata sul traguardo prima di noi (distacco positivo) 
            // e il gap è inferiore a 1.5 secondi (1500 millisecondi)...
            if (distacco > 0 && distacco <= 1500) {
                autoDavantiVicina = true;
                break; // Ne abbiamo trovata una, siamo in aria sporca! Inutile cercare oltre.
            }
        }

        // Il giro è "Pulito" se: 
        // 1. Nessuno era a meno di 1.5s davanti a noi
        // 2. Il giro non è anomalo (escludiamo i pit-stop/SC usando la regola del 107%)
        if (!autoDavantiVicina && giro.lap_duration <= best * 1.07) {
            giriAriaPulitaFisica++;
        }
    });

    let percentualeAriaPulita = Math.round((giriAriaPulitaFisica / totaleGiri) * 100);
    let coloreAria = percentualeAriaPulita >= 60 ? "#39b54a" : (percentualeAriaPulita >= 30 ? "#ff9800" : "#f44336");
    // 7. PIT LOSS STIMATO
    let pitLoss = 0;
    tempi.forEach(t => { if (t > best * 1.07) pitLoss += (t - mediana); });

    // HTML OUTPUT
    return `
        <div class="w3-panel w3-leftbar w3-border-blue w3-light-grey w3-padding" style="flex: 1 1 20%; min-width: 160px; margin-top:0;">
            <div class="w3-tiny w3-text-grey w3-uppercase">Miglior Giro</div>
            <div class="w3-large w3-text-black" style="color:#b92df7 !important; font-weight:bold;">${formattaTempo(best)}</div>
        </div>
        <div class="w3-panel w3-leftbar w3-border-green w3-light-grey w3-padding" style="flex: 1 1 20%; min-width: 160px; margin-top:0;">
            <div class="w3-tiny w3-text-grey w3-uppercase">Passo Mediano</div>
            <div class="w3-large w3-text-black" style="font-weight:bold;">${formattaTempo(mediana)}</div>
        </div>
        <div class="w3-panel w3-leftbar w3-border-orange w3-light-grey w3-padding" style="flex: 1 1 20%; min-width: 160px; margin-top:0;">
            <div class="w3-tiny w3-text-grey w3-uppercase">Costanza</div>
            <div class="w3-large w3-text-black" style="font-weight:bold;">±${costanza.toFixed(3)}s</div>
        </div>
        <div class="w3-panel w3-leftbar w3-border-purple w3-light-grey w3-padding" style="flex: 1 1 20%; min-width: 160px; margin-top:0;">
            <div class="w3-tiny w3-text-grey w3-uppercase">Giro Ideale (S1+S2+S3)</div>
            <div class="w3-large w3-text-black" style="font-weight:bold;">${giroIdeale ? formattaTempo(giroIdeale) : 'N/D'}</div>
        </div>
        <div class="w3-panel w3-leftbar w3-border-dark-grey w3-light-grey w3-padding" style="flex: 1 1 20%; min-width: 160px; margin-top:0;">
            <div class="w3-tiny w3-text-grey w3-uppercase" title="Trend calcolato per ogni stint">Degrado Gomme (Stint)</div>
            <div style="margin-top: 4px; display: flex; flex-direction: column; justify-content: center;">${degradoHtml}</div>
        </div>
        <div class="w3-panel w3-leftbar w3-border-teal w3-light-grey w3-padding" style="flex: 1 1 20%; min-width: 160px; margin-top:0;">
            <div class="w3-tiny w3-text-grey w3-uppercase" title="Media dei migliori 5 giri della sessione">Pace Potenziale (Top 5)</div>
            <div class="w3-large w3-text-black" style="font-weight:bold;">${formattaTempo(mediaTop5)}</div>
        </div>
        <div class="w3-panel w3-leftbar w3-light-grey w3-padding" style="flex: 1 1 20%; min-width: 160px; margin-top:0; border-left-color: ${coloreAria}">
            <div class="w3-tiny w3-text-grey w3-uppercase" title="% di giri effettuati entro il 103% del miglior tempo">Indice Aria Pulita</div>
            <div class="w3-large" style="color:${coloreAria}; font-weight:bold;">${percentualeAriaPulita}%</div>
        </div>
        <div class="w3-panel w3-leftbar w3-border-red w3-light-grey w3-padding" style="flex: 1 1 20%; min-width: 160px; margin-top:0;">
            <div class="w3-tiny w3-text-grey w3-uppercase" title="Tempo perso per Pit Stop, SC o traffico anomalo">Tempo Perso (Pit/SC)</div>
            <div class="w3-large w3-text-black" style="font-weight:bold;">${pitLoss > 0 ? pitLoss.toFixed(1) + 's' : '0.0s'}</div>
        </div>
    `;
}

/**
 * Calcola le statistiche e genera una colonna verticale per il Testa-a-Testa.
 */
function calcolaColonnaVerticalePilota(numeroPilota, giriCrudi, stintCrudi, pilotiCrudi) {
    const p = pilotiCrudi.find(pil => pil.driver_number == numeroPilota);
    if (!p) return "<div class='w3-panel w3-red'>Pilota non trovato</div>";

    let giriPilota = giriCrudi.filter(g => g.driver_number == numeroPilota && g.lap_duration);
    if (giriPilota.length === 0) return `<div class='w3-panel'>Nessun tempo registrato per ${p.broadcast_name}</div>`;

    let tempi = giriPilota.map(g => g.lap_duration);
    let best = Math.min(...tempi);
    let tempiPuliti = tempi.filter(t => t <= best * 1.07);
    
    // Mediana e Costanza
    let tempiOrdinati = [...tempiPuliti].sort((a, b) => a - b);
    let meta = Math.floor(tempiOrdinati.length / 2);
    let mediana = tempiOrdinati.length % 2 !== 0 ? tempiOrdinati[meta] : (tempiOrdinati[meta - 1] + tempiOrdinati[meta]) / 2;
    let mediaPulita = tempiPuliti.reduce((a, b) => a + b, 0) / tempiPuliti.length;
    let costanza = Math.sqrt(tempiPuliti.map(x => Math.pow(x - mediaPulita, 2)).reduce((a, b) => a + b, 0) / tempiPuliti.length);

    // Aria Pulita e Pit Loss (metodo fisico e 107%)
    let totaleGiri = tempi.length;
    let giriAriaPulitaFisica = 0;
    giriPilota.forEach(giro => {
        if (!giro.date_start) return;
        let tMs = new Date(giro.date_start).getTime();
        let ariaSporca = giriCrudi.some(g => g.driver_number !== numeroPilota && g.date_start && (tMs - new Date(g.date_start).getTime()) > 0 && (tMs - new Date(g.date_start).getTime()) <= 1500);
        if (!ariaSporca && giro.lap_duration <= best * 1.07) giriAriaPulitaFisica++;
    });
    let percAria = Math.round((giriAriaPulitaFisica / totaleGiri) * 100);
    let pitLoss = 0;
    tempi.forEach(t => { if (t > best * 1.07) pitLoss += (t - mediana); });

    // Stint e Degrado
    let stintPilota = stintCrudi ? stintCrudi.filter(s => s.driver_number == numeroPilota).sort((a,b) => a.stint_number - b.stint_number) : [];
    let degradoHtml = "";
    stintPilota.forEach(stint => {
        let end = stint.lap_end || Math.max(...giriPilota.map(g => g.lap_number)); 
        let giriStint = giriPilota.filter(g => g.lap_number >= stint.lap_start && g.lap_number <= end && g.lap_duration <= best * 1.07);
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, n = 0;
        giriStint.forEach(g => { sumX += g.lap_number; sumY += g.lap_duration; sumXY += g.lap_number * g.lap_duration; sumX2 += g.lap_number * g.lap_number; n++; });
        let degrado = n > 1 ? ((n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)) : 0;
        let info = ottieniInfoGomma(stint.compound);
        degradoHtml += `<span class="w3-round w3-small" style="background:${info.coloreBase}; color:${info.coloreTesto}; padding:2px 6px; margin-right:4px;">${info.lettera} ${degrado>0?'+':''}${degrado.toFixed(3)}</span>`;
    });

    const coloreTeam = p.team_colour ? `#${p.team_colour}` : '#333';

    // Ritorna la Colonna
    return `
        <div class="w3-card w3-white w3-round w3-margin-bottom">
            <header class="w3-container w3-padding" style="background-color: ${coloreTeam}; color: white; border-radius: 4px 4px 0 0;">
                <h3 style="margin:0;"><b>${p.broadcast_name}</b> <span class="w3-right">#${p.driver_number}</span></h3>
            </header>
            <ul class="w3-ul w3-hoverable">
                <li><span class="w3-text-grey">Miglior Giro:</span> <b class="w3-right w3-text-purple">${formattaTempo(best)}</b></li>
                <li><span class="w3-text-grey">Passo Mediano:</span> <b class="w3-right">${formattaTempo(mediana)}</b></li>
                <li><span class="w3-text-grey">Costanza (Dev. Std):</span> <b class="w3-right">±${costanza.toFixed(3)}s</b></li>
                <li><span class="w3-text-grey">Aria Pulita:</span> <b class="w3-right">${percAria}%</b></li>
                <li><span class="w3-text-grey">Tempo Perso (Pit/SC):</span> <b class="w3-right w3-text-red">${pitLoss.toFixed(1)}s</b></li>
                <li>
                    <span class="w3-text-grey w3-block w3-margin-bottom">Degrado per Stint:</span>
                    <div>${degradoHtml || '-'}</div>
                </li>
            </ul>
        </div>
    `;
}

/**
 * Analizza la telemetria grezza di un singolo giro, calcolando i 9 parametri ingegneristici.
 */
function elaboraTelemetriaGiroConfronto(telemetriaCruda, pilota) {
    if (!telemetriaCruda || telemetriaCruda.length === 0) return null;

    let asseX = [], velocitaY = [], rpmY = [], marciaY = [], gasY = [], frenoY = [];
    
    let topSpeed = 0, minSpeed = Infinity;
    let countFullThrottle = 0, countBraking = 0, countLiftAndCoast = 0;
    let maxDecelG = 0;
    let distanzaPercorsa = 0;
    let gearshifts = 0;
    
    let tractionTimes = [];
    let isTracting = false;
    let tractionStartMs = null;

    let prevTimeMs = null, prevSpeed = null, prevGear = null;
    let totalSamples = telemetriaCruda.length;
    const startTime = new Date(telemetriaCruda[0].date).getTime();

    telemetriaCruda.forEach(t => {
        let timeMs = new Date(t.date).getTime();
        let sec = ((timeMs - startTime) / 1000).toFixed(2);
        asseX.push(sec);

        let speed = t.speed || 0;
        let throttle = t.throttle || 0;
        let brake = t.brake > 0;
        let gear = t.n_gear || 0;
        let rpm = t.rpm || 0;

        velocitaY.push(speed);
        rpmY.push(rpm);
        marciaY.push(gear);
        gasY.push(throttle);
        frenoY.push(brake ? 100 : 0);

        // 1. Estrazione Base
        if (speed > topSpeed) topSpeed = speed;
        if (speed > 40 && speed < minSpeed) minSpeed = speed;
        if (throttle >= 99) countFullThrottle++;
        if (brake) countBraking++;
        if ((throttle === 0 || throttle == null) && !brake && speed > 50) countLiftAndCoast++;

        // 2. Fisica: Distanza e G-Force
        if (prevTimeMs !== null) {
            let dt = (timeMs - prevTimeMs) / 1000; 
            if (dt > 0) {
                distanzaPercorsa += (speed / 3.6) * dt; // Metri
                if (brake) {
                    let dv = (speed - prevSpeed) / 3.6; // m/s
                    let gForce = (dv / dt) / 9.81; // G Longitudinali
                    if (gForce < maxDecelG) maxDecelG = gForce;
                }
            }
        }

        // 3. Frequenza Cambiata
        if (prevGear !== null && gear !== prevGear && gear !== 0 && prevGear !== 0) gearshifts++;

        // 4. Aggressività Trazione
        if (throttle <= 5) {
            isTracting = false;
            tractionStartMs = null;
        } else if (throttle > 5 && throttle < 99 && !isTracting && !brake) {
            isTracting = true;
            tractionStartMs = timeMs;
        } else if (throttle >= 99 && isTracting && tractionStartMs) {
            let tempoTrazione = (timeMs - tractionStartMs) / 1000;
            if (tempoTrazione < 3) tractionTimes.push(tempoTrazione); // Scarta anomalie
            isTracting = false;
            tractionStartMs = null;
        }

        prevTimeMs = timeMs; prevSpeed = speed; prevGear = gear;
    });

    if (minSpeed === Infinity) minSpeed = 0;

    let percFullThrottle = ((countFullThrottle / totalSamples) * 100).toFixed(1);
    let percBraking = ((countBraking / totalSamples) * 100).toFixed(1);
    let percLiftCoast = ((countLiftAndCoast / totalSamples) * 100).toFixed(1);
    let avgTraction = tractionTimes.length > 0 ? (tractionTimes.reduce((a,b)=>a+b,0)/tractionTimes.length).toFixed(2) : "N/D";
    let coloreTeam = pilota.team_colour ? `#${pilota.team_colour}` : "#36a2eb";

    return { 
        coloreTeam, asseX, velocitaY, rpmY, marciaY, gasY, frenoY,
        topSpeed, minSpeed, percFullThrottle, percBraking, percLiftCoast,
        maxDecelG, distanzaPercorsa, gearshifts, avgTraction
    };
}

/**
 * Genera l'HTML per la colonna delle statistiche di uno dei due piloti.
 */
function generaColonnaTelemetria(dati, pInfo) {
    if (!dati) return `<div class="w3-panel w3-red">Dati non disponibili per ${pInfo.broadcast_name}</div>`;
    const colore = pInfo.team_colour ? `#${pInfo.team_colour}` : "#333";
    
    return `
        <div class="w3-card w3-white w3-round w3-margin-bottom">
            <header class="w3-container w3-padding" style="background-color: ${colore}; color: white; border-radius: 4px 4px 0 0;">
                <h3 style="margin:0;"><b>${pInfo.broadcast_name}</b> <span class="w3-right">#${pInfo.driver_number}</span></h3>
            </header>
            <ul class="w3-ul w3-hoverable w3-small">
                <li><span class="w3-text-grey">Top Speed:</span> <b class="w3-right w3-text-black">${dati.topSpeed} km/h</b></li>
                <li><span class="w3-text-grey">Apex Speed:</span> <b class="w3-right w3-text-black">${dati.minSpeed} km/h</b></li>
                <li><span class="w3-text-grey">Full Throttle:</span> <b class="w3-right w3-text-green">${dati.percFullThrottle}%</b></li>
                <li><span class="w3-text-grey">In Frenata:</span> <b class="w3-right w3-text-red">${dati.percBraking}%</b></li>
                <li><span class="w3-text-grey" title="Accelerazione di gravità in frenata">Decelerazione Max:</span> <b class="w3-right w3-text-black">${dati.maxDecelG.toFixed(1)} G</b></li>
                <li><span class="w3-text-grey" title="Efficienza traiettoria">Distanza Percorsa:</span> <b class="w3-right w3-text-black">${dati.distanzaPercorsa.toFixed(0)} m</b></li>
                <li><span class="w3-text-grey">Cambiate:</span> <b class="w3-right w3-text-black">${dati.gearshifts}</b></li>
                <li><span class="w3-text-grey" title="Media dei secondi per passare da 0% a 100% di acceleratore">Tempo Trazione:</span> <b class="w3-right w3-text-black">${dati.avgTraction}s</b></li>
                <li><span class="w3-text-grey">Lift & Coast:</span> <b class="w3-right w3-text-purple">${dati.percLiftCoast}%</b></li>
            </ul>
        </div>
    `;
}

/**
 * Analizza la telemetria di un giro e restituisce array di coordinate {x: km, y: valore}
 * permettendo l'allineamento perfetto sul tracciato.
 */
function elaboraTelemetriaSpaziale(telemetriaCruda, pilota) {
    if (!telemetriaCruda || telemetriaCruda.length === 0) return null;

    let datiVelocita = [], datiRpm = [], datiMarce = [], datiGas = [], datiFreno = [], datiGForce= [];
    
    let topSpeed = 0, minSpeed = Infinity, countFullThrottle = 0, countBraking = 0, countLiftAndCoast = 0;
    let maxDecelG = 0, distanzaPercorsaM = 0, gearshifts = 0;
    let tractionTimes = [], isTracting = false, tractionStartMs = null;

    let prevTimeMs = null, prevSpeed = null, prevGear = null;
    let totalSamples = telemetriaCruda.length;

    telemetriaCruda.forEach(t => {
        let timeMs = new Date(t.date).getTime();
        let speed = t.speed || 0;
        let throttle = t.throttle || 0;
        let brake = t.brake > 0;
        let gear = t.n_gear || 0;
        let gForceIstantanea = 0;

        // Integrazione Distanza e Calcolo G-Force
        if (prevTimeMs !== null) {
            let dt = (timeMs - prevTimeMs) / 1000; 
            if (dt > 0) {
                distanzaPercorsaM += (speed / 3.6) * dt; 
                
                // Calcolo G-Force per il grafico continuo
                let dv = (speed - prevSpeed) / 3.6; // m/s
                gForceIstantanea = (dv / dt) / 9.81;

                // Aggiornamento statistica picco massimo (come prima)
                if (brake && gForceIstantanea < maxDecelG) maxDecelG = gForceIstantanea;
            }
        }
        
        let kmAttuali = Number((distanzaPercorsaM / 1000).toFixed(4));

        // Coordinate {x: Kilometri, y: Valore}
        datiVelocita.push({ x: kmAttuali, y: speed });
        datiRpm.push({ x: kmAttuali, y: t.rpm || 0 });
        datiMarce.push({ x: kmAttuali, y: gear });
        datiGas.push({ x: kmAttuali, y: throttle });
        datiFreno.push({ x: kmAttuali, y: brake ? 100 : 0 });
        datiGForce.push({ x: kmAttuali, y: gForceIstantanea });

        // Calcoli Base
        if (speed > topSpeed) topSpeed = speed;
        if (speed > 40 && speed < minSpeed) minSpeed = speed;
        if (throttle >= 99) countFullThrottle++;
        if (brake) countBraking++;
        if ((throttle === 0 || throttle == null) && !brake && speed > 50) countLiftAndCoast++;
        if (prevGear !== null && gear !== prevGear && gear !== 0 && prevGear !== 0) gearshifts++;

        // Calcoli Trazione
        if (throttle <= 5) { isTracting = false; tractionStartMs = null; } 
        else if (throttle > 5 && throttle < 99 && !isTracting && !brake) { isTracting = true; tractionStartMs = timeMs; } 
        else if (throttle >= 99 && isTracting && tractionStartMs) {
            let tempoTrazione = (timeMs - tractionStartMs) / 1000;
            if (tempoTrazione < 3) tractionTimes.push(tempoTrazione);
            isTracting = false; tractionStartMs = null;
        }

        prevTimeMs = timeMs; prevSpeed = speed; prevGear = gear;
    });

    if (minSpeed === Infinity) minSpeed = 0;
    
    let stats = {
        topSpeed, minSpeed,
        percFullThrottle: ((countFullThrottle / totalSamples) * 100).toFixed(1),
        percBraking: ((countBraking / totalSamples) * 100).toFixed(1),
        percLiftCoast: ((countLiftAndCoast / totalSamples) * 100).toFixed(1),
        maxDecelG, distanzaPercorsa: distanzaPercorsaM, gearshifts,
        avgTraction: tractionTimes.length > 0 ? (tractionTimes.reduce((a,b)=>a+b,0)/tractionTimes.length).toFixed(2) : "N/D"
    };

    return { 
        coloreTeam: pilota.team_colour ? `#${pilota.team_colour}` : "#36a2eb", 
        datiVelocita, datiRpm, datiMarce, datiGas, datiFreno, datiGForce, stats
    };
}

