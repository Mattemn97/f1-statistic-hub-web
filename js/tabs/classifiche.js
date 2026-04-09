function elaboraCampionatoCostruttori(gpPassati, storicoClassifiche, pilotiCrudi) {
    console.group("Elaborazione Matrice Costruttori");
    console.time("Tempo elaborazione Costruttori");

    const classificaAttuale = storicoClassifiche[storicoClassifiche.length - 1];
    if (!classificaAttuale || classificaAttuale.length === 0) {
        console.warn("[WARN] Classifica attuale mancante o vuota.");
        console.groupEnd();
        return [];
    }

    const getPunti = (classifica, team_name) => {
        if (!classifica) return 0;
        const record = classifica.find(r => r.team_name === team_name);
        return record ? (record.points_current || record.points || 0) : 0;
    };

    let classificaOrdinata = [...classificaAttuale].sort((a, b) => (a.position || a.position_current) - (b.position || b.position_current));

    const datiFormattati = classificaOrdinata.map(recordAttuale => {
        const t_name = recordAttuale.team_name;
        const pilotaDelTeam = pilotiCrudi.find(p => p.team_name === t_name) || {};
        const coloreBordo = pilotaDelTeam.team_colour ? `#${pilotaDelTeam.team_colour}` : '#ccc';

        let riga = {
            "Pos.": `<b>${recordAttuale.position || recordAttuale.position_current}</b>`,
            "Scuderia": `<div style="border-left:4px solid ${coloreBordo}; padding-left:8px;"><b>${t_name}</b></div>`
        };

        for (let i = 0; i < gpPassati.length; i++) {
            const siglaNazione = gpPassati[i].country_code || "GP";
            const puntiFine = getPunti(storicoClassifiche[i], t_name);
            const puntiInizio = i === 0 ? 0 : getPunti(storicoClassifiche[i - 1], t_name);
            const puntiGuadagnati = Math.max(0, puntiFine - puntiInizio);

            riga[siglaNazione] = puntiGuadagnati > 0 ? `<b>${puntiGuadagnati}</b>` : `<span class="w3-text-grey">-</span>`;
        }

        riga["Totale"] = `<b class="w3-large w3-text-blue">${recordAttuale.points_current || recordAttuale.points}</b>`;
        return riga;
    });

    console.timeEnd("Tempo elaborazione Costruttori");
    console.groupEnd();
    return datiFormattati;
}

function elaboraCampionatoPiloti(sessioniPassate, storicoClassifiche, pilotiCrudi) {
    console.group("Elaborazione Matrice Piloti");
    console.time("Tempo elaborazione Piloti");

    const classificaAttuale = storicoClassifiche[storicoClassifiche.length - 1];
    if (!classificaAttuale || classificaAttuale.length === 0) {
        console.warn("[WARN] Classifica attuale mancante.");
        console.groupEnd();
        return [];
    }

    let classificaOrdinata = [...classificaAttuale].sort((a, b) => a.position_current - b.position_current);

    const datiFormattati = classificaOrdinata.map(recordAttuale => {
        const d_num = recordAttuale.driver_number;
        const pilotaInfo = pilotiCrudi.find(p => p.driver_number === d_num) || {};
        const coloreBordo = pilotaInfo.team_colour ? `#${pilotaInfo.team_colour}` : '#ccc';
        const imgHtml = pilotaInfo.headshot_url ? `<img src="${pilotaInfo.headshot_url}" style="width:30px; border-radius:50%; margin-right:10px; border:1px solid #ccc; background:#fff;">` : '';

        let riga = {
            "Pos.": `<b>${recordAttuale.position_current}</b>`,
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${pilotaInfo.broadcast_name || "Sconosciuto"}</b></div></div>`
        };

        let puntiPrecedenti = 0;
        sessioniPassate.forEach((sessione, i) => {
            let siglaNazione = sessione.country_code || "GP";
            let recordPilota = storicoClassifiche[i] ? storicoClassifiche[i].find(r => r.driver_number === d_num) : null;
            
            let puntiAttuali = recordPilota ? recordPilota.points_current : puntiPrecedenti;
            let puntiGuadagnati = Math.max(0, puntiAttuali - puntiPrecedenti);

            riga[siglaNazione] = puntiGuadagnati > 0 ? `<b>${puntiGuadagnati}</b>` : `<span class="w3-text-grey">-</span>`;
            puntiPrecedenti = puntiAttuali;
        });

        riga["Totale"] = `<b class="w3-large w3-text-blue">${recordAttuale.points_current}</b>`;
        return riga;
    });

    console.timeEnd("Tempo elaborazione Piloti");
    console.groupEnd();
    return datiFormattati;
}

async function gestisciSchedaClassifiche() {
    console.group("Gestione Scheda Classifiche");
    console.log("[INIT] Inizializzazione orchestratore classifiche...");

    const idMessaggio = document.getElementById("classifiche-messaggio");
    const idContenitore = document.getElementById("contenitore-tabelle-classifiche");
    
    if (!statoApp.chiaveGPCorrente || statoApp.tutteSessioniPuntiDellAnno.length === 0) {
        console.log("[INFO] Dati mancanti per l'avvio: GP non selezionato o sessioni assenti.");
        if (idMessaggio) idMessaggio.innerText = "Seleziona un Gran Premio in alto per caricare le classifiche.";
        if (idContenitore) idContenitore.style.display = 'none';
        console.groupEnd();
        return;
    }

    const indiceGPAttuale = statoApp.granPremiDellAnno.findIndex(gp => gp.valore == statoApp.chiaveGPCorrente);
    const chiaviGpFinoAdOggi = statoApp.granPremiDellAnno.slice(0, indiceGPAttuale + 1).map(gp => gp.valore);
    const sessioniPassate = statoApp.tutteSessioniPuntiDellAnno.filter(s => chiaviGpFinoAdOggi.includes(s.meeting_key));
    const cacheKey = `matrice_classifiche_dettaglio_${statoApp.chiaveGPCorrente}`;

    if (idMessaggio) idMessaggio.style.display = 'block';
    if (idContenitore) idContenitore.style.display = 'none';

    // CONTROLLO CACHE
    if (statoApp.cacheDati[cacheKey]) {
        console.info(`[CACHE] Trovata matrice campionato per [${cacheKey}]. Rendering immediato.`);
        const dati = statoApp.cacheDati[cacheKey];
        popolaTabellaDaJson("tabella-classifica-piloti", dati.piloti);
        popolaTabellaDaJson("tabella-classifica-costruttori", dati.team);
        
        if (idMessaggio) idMessaggio.style.display = 'none';
        if (idContenitore) idContenitore.style.display = 'block';
        console.groupEnd();
        return;
    }

    // DOWNLOAD E CALCOLO
    console.log(`[NETWORK] Dati non in cache. Avvio calcolo storico per ${sessioniPassate.length} sessioni...`);
    if (idMessaggio) idMessaggio.innerHTML = `⏳ Calcolo storico in corso... Analisi di ${sessioniPassate.length} sessioni. <br><span class="w3-tiny">Recupero dati in corso...</span>`;

    try {
        console.time("Download storico completo");
        const storicoPiloti = [];
        const storicoTeam = [];

        for (const sessione of sessioniPassate) {
            console.debug(`[NETWORK] Scaricando classifica per sessione: ${sessione.session_key}`);
            const [classP, classT] = await Promise.all([
                recuperaClassificaPiloti(sessione.session_key),
                recuperaClassificaCostruttori(sessione.session_key)
            ]);
            storicoPiloti.push(Array.isArray(classP) ? classP : []);
            storicoTeam.push(Array.isArray(classT) ? classT : []);
        }

        const ultimaSessione = sessioniPassate[sessioniPassate.length - 1];
        const pilotiCrudi = ultimaSessione ? await recuperaPiloti(ultimaSessione.session_key) : [];
        console.timeEnd("Download storico completo");

        // ELABORAZIONE
        console.log("[UI] Avvio elaborazione matrici...");
        const matricePiloti = elaboraCampionatoPiloti(sessioniPassate, storicoPiloti, pilotiCrudi);
        const matriceTeam = elaboraCampionatoCostruttori(sessioniPassate, storicoTeam, pilotiCrudi);

        // SALVATAGGIO CACHE
        statoApp.cacheDati[cacheKey] = { piloti: matricePiloti, team: matriceTeam };
        console.log(`[STORAGE] Matrici salvate in cache per [${cacheKey}].`);

        // DISEGNO
        popolaTabellaDaJson("tabella-classifica-piloti", matricePiloti);
        popolaTabellaDaJson("tabella-classifica-costruttori", matriceTeam);

        if (idMessaggio) idMessaggio.style.display = 'none';
        if (idContenitore) idContenitore.style.display = 'block';
        console.log("[SUCCESS] Classifiche storiche visualizzate correttamente.");

    } catch (errore) {
        console.error("[ERROR] Errore critico nel calcolo delle classifiche:", errore);
        if (idMessaggio) {
            idMessaggio.innerHTML = `<span class="w3-text-red">❌ Impossibile caricare lo storico. Superato limite richieste API o dati non disponibili.</span>`;
        }
    }

    console.groupEnd();
}