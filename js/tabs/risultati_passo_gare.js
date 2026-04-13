/**
 * Genera la Matrice Tabellare (Giri x Piloti) e prepara i dati per l'UI.
 * Richiede i dati grezzi e le funzioni di utilità da utils.js.
 */
function elaboraAnalisiPasso(pilotiCrudi, giriCrudi, direzioneCrudi, stintCrudi) {
    if (!giriCrudi || giriCrudi.length === 0 || !pilotiCrudi) {
        return { matriceTabella: [], zoneSfondoGrafico: [], pilotiValidi: [] };
    }

    let maxLaps = 0;
    let bestPersonali = {};
    let pilotiValidi = [];
    let statsPiloti = {}; 

    // 1. Inizializzazione Piloti e Statistiche Base
    pilotiCrudi.forEach(p => {
        // Estraiamo solo i giri con un tempo valido per il pilota
        let giriPilota = giriCrudi.filter(g => g.driver_number === p.driver_number && g.lap_duration);
        
        if (giriPilota.length > 0) {
            pilotiValidi.push(p);
            
            // Trova il Personal Best assoluto (PB) usando calcoli diretti
            let pb = Math.min(...giriPilota.map(g => g.lap_duration));
            bestPersonali[p.driver_number] = pb;
            
            // Aggiorna il numero massimo di giri per impostare le righe della tabella
            let maxGiroPilota = Math.max(...giriPilota.map(g => g.lap_number));
            if (maxGiroPilota > maxLaps) maxLaps = maxGiroPilota;

            // Salva stats per l'ordinamento
            statsPiloti[p.driver_number] = {
                giri_fatti: giriPilota.length,
                tempo_totale: giriPilota.reduce((acc, curr) => acc + curr.lap_duration, 0)
            };
        }
    });

    // 2. Ordinamento Piloti (Il vincitore/leader a sinistra, DNF a destra)
    pilotiValidi.sort((a, b) => {
        let statA = statsPiloti[a.driver_number];
        let statB = statsPiloti[b.driver_number];
        if (statB.giri_fatti !== statA.giri_fatti) return statB.giri_fatti - statA.giri_fatti;
        return statA.tempo_totale - statB.tempo_totale;
    });

    let matriceTabella = [];
    let zoneSfondoGrafico = [];
    let ultimoTempoRegistrato = {}; 

    // 3. Costruzione Matrice Riga per Riga
    for (let giroNum = 1; giroNum <= maxLaps; giroNum++) {
        let riga = { "Giro": `<b>${giroNum}</b>` };
        
        // Calcolo stato della pista basato sulla timeline del leader
        let leader = pilotiValidi[0];
        let giroRiferimento = giriCrudi.find(g => g.driver_number === leader.driver_number && g.lap_number === giroNum && g.date_start);
        
        let statoPista = { stato: "🟢", coloreSfondo: "transparent" };
        if (giroRiferimento) {
            let inizioMs = new Date(giroRiferimento.date_start).getTime();
            let fineMs = inizioMs + (giroRiferimento.lap_duration * 1000 || 90000);
            statoPista = calcolaStatoPistaGiro(inizioMs, fineMs, direzioneCrudi);
        }

        riga["Stato Pista"] = statoPista.stato;
        if (statoPista.coloreSfondo !== "transparent") {
            zoneSfondoGrafico.push({ daGiro: giroNum, aGiro: giroNum + 1, colore: statoPista.coloreSfondo });
        }

        // 4. Riempimento Colonne Piloti
        pilotiValidi.forEach(p => {
            let numPilota = p.driver_number;
            let chiaveColonna = p.name_acronym || numPilota;
            let giroPilota = giriCrudi.find(g => g.driver_number === numPilota && g.lap_number === giroNum);
            
            if (giroPilota && giroPilota.lap_duration) {
                let tempoAttuale = giroPilota.lap_duration;
                let tempoFormat = formattaTempo(tempoAttuale); // Da utils.js
                
                // Ricava l'icona della gomma usando la funzione Helper e utils.js
                let mescola = trovaMescolaGiro(stintCrudi, numPilota, giroNum);
                let infoGomma = ottieniInfoGomma(mescola); // Da utils.js
                let htmlGomma = `<span title="${mescola}" style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${infoGomma.coloreBase}; border:1px solid #666; margin-right:5px; vertical-align:middle; text-align:center; font-size:8px; line-height:11px; color:${infoGomma.coloreTesto}; font-weight:bold;">${infoGomma.lettera}</span>`;

                // Logica Colori Tempi
                let stileTesto = "";
                if (tempoAttuale === bestPersonali[numPilota]) {
                    stileTesto = 'color:#b92df7; font-weight:bold;'; // Viola (Personal Best)
                } else if (ultimoTempoRegistrato[numPilota] && tempoAttuale < ultimoTempoRegistrato[numPilota]) {
                    stileTesto = 'color:#39b54a; font-weight:bold;'; // Verde (Miglioramento)
                }

                // Generazione cella
                riga[chiaveColonna] = `<div style="white-space:nowrap;">${htmlGomma}<span style="${stileTesto}">${tempoFormat}</span></div>`;

                // Aggiorna il tempo in memoria per il confronto del giro successivo
                ultimoTempoRegistrato[numPilota] = tempoAttuale;
            } else {
                riga[chiaveColonna] = `<span class="w3-text-grey">-</span>`;
            }
        });

        matriceTabella.push(riga);
    }

    return { matriceTabella, zoneSfondoGrafico, pilotiValidi };
}

/**
 * Orchestratore per il Passo Gara (Standard o Sprint).
 * Strutturalmente allineato alla scheda Gare principale.
 */
async function gestisciSchedaPasso() {
    console.group("Gestione Scheda Passo Gare");
    console.log("[INIT] Inizializzazione orchestratore...");

    const chiaveSessioneGaraSprint = statoApp.sessioniDelGPCorrente["Sprint"];
    const chiaveSessioneGara = statoApp.sessioniDelGPCorrente["Race"];

    const idTabellaGaraSprint = `tabella-passo-sprint-gara`;
    const idTabellaGara = `tabella-passo-gara`;

    const idStringaMeteoGaraSprint = `dati-meteo-passo-sprint-gara`;
    const idStringaMeteoGara = `dati-meteo-passo-gara`;
    
    const idContenitoreGaraSprint = `contenitore-dati-passo-sprint-gara`;
    const idContenitoreGara = `contenitore-dati-passo-gara`;

    const idAvvisoGaraSprint = `avviso-assenza-passo-sprint-gara`;
    const idAvvisoGara = `avviso-assenza-passo-gara`;

    const lista_nomeSessioni = ["Sprint", "Race"];
    const lista_chiaviSessioni = [ chiaveSessioneGaraSprint, chiaveSessioneGara];
    const lista_idTabelle = [ idTabellaGaraSprint, idTabellaGara];
    const lista_idStringheMeteo = [ idStringaMeteoGaraSprint, idStringaMeteoGara];
    const lista_idContenitori = [ idContenitoreGaraSprint, idContenitoreGara];
    const lista_idAvvisi = [ idAvvisoGaraSprint, idAvvisoGara];

    for (let i = 0; i < lista_chiaviSessioni.length; i++) {
        const nomeSessione = lista_nomeSessioni[i];
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
                // ATTENZIONE: Passaggio corretto dei parametri (piloti, giri, direzioneGara, stint)
                const datiFormattati = elaboraAnalisiPasso(datiSalvati.piloti, datiSalvati.giri, datiSalvati.direzioneGara, datiSalvati.stint);

                if (stringaMeteo) popolaStringaMeteo(stringaMeteo, datiSalvati.meteo);
                // Puntare a .matriceTabella poiché la funzione restituisce un oggetto composito
                if (tabellaDOM) popolaTabellaDaJson(idTabella, datiFormattati.matriceTabella);
                
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

                const direzioneCrudi = await recuperaDirezioneGara(chiaveSessione);
                console.log("[NETWORK] Dati direzione gara scaricati con successo.");                
                
                console.timeEnd(`Download dati ${chiaveSessione}`);

                statoApp.cacheDati[chiaveSessione] = {
                    piloti: pilotiCrudi,
                    giri: giriCrudi,
                    stint: stintCrudi,
                    meteo: meteocrudo,
                    direzioneGara: direzioneCrudi
                };

                // ATTENZIONE: Ordine dei parametri ripristinato in modo standard
                const datiFormattati = elaboraAnalisiPasso(pilotiCrudi, giriCrudi, direzioneCrudi, stintCrudi);
                if (stringaMeteo) popolaStringaMeteo(stringaMeteo, meteocrudo);
                if (tabellaDOM) popolaTabellaDaJson(idTabella, datiFormattati.matriceTabella); // Estratto l'array matriceTabella
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