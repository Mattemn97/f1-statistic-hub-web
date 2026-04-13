function elaboraRisultatiGara(pilotiCrudi, giriCrudi, stintCrudi) {
    let stats = {};
    let maxGiri = 0;
    let bestLapAssoluto = Infinity;

    // 1. Inizializzazione Piloti
    pilotiCrudi.forEach(p => {
        stats[p.driver_number] = {
            numero: p.driver_number,
            nome: p.broadcast_name,
            acronimo: p.name_acronym,
            team: p.team_name,
            colore_team: p.team_colour,
            foto: p.headshot_url,
            giri_fatti: 0,
            tempo_totale: 0,
            miglior_giro: Infinity,
            tempi_giri: [],
            stints: stintCrudi ? stintCrudi.filter(s => s.driver_number === p.driver_number).sort((a,b) => a.stint_number - b.stint_number) : []
        };
    });

    // 2. Analisi Giri e Somma Tempi
    giriCrudi.forEach(giro => {
        let s = stats[giro.driver_number];
        if (!s || !giro.lap_duration) return; 

        s.giri_fatti++;
        s.tempo_totale += giro.lap_duration;
        s.tempi_giri.push(giro.lap_duration);
        
        if (giro.lap_duration < s.miglior_giro) s.miglior_giro = giro.lap_duration;
        if (giro.lap_duration < bestLapAssoluto) bestLapAssoluto = giro.lap_duration;
        
        if (s.giri_fatti > maxGiri) maxGiri = s.giri_fatti;
    });

    // 3. Ordinamento Classifica
    let classifica = Object.values(stats).filter(p => p.giri_fatti > 0);
    classifica.sort((a, b) => {
        if (b.giri_fatti !== a.giri_fatti) return b.giri_fatti - a.giri_fatti;
        return a.tempo_totale - b.tempo_totale;
    });

    // 4. Teammate Battle (Calcolata solo tra chi ha finito la gara)
    let teamBest = {};
    classifica.forEach(p => {
        if (!teamBest[p.team] && p.giri_fatti === maxGiri) {
            teamBest[p.team] = { tempo: p.tempo_totale, acronimo: p.acronimo };
        }
    });

    let leaderTime = classifica.length > 0 ? classifica[0].tempo_totale : 0;
    let leaderLaps = classifica.length > 0 ? classifica[0].giri_fatti : 0;

    // 5. Creazione Output Tabella Procedurale
    return classifica.map((p, index) => {
        const prev = index > 0 ? classifica[index - 1] : null;

        // Gestione STATUS e DISTACCHI (con media per giro)
        let status = "", gapLeader = "-", gapPrev = "-";
        
        if (p.giri_fatti === leaderLaps) {
            status = `<b class="w3-large">${formattaTempo(p.tempo_totale)}</b>`;
            if (index > 0) {
                // Calcolo Distacco Leader e Media
                let diffLeader = p.tempo_totale - leaderTime;
                let avgLeader = diffLeader / p.giri_fatti;
                gapLeader = `<b>${formattaDistacco(diffLeader)}</b> <br><span class="w3-tiny w3-text-grey">(${formattaDistacco(avgLeader)}/giro)</span>`;

                // Calcolo Distacco Precedente e Media
                let diffPrev = p.tempo_totale - prev.tempo_totale;
                let avgPrev = diffPrev / p.giri_fatti;
                gapPrev = `${formattaDistacco(diffPrev)} <br><span class="w3-tiny w3-text-grey">(${formattaDistacco(avgPrev)}/giro)</span>`;
            }
        } else {
            let lapsDown = leaderLaps - p.giri_fatti;
            if (lapsDown <= 5) { // DOPPIATO
                status = `<b class="w3-text-grey">+${lapsDown} Lap${lapsDown > 1 ? 's' : ''}</b>`;
                gapLeader = status;
                gapPrev = prev.giri_fatti === p.giri_fatti ? formattaDistacco(p.tempo_totale - prev.tempo_totale) : "-";
            } else { // RITIRATO (DNF)
                status = `<b class="w3-text-red">DNF</b>`;
                gapLeader = "DNF";
                gapPrev = "-";
            }
        }

        // Compagno di Squadra (con media per giro)
        let gapTeammate = `<span class="w3-text-grey">-</span>`;
        if (teamBest[p.team] && teamBest[p.team].acronimo !== p.acronimo) {
            if (p.giri_fatti === leaderLaps) {
                let diffTeam = p.tempo_totale - teamBest[p.team].tempo;
                let avgTeam = diffTeam / p.giri_fatti;
                gapTeammate = `<b class="w3-text-red">+${diffTeam.toFixed(3)}</b> <br><span class="w3-tiny w3-text-grey">(vs ${teamBest[p.team].acronimo} | +${avgTeam.toFixed(3)}/giro)</span>`;
            } else {
                gapTeammate = `<span class="w3-tiny w3-text-grey">N/A (DNF/Lapped)</span>`;
            }
        }

        // Miglior Giro
        let mgFormatted = "-";
        if (p.miglior_giro !== Infinity) {
            mgFormatted = p.miglior_giro === bestLapAssoluto 
                ? `<span style="color:#b92df7; font-weight:bold;">${formattaTempo(p.miglior_giro)}</span>` 
                : formattaTempo(p.miglior_giro);
        }

        // Passo Gara (Mediana)
        let passoGara = calcolaMediana(p.tempi_giri);
        let passoFormatted = passoGara ? `<b class="w3-text-green">${formattaTempo(passoGara)}</b>` : "-";

        // Costruzione Strategia (Es: [S 15] -> [M 32])
        let numPits = Math.max(0, p.stints.length - 1);
        let htmlStrategia = p.stints.map(s => {
            let infoGomma = ottieniInfoGomma(s.compound);
            let endLap = s.lap_end || p.giri_fatti; 
            let giriStint = endLap - s.lap_start + 1;
            return `<span style="display:inline-block; padding:2px 6px; margin:2px; border-radius:4px; font-size:11px; font-weight:bold; background-color:${infoGomma.coloreBase}; color:${infoGomma.coloreTesto}; border:1px solid #ccc;">${infoGomma.lettera} ${giriStint}</span>`;
        }).join(` <span class="w3-text-grey w3-tiny">➔</span> `);

        // UI Base
        const coloreBordo = p.colore_team ? `#${p.colore_team}` : '#ccc';
        const imgHtml = p.foto ? `<img src="${p.foto}" style="width:30px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';

        return {
            "Pos.": `<b>${index + 1}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${p.nome}</b><br><span class="w3-tiny w3-text-grey">#${p.numero}</span></div></div>`,
            "Tempo / Status": status,
            "Gap Leader": gapLeader,
            "Gap Prev": gapPrev,
            "Compagno": gapTeammate,
            "Miglior Giro": mgFormatted,
            "Passo Gara": passoFormatted,
            "Giri": p.giri_fatti,
            "Pit": numPits,
            "Strategia": htmlStrategia || "-"
        };
    });
}


/**
 * Orchestratore per la Gara (Standard o Sprint).
 * Identico flusso strutturale delle altre schede, ma chiama l'elaborazione specifica della Gara.
 */
async function gestisciSchedaGare() {
    console.group("Gestione Scheda Gare");
    console.log("[INIT] Inizializzazione orchestratore...");

    const chiaveSessioneGaraSprint = statoApp.sessioniDelGPCorrente["Sprint"];
    const chiaveSessioneGara = statoApp.sessioniDelGPCorrente["Race"];

    const idTabellaGaraSprint = `tabella-sprint-gara`;
    const idTabellaGara = `tabella-gara`;

    const idStringaMeteoGaraSprint = `dati-meteo-sprint-gara`;
    const idStringaMeteoGara = `dati-meteo-gara`;
    
    const idContenitoreGaraSprint = `contenitore-dati-sprint-gara`;
    const idContenitoreGara = `contenitore-dati-gara`;

    const idAvvisoGaraSprint = `avviso-assenza-sprint-gara`;
    const idAvvisoGara = `avviso-assenza-gara`;

    const lista_nomeSessioni = ["Sprint", "Race"]
    const lista_chiaviSessioni = [ chiaveSessioneGaraSprint, chiaveSessioneGara];
    const lista_idTabelle = [ idTabellaGaraSprint, idTabellaGara];
    const lista_idStringheMeteo = [ idStringaMeteoGaraSprint, idStringaMeteoGara];
    const lista_idContenitori = [ idContenitoreGaraSprint, idContenitoreGara];
    const lista_idAvvisi = [ idAvvisoGaraSprint, idAvvisoGara];

    for (let i = 0; i < lista_chiaviSessioni.length; i++) {
        const nomeSessione = lista_nomeSessioni[i]
        const chiaveSessione = lista_chiaviSessioni[i];
        const idTabella = lista_idTabelle[i];
        const tabellaDOM = document.getElementById(idTabella);
        const stringaMeteo = document.getElementById(lista_idStringheMeteo[i]);
        const contenitore = document.getElementById(lista_idContenitori[i]);
        const avviso = document.getElementById(lista_idAvvisi[i]);

        console.groupCollapsed(`Controllo Sessione ${nomeSessione} (${chiaveSessione || 'Nessuna Chiave'})`);

        if (chiaveSessione) {
            console.log(`[UI] Preparazione DOM per la sessione: ${chiaveSessione}`);
            if (contenitore) contenitore.style.display = 'block';
            if (avviso) avviso.style.display = 'none';
        
            // CONTROLLO CACHE
            if (statoApp.cacheDati[chiaveSessione]) {
                console.info(`[CACHE] Trovati dati in cache per [${chiaveSessione}]. Evito il download.`);
                const datiSalvati = statoApp.cacheDati[chiaveSessione];
                const datiFormattati = elaboraRisultatiGara(datiSalvati.piloti, datiSalvati.giri, datiSalvati.stint);

                if (stringaMeteo) popolaStringaMeteo(stringaMeteo, datiSalvati.meteo);
                if (tabellaDOM) popolaTabellaDaJson(idTabella, datiFormattati);
                
                console.groupEnd();
                continue;  
            }

            // SCARICA E SALVA
            console.log(`[NETWORK] Dati non in cache. Avvio download per ${nomeSessione} [${chiaveSessione}]...`);
            if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-padding-16'>Download dati in corso...</td></tr>";

            try {
                console.time(`Download dati ${chiaveSessione}`);
                const pilotiCrudi = await recuperaPiloti(chiaveSessione);
                console.log(`[NETWORK] Scaricati ${pilotiCrudi.length} piloti.`);
                
                const giriCrudi = await recuperaGiri(chiaveSessione);
                console.log(`[NETWORK] Scaricati ${giriCrudi.length} giri.`);
                
                const meteocrudo = await recuperaDatiMeteo(chiaveSessione);
                console.log("[NETWORK] Dati meteo scaricati con successo.");

                const stintCrudi = await recuperaStintGomme(chiaveSessione);
                console.log("[NETWORK] Dati stint gomme scaricati con successo.");                
                console.timeEnd(`Download dati ${chiaveSessione}`);

                statoApp.cacheDati[chiaveSessione] = {
                    piloti: pilotiCrudi,
                    giri: giriCrudi,
                    stint: stintCrudi,
                    meteo: meteocrudo
                };

                const datiFormattati = elaboraRisultatiQualifiche(pilotiCrudi, giriCrudi, stintCrudi);
                if (stringaMeteo) popolaStringaMeteo(stringaMeteo, meteocrudo);
                if (tabellaDOM) popolaTabellaDaJson(idTabella, datiFormattati);
                console.log(`[SUCCESS] Rendering completato per ${nomeSessione}`);

            } catch (errore) {
                console.error(`[ERROR] Errore critico durante download/elaborazione di ${nomeSessione} [${chiaveSessione}]:`, errore);
                if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-text-red w3-padding-16'>Impossibile caricare i dati</td></tr>";
            }

        } else {
            console.log(`[INFO] Nessuna sessione trovata per ${nomeSessione}. Mostro avviso assenza dati.`);
            if (contenitore) contenitore.style.display = 'none';
            if (avviso) avviso.style.display = 'block';
        }
        
        console.groupEnd(); // Chiude il gruppo della singola sessione
    }
    
    console.log("[DONE] Orchestrazione di tutte le sessioni completata.");
    console.groupEnd(); // Chiude il gruppo principale
}