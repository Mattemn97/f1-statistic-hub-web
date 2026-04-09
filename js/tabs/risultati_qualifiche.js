function elaboraRisultatiQualifiche(pilotiCrudi, giriCrudi, stintCrudi) {
    console.group("Elaborazione Risultati Qualifiche");
    console.log(`Ricevuti: ${pilotiCrudi?.length || 0} piloti e ${giriCrudi?.length || 0} giri.`);
    console.time("Tempo elaborazione dati");
    let best_s1_assoluto = Infinity, best_s2_assoluto = Infinity, best_s3_assoluto = Infinity;

    let statistiche = {};

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
            pb_s1: Infinity, pb_s2: Infinity, pb_s3: Infinity,
            gomma: null
        };
    });
    
    console.debug(`Statistiche base inizializzate per ${Object.keys(statistiche).length} piloti.`);

    let giriValidi = 0;
    giriCrudi.forEach(giro => {
        let stat = statistiche[giro.driver_number];
        if (!stat) return;

        giriValidi++;

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
    console.debug(`Elaborati con successo ${giriValidi} giri validi associati ai piloti.`);


    // 3. Pulisce chi non ha tempi validi e ordina la classifica
    let classifica = Object.values(statistiche).filter(p => p.miglior_giro !== Infinity);
    console.log(`Piloti filtrati (almeno 1 giro registrato): ${classifica.length}`);

    classifica.sort((a, b) => a.miglior_giro - b.miglior_giro);
    console.debug("Classifica ordinata per tempo sul giro migliore.");

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
    const datiFormattati = classifica.map((p, indice) => {
        const prevTime = indice > 0 ? classifica[indice - 1].miglior_giro : leaderTime;
        
        const gapLeader = indice === 0 ? "-" : formattaDistacco(p.miglior_giro - leaderTime);
        const gapPrev = indice === 0 ? "-" : formattaDistacco(p.miglior_giro - prevTime);
        
        // Calcolo Delta col compagno di squadra
        let gapTeammate = `<span class="w3-text-grey">-</span>`;
        if (teamBestTimes[p.team] && teamBestTimes[p.team] < p.miglior_giro) {
            gapTeammate = `<b class="w3-text-red">${formattaDistacco(p.miglior_giro - teamBestTimes[p.team])}</b>`;
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
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${p.nome}</b></div></div>`,
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

    console.timeEnd("Tempo elaborazione dati");
    console.groupEnd();

    return datiFormattati;
}


/**
 * Orchestratore per la gestione delle Qualifiche (Standard o Sprint).
 * Include il sistema di Cache Globale e Anti-Spam.
 */
async function gestisciSchedaQualifiche() {
    console.group("Gestione Scheda Qualifiche");
    console.log("[INIT] Inizializzazione orchestratore...");

    // OpenF1 usa nomi diversi a seconda dell'anno ("Sprint Shootout" o "Sprint Qualifying")
    const chiaveSessioneQualificheSprint = statoApp.sessioniDelGPCorrente["Sprint Shootout"] || statoApp.sessioniDelGPCorrente["Sprint Qualifying"];
    const chiaveSessioneQualifiche = statoApp.sessioniDelGPCorrente["Qualifying"];

    const idTabellaQualificheSprint = `tabella-sprint-quali`;
    const idTabellaQualifiche = `tabella-quali`;

    const idStringaMeteoQualificheSprint = `dati-meteo-sprint-quali`;
    const idStringaMeteoQualifiche = `dati-meteo-quali`;
    
    const idContenitoreQualificheSprint = `contenitore-dati-sprint-quali`;
    const idContenitoreQualifiche = `contenitore-dati-quali`;

    const idAvvisoQualificheSprint = `avviso-assenza-sprint-quali`;
    const idAvvisoQualifiche = `avviso-assenza-quali`;

    const lista_nomeSessioni = ["Sprint Qualifying", "Qualifying"]
    const lista_chiaviSessioni = [ chiaveSessioneQualificheSprint, chiaveSessioneQualifiche];
    const lista_idTabelle = [ idTabellaQualificheSprint, idTabellaQualifiche];
    const lista_idStringheMeteo = [ idStringaMeteoQualificheSprint, idStringaMeteoQualifiche];
    const lista_idContenitori = [ idContenitoreQualificheSprint, idContenitoreQualifiche];
    const lista_idAvvisi = [ idAvvisoQualificheSprint, idAvvisoQualifiche];

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
                const datiFormattati = elaboraRisultatiQualifiche(datiSalvati.piloti, datiSalvati.giri, datiSalvati.stint);

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

