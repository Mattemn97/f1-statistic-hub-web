function elaboraRisultatiProveLibere(pilotiCrudi, giriCrudi) {
    console.group("Elaborazione Risultati Prove Libere");
    console.log(`Ricevuti: ${pilotiCrudi?.length || 0} piloti e ${giriCrudi?.length || 0} giri.`);
    console.time("Tempo elaborazione dati");

    let statistiche = {};
    
    pilotiCrudi.forEach(pilota => {
        statistiche[pilota.driver_number] = {
            numero: pilota.driver_number,
            nome: pilota.broadcast_name,
            colore_team: pilota.team_colour,
            foto: pilota.headshot_url,
            miglior_giro: Infinity,
            s1: Infinity, s2: Infinity, s3: Infinity,
            giri: 0
        };
    });
    console.debug(`Statistiche base inizializzate per ${Object.keys(statistiche).length} piloti.`);

    let giriValidi = 0;
    giriCrudi.forEach(giro => {
        let stat = statistiche[giro.driver_number];
        if (!stat) return;
        
        giriValidi++;
        stat.giri++;
        if (giro.lap_duration && giro.lap_duration < stat.miglior_giro) {
            stat.miglior_giro = giro.lap_duration;
        }
        if (giro.duration_sector_1 && giro.duration_sector_1 < stat.s1) stat.s1 = giro.duration_sector_1;
        if (giro.duration_sector_2 && giro.duration_sector_2 < stat.s2) stat.s2 = giro.duration_sector_2;
        if (giro.duration_sector_3 && giro.duration_sector_3 < stat.s3) stat.s3 = giro.duration_sector_3;
    });
    console.debug(`Elaborati con successo ${giriValidi} giri validi associati ai piloti.`);

    let classifica = Object.values(statistiche).filter(p => p.giri > 0);
    console.log(`Piloti filtrati (almeno 1 giro registrato): ${classifica.length}`);

    classifica.sort((a, b) => a.miglior_giro - b.miglior_giro);
    console.debug("Classifica ordinata per tempo sul giro migliore.");

    // FORMATTAZIONE PER LA TABELLA PROCEDURALE
    const datiFormattati = classifica.map((p, indice) => {
        const coloreBordo = p.colore_team ? `#${p.colore_team}` : '#ccc';
        const imgHtml = p.foto ? `<img src="${p.foto}" style="width:30px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';
        return {
            "Pos.": `<b>${indice + 1}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${p.nome}</b><br><span class="w3-tiny w3-text-grey">#${p.numero}</span></div></div>`,
            "Miglior Giro": `<span style="${indice === 0 ? 'color:#b92df7; font-weight:bold;' : 'font-weight:bold;'}">${formattaTempo(p.miglior_giro)}</span>`,
            "Settore 1": p.s1 !== Infinity ? p.s1.toFixed(3) : "-",
            "Settore 2": p.s2 !== Infinity ? p.s2.toFixed(3) : "-",
            "Settore 3": p.s3 !== Infinity ? p.s3.toFixed(3) : "-",
            "Giri": p.giri
        };
    });

    console.timeEnd("Tempo elaborazione dati");
    console.groupEnd();
    
    return datiFormattati;
}

/**
 * Orchestratore specifico per le tabelle delle Prove Libere
 */
async function gestisciSchedaProveLibere() {
    console.group("Gestione Scheda Prove Libere");
    console.log("[INIT] Inizializzazione orchestratore...");

    const chiaveSessionePL1 = statoApp.sessioniDelGPCorrente["Practice 1"];
    const chiaveSessionePL2 = statoApp.sessioniDelGPCorrente["Practice 2"];
    const chiaveSessionePL3 = statoApp.sessioniDelGPCorrente["Practice 3"];
    
    console.info("[INFO] Chiavi sessioni trovate:", { 
        PL1: chiaveSessionePL1 || "Nessuna", 
        PL2: chiaveSessionePL2 || "Nessuna", 
        PL3: chiaveSessionePL3 || "Nessuna" 
    });

    const idTabellaPL1 = `tabella-libere1`;
    const idTabellaPL2 = `tabella-libere2`;
    const idTabellaPL3 = `tabella-libere3`;

    const lista_chiaviSessioni = [ chiaveSessionePL1, chiaveSessionePL2, chiaveSessionePL3 ];
    const lista_idTabelle = [ idTabellaPL1, idTabellaPL2, idTabellaPL3 ];

    for (let i = 0; i < lista_chiaviSessioni.length; i++) {
        const chiaveSessione = lista_chiaviSessioni[i];
        const idTabella = lista_idTabelle[i];
        const tabellaDOM = document.getElementById(idTabella);
        const stringaMeteo = document.getElementById(`dati-meteo-libere${i + 1}`);
        const contenitore = document.getElementById(`contenitore-dati-libere${i + 1}`);
        const avviso = document.getElementById(`avviso-assenza-libere${i + 1}`);

        console.groupCollapsed(`Controllo Sessione PL${i + 1} (${chiaveSessione || 'Nessuna Chiave'})`);

        if (chiaveSessione) {
            console.log(`[UI] Preparazione DOM per la sessione: ${chiaveSessione}`);
            if (contenitore) contenitore.style.display = 'block';
            if (avviso) avviso.style.display = 'none';

            // CONTROLLO CACHE
            if (statoApp.cacheDati[chiaveSessione]) {
                console.info(`[CACHE] Trovati dati in cache per [${chiaveSessione}]. Evito il download.`);
                const datiSalvati = statoApp.cacheDati[chiaveSessione];
                const datiFormattati = elaboraRisultatiProveLibere(datiSalvati.piloti, datiSalvati.giri);
                
                if (stringaMeteo) popolaStringaMeteo(stringaMeteo, datiSalvati.meteo);
                if (tabellaDOM) popolaTabellaDaJson(idTabella, datiFormattati);
                
                console.groupEnd();
                continue; 
            }

            // SCARICA E SALVA
            console.log(`[NETWORK] Dati non in cache. Avvio download per [${chiaveSessione}]...`);
            if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-padding-16'>Download dati in corso...</td></tr>";

            try {
                console.time(`Download dati ${chiaveSessione}`);
                const pilotiCrudi = await recuperaPiloti(chiaveSessione);
                console.log(`[NETWORK] Scaricati ${pilotiCrudi.length} piloti.`);
                
                const giriCrudi = await recuperaGiri(chiaveSessione);
                console.log(`[NETWORK] Scaricati ${giriCrudi.length} giri.`);
                
                const meteocrudo = await recuperaDatiMeteo(chiaveSessione);
                console.log("[NETWORK] Dati meteo scaricati con successo.");
                console.timeEnd(`Download dati ${chiaveSessione}`);

                // Salvataggio in cache
                statoApp.cacheDati[chiaveSessione] = {
                    piloti: pilotiCrudi,
                    giri: giriCrudi,
                    meteo: meteocrudo
                };
                console.log(`[STORAGE] Dati salvati in cache per [${chiaveSessione}].`);

                // Elaborazione e disegno
                console.log("[UI] Avvio elaborazione e popolamento DOM...");
                const datiFormattati = elaboraRisultatiProveLibere(pilotiCrudi, giriCrudi);
                if (stringaMeteo) popolaStringaMeteo(stringaMeteo, meteocrudo);
                if (tabellaDOM) popolaTabellaDaJson(idTabella, datiFormattati);
                console.log(`[SUCCESS] Rendering completato per PL${i + 1}`);

            } catch (errore) {
                console.error(`[ERROR] Errore critico durante download/elaborazione di ${chiaveSessione}:`, errore);
                if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-text-red w3-padding-16'>Impossibile caricare i dati</td></tr>";
            }

        } else {
            console.log(`[INFO] Nessuna sessione trovata per PL${i + 1}. Mostro avviso assenza dati.`);
            if (contenitore) contenitore.style.display = 'none';
            if (avviso) avviso.style.display = 'block';
        }
        
        console.groupEnd(); // Chiude il gruppo della singola sessione
    }
    
    console.log("[DONE] Orchestrazione di tutte le sessioni completata.");
    console.groupEnd(); // Chiude il gruppo principale
}