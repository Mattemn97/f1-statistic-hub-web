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



async function gestisciSchedaStrategie() {
    console.group("Gestione Scheda Strategie Gomme");
    console.log("[INIT] Inizializzazione orchestratore...");

    const chiaveSessioneGaraSprint = statoApp.sessioniDelGPCorrente["Sprint"];
    const chiaveSessioneGara = statoApp.sessioniDelGPCorrente["Race"];

    const idTabellaGaraSprint = `tabella-strategie-gomme-sprint-gara`;
    const idTabellaGara = `tabella-strategie-gomme-gara`;
    
    const idContenitoreGaraSprint = `contenitore-dati-strategie-gomme-sprint-gara`;
    const idContenitoreGara = `contenitore-dati-strategie-gomme-gara`;

    const idAvvisoGaraSprint = `avviso-assenza-strategie-gomme-passo-sprint-gara`;
    const idAvvisoGara = `avviso-assenza-strategie-gomme-passo-gara`;

    const lista_nomeSessioni = ["Sprint", "Race"];
    const lista_chiaviSessioni = [ chiaveSessioneGaraSprint, chiaveSessioneGara];
    const lista_idTabelle = [ idTabellaGaraSprint, idTabellaGara];
    const lista_idContenitori = [ idContenitoreGaraSprint, idContenitoreGara];
    const lista_idAvvisi = [ idAvvisoGaraSprint, idAvvisoGara];

    for (let i = 0; i < lista_chiaviSessioni.length; i++) {
        const nomeSessione = lista_nomeSessioni[i];
        const chiaveSessione = lista_chiaviSessioni[i];
        const idTabella = lista_idTabelle[i];
        const tabellaDOM = document.getElementById(idTabella);
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
                const datiFormattati = elaboraStrategieGomme(datiSalvati.piloti, datiSalvati.giri, datiSalvati.stint);

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

                const stintCrudi = await recuperaStintGomme(chiaveSessione);
                console.log("[NETWORK] Dati stint gomme scaricati con successo.");              
                
                console.timeEnd(`Download dati ${chiaveSessione}`);

                statoApp.cacheDati[chiaveSessione] = {
                    piloti: pilotiCrudi,
                    giri: giriCrudi,
                    stint: stintCrudi
                };

                // ATTENZIONE: Ordine dei parametri ripristinato in modo standard
                const datiFormattati = elaboraStrategieGomme(pilotiCrudi, giriCrudi, stintCrudi);
                if (tabellaDOM) popolaTabellaDaJson(idTabella, datiFormattati); // Estratto l'array matriceTabella
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
