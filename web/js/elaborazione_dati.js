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

function elaboraRisultatiProveLibere(pilotiCrudi, giriCrudi, stintCrudi) {
    let statistiche = {};
    
    pilotiCrudi.forEach(pilota => {
        statistiche[pilota.driver_number] = {
            numero: pilota.driver_number,
            nome: pilota.broadcast_name,
            colore_team: pilota.team_colour,
            foto: pilota.headshot_url,
            miglior_giro: Infinity,
            s1: Infinity, s2: Infinity, s3: Infinity,
            giri: 0,
            gomma: null
        };
    });

    giriCrudi.forEach(giro => {
        let stat = statistiche[giro.driver_number];
        if (!stat) return;
        
        stat.giri++;
        if (giro.lap_duration && giro.lap_duration < stat.miglior_giro) {
            stat.miglior_giro = giro.lap_duration;
            if(stintCrudi) {
                const stint = stintCrudi.find(s => s.driver_number === giro.driver_number && giro.lap_number >= s.lap_start && giro.lap_number <= s.lap_end);
                if (stint) stat.gomma = stint.compound;
            }
        }
        if (giro.duration_sector_1 && giro.duration_sector_1 < stat.s1) stat.s1 = giro.duration_sector_1;
        if (giro.duration_sector_2 && giro.duration_sector_2 < stat.s2) stat.s2 = giro.duration_sector_2;
        if (giro.duration_sector_3 && giro.duration_sector_3 < stat.s3) stat.s3 = giro.duration_sector_3;
    });

    let classifica = Object.values(statistiche).filter(p => p.giri > 0);
    classifica.sort((a, b) => a.miglior_giro - b.miglior_giro);

    // FORMATTAZIONE PER LA TABELLA PROCEDURALE
    // I nomi delle chiavi ("Pos.", "Pilota", ecc.) diventeranno gli <th> della tabella!
    return classifica.map((p, indice) => {
        const coloreBordo = p.colore_team ? `#${p.colore_team}` : '#ccc';
        const imgHtml = p.foto ? `<img src="${p.foto}" style="width:30px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';
        const badgeGomma = p.gomma ? `<span style="display:inline-block; width:22px; height:22px; border-radius:50%; background-color:${ottieniInfoGomma(p.gomma).coloreBase}; color:${ottieniInfoGomma(p.gomma).coloreTesto}; text-align:center; line-height:22px; font-weight:bold; font-size:11px; border:1px solid #ccc;">${ottieniInfoGomma(p.gomma).lettera}</span>` : "-";

        return {
            "Pos.": `<b>${indice + 1}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${p.nome}</b><br><span class="w3-tiny w3-text-grey">#${p.numero}</span></div></div>`,
            "Miglior Giro": `<span style="${indice === 0 ? 'color:#b92df7; font-weight:bold;' : 'font-weight:bold;'}">${formattaTempo(p.miglior_giro)}</span>`,
            "Settore 1": p.s1 !== Infinity ? p.s1.toFixed(3) : "-",
            "Settore 2": p.s2 !== Infinity ? p.s2.toFixed(3) : "-",
            "Settore 3": p.s3 !== Infinity ? p.s3.toFixed(3) : "-",
            "Giri": p.giri,
            "Gomma": badgeGomma
        };
    });
}

/**
 * Incrocia i punti con l'anagrafica per creare la tabella Piloti.
 */
function elaboraClassificaPiloti(classificaCruda, pilotiCrudi) {
    if (!classificaCruda || classificaCruda.length === 0) return [];
    
    // Ordina per posizione attuale nel campionato
    let classificaOrdinata = [...classificaCruda].sort((a, b) => a.position_current - b.position_current);

    return classificaOrdinata.map(record => {
        // Cerca le info grafiche del pilota
        const pilotaInfo = pilotiCrudi.find(p => p.driver_number === record.driver_number) || {};
        
        const coloreBordo = pilotaInfo.team_colour ? `#${pilotaInfo.team_colour}` : '#ccc';
        const imgHtml = pilotaInfo.headshot_url ? `<img src="${pilotaInfo.headshot_url}" style="width:35px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';

        // Calcolo delta: Quanti punti ha fatto in questo specifico weekend?
        const deltaPunti = record.points_current - record.points_start;
        const stringaDelta = deltaPunti > 0 ? `<span class="w3-text-green w3-small"> (+${deltaPunti})</span>` : "";

        return {
            "Pos.": `<b>${record.position_current}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${pilotaInfo.broadcast_name || "Pilota Sconosciuto"}</b><br><span class="w3-tiny w3-text-grey">#${record.driver_number}</span></div></div>`,
            "Scuderia": pilotaInfo.team_name || "-",
            "Punti Totali": `<b>${record.points_current}</b> ${stringaDelta}`
        };
    });
}

/**
 * Crea la tabella dei Costruttori estraendo il colore del team da uno dei suoi piloti.
 */
function elaboraClassificaCostruttori(classificaCruda, pilotiCrudi) {
    if (!classificaCruda || classificaCruda.length === 0) return [];

    let classificaOrdinata = [...classificaCruda].sort((a, b) => a.position_current - b.position_current);

    return classificaOrdinata.map(record => {
        // Troviamo un pilota qualsiasi di questo team per rubargli il codice esadecimale del colore
        const pilotaDelTeam = pilotiCrudi.find(p => p.team_name === record.team_name) || {};
        const coloreBordo = pilotaDelTeam.team_colour ? `#${pilotaDelTeam.team_colour}` : '#ccc';
        
        const deltaPunti = record.points_current - record.points_start;
        const stringaDelta = deltaPunti > 0 ? `<span class="w3-text-green w3-small"> (+${deltaPunti})</span>` : "";

        return {
            "Pos.": `<b>${record.position_current}</b>`,
            "Scuderia": `<div style="border-left:4px solid ${coloreBordo}; padding-left:8px;"><b>${record.team_name}</b></div>`,
            "Punti Totali": `<b>${record.points_current}</b> ${stringaDelta}`
        };
    });
}

/**
 * Crea la matrice completa del campionato piloti.
 * @param {Array} gpPassati - Array dei Gran Premi fino a quello selezionato.
 * @param {Array} storicoClassifiche - Array contenente le classifiche alla fine di ogni GP.
 * @param {Array} pilotiCrudi - Dati anagrafici dei piloti (per foto e colori).
 */
function elaboraMatriceCampionatoPiloti(gpPassati, storicoClassifiche, pilotiCrudi) {
    // Prendiamo l'ultima classifica (quella del GP selezionato) per determinare l'ordine attuale
    const classificaAttuale = storicoClassifiche[storicoClassifiche.length - 1];
    if (!classificaAttuale || classificaAttuale.length === 0) return [];

    // Funzione di supporto per estrarre il punteggio massimo di un pilota in un dato weekend
    const getPunti = (classifica, driver_number) => {
        if (!classifica) return 0;
        const record = classifica.find(r => r.driver_number === driver_number);
        // Usiamo 'points' o 'points_current' in base a come risponde l'API
        return record ? (record.points || record.points_current || 0) : 0;
    };

    // Ordiniamo la classifica attuale per posizione
    let classificaOrdinata = [...classificaAttuale].sort((a, b) => (a.position || a.position_current) - (b.position || b.position_current));

    return classificaOrdinata.map(recordAttuale => {
        const d_num = recordAttuale.driver_number;
        const pilotaInfo = pilotiCrudi.find(p => p.driver_number === d_num) || {};
        const coloreBordo = pilotaInfo.team_colour ? `#${pilotaInfo.team_colour}` : '#ccc';
        const imgHtml = pilotaInfo.headshot_url ? `<img src="${pilotaInfo.headshot_url}" style="width:30px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';

        // 1. Dati base del pilota
        let riga = {
            "Pos.": `<b>${recordAttuale.position || recordAttuale.position_current}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${pilotaInfo.broadcast_name || "Sconosciuto"}</b><br><span class="w3-tiny w3-text-grey">#${d_num}</span></div></div>`
        };

        // 2. Colonne Dinamiche: Calcolo dei punti per OGNI Gran Premio
        for (let i = 0; i < gpPassati.length; i++) {
            const nomeBreveGP = gpPassati[i].testo.split(' ')[0]; // Es. "Bahrain Grand Prix" -> "Bahrain"
            
            const puntiFineWeekend = getPunti(storicoClassifiche[i], d_num);
            const puntiInizioWeekend = i === 0 ? 0 : getPunti(storicoClassifiche[i - 1], d_num);
            
            const puntiGuadagnati = puntiFineWeekend - puntiInizioWeekend;
            
            // Aggiunge dinamicamente la colonna all'oggetto JSON!
            riga[nomeBreveGP] = puntiGuadagnati > 0 ? puntiGuadagnati : `<span class="w3-text-grey">-</span>`;
        }

        // 3. Colonna Finale
        riga["Totale"] = `<b class="w3-large w3-text-blue">${getPunti(classificaAttuale, d_num)}</b>`;
        
        return riga;
    });
}

/**
 * Crea la matrice completa del campionato costruttori.
 */
function elaboraMatriceCampionatoCostruttori(gpPassati, storicoClassifiche, pilotiCrudi) {
    const classificaAttuale = storicoClassifiche[storicoClassifiche.length - 1];
    if (!classificaAttuale || classificaAttuale.length === 0) return [];

    const getPunti = (classifica, team_name) => {
        if (!classifica) return 0;
        const record = classifica.find(r => r.team_name === team_name);
        return record ? (record.points || record.points_current || 0) : 0;
    };

    let classificaOrdinata = [...classificaAttuale].sort((a, b) => (a.position || a.position_current) - (b.position || b.position_current));

    return classificaOrdinata.map(recordAttuale => {
        const t_name = recordAttuale.team_name;
        const pilotaDelTeam = pilotiCrudi.find(p => p.team_name === t_name) || {};
        const coloreBordo = pilotaDelTeam.team_colour ? `#${pilotaDelTeam.team_colour}` : '#ccc';

        let riga = {
            "Pos.": `<b>${recordAttuale.position || recordAttuale.position_current}</b>`,
            "Scuderia": `<div style="border-left:4px solid ${coloreBordo}; padding-left:8px;"><b>${t_name}</b></div>`
        };

        for (let i = 0; i < gpPassati.length; i++) {
            const nomeBreveGP = gpPassati[i].testo.split(' ')[0];
            const puntiFine = getPunti(storicoClassifiche[i], t_name);
            const puntiInizio = i === 0 ? 0 : getPunti(storicoClassifiche[i - 1], t_name);
            const puntiGuadagnati = puntiFine - puntiInizio;
            
            riga[nomeBreveGP] = puntiGuadagnati > 0 ? puntiGuadagnati : `<span class="w3-text-grey">-</span>`;
        }

        riga["Totale"] = `<b class="w3-large w3-text-blue">${getPunti(classificaAttuale, t_name)}</b>`;
        return riga;
    });
}

/**
 * Crea la matrice completa del campionato piloti divisa per Sessione (Sprint/Gara).
 * Inserisce i punti guadagnati e la POSIZIONE IN GARA (dedotta matematicamente dai punti).
 */
function elaboraMatriceCampionatoPiloti(sessioniPassate, storicoClassifiche, pilotiCrudi) {
    const classificaAttuale = storicoClassifiche[storicoClassifiche.length - 1];
    if (!classificaAttuale || classificaAttuale.length === 0) return [];

    let classificaOrdinata = [...classificaAttuale].sort((a, b) => a.position_current - b.position_current);

    // Funzione magica: converte i punti guadagnati nella posizione di arrivo
    const deduciPosizione = (punti, isSprint) => {
        if (punti === 0) return " - ";
        if (isSprint) {
            const mappaSprint = { 8: 1, 7: 2, 6: 3, 5: 4, 4: 5, 3: 6, 2: 7, 1: 8 };
            return mappaSprint[punti] ? `${mappaSprint[punti]}º` : "?º";
        } else {
            // Mappa Gara: Gestisce anche l'eventuale +1 del giro veloce
            const mappaGara = {
                26: 1, 25: 1,
                19: 2, 18: 2,
                16: 3, 15: 3,
                13: 4, 12: 4,
                11: 5, 10: 5,
                9: 6, 8: 6,
                7: 7, 6: 7,
                5: 8, 4: 8,
                3: 9, 2: 9, // Il 2 potrebbe teoricamente essere 10° + FL, ma 9° è quasi sempre esatto
                1: 10
            };
            return mappaGara[punti] ? `${mappaGara[punti]}º` : "?º";
        }
    };

    return classificaOrdinata.map(recordAttuale => {
        const d_num = recordAttuale.driver_number;
        const pilotaInfo = pilotiCrudi.find(p => p.driver_number === d_num) || {};
        const coloreBordo = pilotaInfo.team_colour ? `#${pilotaInfo.team_colour}` : '#ccc';
        const imgHtml = pilotaInfo.headshot_url ? `<img src="${pilotaInfo.headshot_url}" style="width:30px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';

        // Intestazione Riga
        let riga = {
            "Pos.": `<b>${recordAttuale.position_current}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${pilotaInfo.broadcast_name || "Sconosciuto"}</b><br><span class="w3-tiny w3-text-grey">#${d_num}</span></div></div>`
        };

        let puntiPrecedenti = 0;

        // Colonne Dinamiche: Punti e POSIZIONE DI QUELLA SESSIONE
        sessioniPassate.forEach((sessione, i) => {
            let siglaNazione = sessione.country_code || "GP";
            let isSprint = sessione.session_name.toLowerCase().includes("sprint");
            let tipoSessione = isSprint ? "Sprint" : "Gara";
            let nomeColonna = `${siglaNazione}<br><span class="w3-tiny w3-text-grey">${tipoSessione}</span>`;

            let classificaDiQuestaSessione = storicoClassifiche[i];
            let recordPilota = classificaDiQuestaSessione ? classificaDiQuestaSessione.find(r => r.driver_number === d_num) : null;
            
            let puntiAttuali = recordPilota ? recordPilota.points_current : puntiPrecedenti;
            let puntiGuadagnati = puntiAttuali - puntiPrecedenti;
            if (puntiGuadagnati < 0) puntiGuadagnati = 0;

            let posizioneArrivo = deduciPosizione(puntiGuadagnati, isSprint);

            // Formattazione: Punti (Posizione d'arrivo)
            if (puntiGuadagnati > 0) {
                riga[nomeColonna] = `<b>${puntiGuadagnati}</b> <br><span class="w3-tiny w3-text-grey">(${posizioneArrivo})</span>`;
            } else {
                riga[nomeColonna] = `<span class="w3-text-grey">- <br><span class="w3-tiny">(${posizioneArrivo})</span></span>`;
            }
            
            puntiPrecedenti = puntiAttuali;
        });

        riga["Totale"] = `<b class="w3-large w3-text-blue">${recordAttuale.points_current}</b>`;
        return riga;
    });
}

/**
 * Crea la matrice completa del campionato costruttori divisa per Sessione (Sprint/Gara).
 * (Le scuderie non hanno una singola posizione d'arrivo, quindi mostra solo i punti ottenuti)
 */
function elaboraMatriceCampionatoCostruttori(sessioniPassate, storicoClassifiche, pilotiCrudi) {
    const classificaAttuale = storicoClassifiche[storicoClassifiche.length - 1];
    if (!classificaAttuale || classificaAttuale.length === 0) return [];

    let classificaOrdinata = [...classificaAttuale].sort((a, b) => a.position_current - b.position_current);

    return classificaOrdinata.map(recordAttuale => {
        const t_name = recordAttuale.team_name;
        const pilotaDelTeam = pilotiCrudi.find(p => p.team_name === t_name) || {};
        const coloreBordo = pilotaDelTeam.team_colour ? `#${pilotaDelTeam.team_colour}` : '#ccc';

        let riga = {
            "Pos.": `<b>${recordAttuale.position_current}</b>`,
            "Scuderia": `<div style="border-left:4px solid ${coloreBordo}; padding-left:8px;"><b>${t_name}</b></div>`
        };

        let puntiPrecedenti = 0;

        sessioniPassate.forEach((sessione, i) => {
            let siglaNazione = sessione.country_code || "GP";
            let tipoSessione = sessione.session_name.toLowerCase().includes("sprint") ? "Sprint" : "Gara";
            let nomeColonna = `${siglaNazione}<br><span class="w3-tiny w3-text-grey">${tipoSessione}</span>`;

            let classificaDiQuestaSessione = storicoClassifiche[i];
            let recordTeam = classificaDiQuestaSessione ? classificaDiQuestaSessione.find(r => r.team_name === t_name) : null;
            
            let puntiAttuali = recordTeam ? recordTeam.points_current : puntiPrecedenti;
            let puntiGuadagnati = puntiAttuali - puntiPrecedenti;
            if (puntiGuadagnati < 0) puntiGuadagnati = 0;

            // Per i costruttori stampiamo solo il bottino totale della gara/sprint
            if (puntiGuadagnati > 0) {
                riga[nomeColonna] = `<b class="w3-text-green">+${puntiGuadagnati}</b>`;
            } else {
                riga[nomeColonna] = `<span class="w3-text-grey">-</span>`;
            }

            puntiPrecedenti = puntiAttuali;
        });

        riga["Totale"] = `<b class="w3-large w3-text-blue">${recordAttuale.points_current}</b>`;
        return riga;
    });
}

/**
 * Analisi Avanzata Qualifiche (Standard o Sprint).
 * Calcola Ideal Lap, Settori Viola/Verdi, Gap con il Leader e Gap Interno alla Scuderia.
 */
function elaboraRisultatiQualifiche(pilotiCrudi, giriCrudi, stintCrudi) {
    let statistiche = {};
    let best_s1_assoluto = Infinity, best_s2_assoluto = Infinity, best_s3_assoluto = Infinity;

    // 1. Inizializza i piloti
    pilotiCrudi.forEach(p => {
        statistiche[p.driver_number] = {
            numero: p.driver_number,
            nome: p.broadcast_name,
            acronimo: p.name_acronym,
            team: p.team_name,
            colore_team: p.team_colour,
            foto: p.headshot_url,
            miglior_giro: Infinity,
            giro_ufficiale_obj: null,
            pb_s1: Infinity, pb_s2: Infinity, pb_s3: Infinity, // Personal Bests
            gomma: null
        };
    });

    // 2. Analizza ogni singolo giro di tutta la sessione
    giriCrudi.forEach(giro => {
        let stat = statistiche[giro.driver_number];
        if (!stat) return;

        // A. Cerca i record personali (PB) del pilota sui singoli settori
        if (giro.duration_sector_1 && giro.duration_sector_1 < stat.pb_s1) stat.pb_s1 = giro.duration_sector_1;
        if (giro.duration_sector_2 && giro.duration_sector_2 < stat.pb_s2) stat.pb_s2 = giro.duration_sector_2;
        if (giro.duration_sector_3 && giro.duration_sector_3 < stat.pb_s3) stat.pb_s3 = giro.duration_sector_3;

        // B. Cerca i record ASSOLUTI della sessione (Viola)
        if (giro.duration_sector_1 && giro.duration_sector_1 < best_s1_assoluto) best_s1_assoluto = giro.duration_sector_1;
        if (giro.duration_sector_2 && giro.duration_sector_2 < best_s2_assoluto) best_s2_assoluto = giro.duration_sector_2;
        if (giro.duration_sector_3 && giro.duration_sector_3 < best_s3_assoluto) best_s3_assoluto = giro.duration_sector_3;

        // C. Salva il tempo ufficiale e aggancia i dati di QUEL giro specifico
        if (giro.lap_duration && giro.lap_duration < stat.miglior_giro) {
            stat.miglior_giro = giro.lap_duration;
            stat.giro_ufficiale_obj = giro;

            // Trova la mescola usata in questo specifico giro
            if (stintCrudi) {
                const stint = stintCrudi.find(s => s.driver_number === giro.driver_number && giro.lap_number >= s.lap_start && giro.lap_number <= s.lap_end);
                if (stint) stat.gomma = stint.compound;
            }
        }
    });

    // 3. Pulisce chi non ha tempi validi e ordina la classifica
    let classifica = Object.values(statistiche).filter(p => p.miglior_giro !== Infinity);
    classifica.sort((a, b) => a.miglior_giro - b.miglior_giro);

    // 4. PRE-CALCOLO SCONTRI DIRETTI (Teammate Battle)
    let teamBestTimes = {};
    let teamBestDriver = {};
    classifica.forEach(p => {
        // Essendo ordinata dal più veloce, il primo pilota di un team che incontriamo è per forza il leader interno
        if (!teamBestTimes[p.team]) {
            teamBestTimes[p.team] = p.miglior_giro;
            teamBestDriver[p.team] = p.acronimo;
        }
    });

    let leaderTime = classifica.length > 0 ? classifica[0].miglior_giro : 0;

    // 5. Costruzione del JSON finale per la tabella procedurale
    return classifica.map((p, indice) => {
        const prevTime = indice > 0 ? classifica[indice - 1].miglior_giro : leaderTime;
        
        const gapLeader = indice === 0 ? "-" : formattaDistacco(p.miglior_giro - leaderTime);
        const gapPrev = indice === 0 ? "-" : formattaDistacco(p.miglior_giro - prevTime);
        
        // Calcolo Delta col compagno di squadra
        let gapTeammate = `<span class="w3-text-grey">-</span>`;
        if (teamBestTimes[p.team] && teamBestTimes[p.team] < p.miglior_giro) {
            gapTeammate = `<b class="w3-text-red">${formattaDistacco(p.miglior_giro - teamBestTimes[p.team])}</b> <br><span class="w3-tiny w3-text-grey">(vs ${teamBestDriver[p.team]})</span>`;
        }

        // Calcolo Giro Ideale (Ideal Lap) e Delta
        const idealLap = (p.pb_s1 !== Infinity ? p.pb_s1 : 0) + (p.pb_s2 !== Infinity ? p.pb_s2 : 0) + (p.pb_s3 !== Infinity ? p.pb_s3 : 0);
        const deltaIdeal = p.miglior_giro - idealLap;

        // Funzione per la colorazione televisiva (Viola = Assoluto, Verde = Personale)
        const formattaSettore = (valore, pb_personale, best_assoluto) => {
            if (!valore || valore === Infinity) return "-";
            if (valore <= best_assoluto) return `<span style="color:#b92df7; font-weight:bold;">${valore.toFixed(3)}</span>`; // Viola
            if (valore <= pb_personale) return `<span style="color:#39b54a; font-weight:bold;">${valore.toFixed(3)}</span>`; // Verde
            return `<span>${valore.toFixed(3)}</span>`; // Normale/Giallo
        };

        const s1 = p.giro_ufficiale_obj ? formattaSettore(p.giro_ufficiale_obj.duration_sector_1, p.pb_s1, best_s1_assoluto) : "-";
        const s2 = p.giro_ufficiale_obj ? formattaSettore(p.giro_ufficiale_obj.duration_sector_2, p.pb_s2, best_s2_assoluto) : "-";
        const s3 = p.giro_ufficiale_obj ? formattaSettore(p.giro_ufficiale_obj.duration_sector_3, p.pb_s3, best_s3_assoluto) : "-";

        const coloreBordo = p.colore_team ? `#${p.colore_team}` : '#ccc';
        const imgHtml = p.foto ? `<img src="${p.foto}" style="width:30px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';
        const badgeGomma = p.gomma ? `<span style="display:inline-block; width:22px; height:22px; border-radius:50%; background-color:${ottieniInfoGomma(p.gomma).coloreBase}; color:${ottieniInfoGomma(p.gomma).coloreTesto}; text-align:center; line-height:22px; font-weight:bold; font-size:11px; border:1px solid #ccc;">${ottieniInfoGomma(p.gomma).lettera}</span>` : "-";

        return {
            "Pos.": `<b>${indice + 1}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${p.nome}</b><br><span class="w3-tiny w3-text-grey">#${p.numero}</span></div></div>`,
            "Tempo Uff.": `<b class="w3-large">${formattaTempo(p.miglior_giro)}</b>`,
            "Gap Leader": gapLeader,
            "Gap Prev": gapPrev,
            "Compagno": gapTeammate,
            "S1": s1,
            "S2": s2,
            "S3": s3,
            "Giro Ideale": `<span class="w3-text-blue"><b>${formattaTempo(idealLap)}</b></span>`,
            "Delta Ideale": `<span class="w3-text-orange">+${deltaIdeal.toFixed(3)}</span>`,
            "Gomma": badgeGomma
        };
    });
}