/**
 * Crea la matrice completa del campionato costruttori.
 */
function elaboraMatriceCampionatoCostruttori(gpPassati, storicoClassifiche, pilotiCrudi) {
    const classificaAttuale = storicoClassifiche[storicoClassifiche.length - 1];
    if (!classificaAttuale || classificaAttuale.length === 0) return [];

    const getPunti = (classifica, team_name) => {
        if (!classifica) return 0;
        const record = classifica.find(r => r.team_name === team_name);
        // Usiamo points_current per coerenza con lo storico dei round
        return record ? (record.points_current || record.points || 0) : 0;
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

        // Ciclo sulle sessioni passate (Sprint o Gare)
        for (let i = 0; i < gpPassati.length; i++) {
            const sessione = gpPassati[i];
            
            // FIX: Usiamo country_code e tipo sessione come nell'altra funzione
            const siglaNazione = sessione.country_code || "GP"; 
            const nomeColonna = `${siglaNazione}`;

            const puntiFine = getPunti(storicoClassifiche[i], t_name);
            const puntiInizio = i === 0 ? 0 : getPunti(storicoClassifiche[i - 1], t_name);
            const puntiGuadagnati = puntiFine - puntiInizio;
            
            // Evitiamo numeri negativi in caso di ricalcoli strani delle classifiche
            const puntiVisualizzati = puntiGuadagnati > 0 ? puntiGuadagnati : 0;

            riga[nomeColonna] = puntiVisualizzati > 0 ? `<b>${puntiVisualizzati}</b>` : `<span class="w3-text-grey">-</span>`;
        }

        riga["Totale"] = `<b class="w3-large w3-text-blue">${recordAttuale.points_current || recordAttuale.points}</b>`;
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
            "Pilota": `<div style="display:flex; align-items:center; border-left:4px solid ${coloreBordo}; padding-left:8px;">${imgHtml}<div><b>${pilotaInfo.broadcast_name || "Sconosciuto"}</b></div></div>`
        };

        let puntiPrecedenti = 0;

        // Colonne Dinamiche: Punti e POSIZIONE DI QUELLA SESSIONE
        sessioniPassate.forEach((sessione, i) => {
            let siglaNazione = sessione.country_code || "GP";
            let nomeColonna = `${siglaNazione}`;

            let classificaDiQuestaSessione = storicoClassifiche[i];
            let recordPilota = classificaDiQuestaSessione ? classificaDiQuestaSessione.find(r => r.driver_number === d_num) : null;
            
            let puntiAttuali = recordPilota ? recordPilota.points_current : puntiPrecedenti;
            let puntiGuadagnati = puntiAttuali - puntiPrecedenti;
            if (puntiGuadagnati < 0) puntiGuadagnati = 0;


            // Formattazione: Punti (Posizione d'arrivo)
            if (puntiGuadagnati > 0) {
                riga[nomeColonna] = `<b>${puntiGuadagnati}</b>`;
            } else {
                riga[nomeColonna] = `<span class="w3-text-grey">-</span>`;
            }
            
            puntiPrecedenti = puntiAttuali;
        });

        riga["Totale"] = `<b class="w3-large w3-text-blue">${recordAttuale.points_current}</b>`;
        return riga;
    });
}

async function gestisciSchedaClassifiche() {
    const idMessaggio = document.getElementById("classifiche-messaggio");
    const idContenitore = document.getElementById("contenitore-tabelle-classifiche");
    
    if (!statoApp.chiaveGPCorrente || statoApp.tutteSessioniPuntiDellAnno.length === 0) {
        if (idMessaggio) idMessaggio.innerText = "Seleziona un Gran Premio in alto per caricare le classifiche.";
        if (idContenitore) idContenitore.style.display = 'none';
        return;
    }

    // 1. Trova tutte le Sprint/Gare avvenute DALL'INIZIO DELL'ANNO FINO AL GP SELEZIONATO
    const indiceGPAttuale = statoApp.granPremiDellAnno.findIndex(gp => gp.valore == statoApp.chiaveGPCorrente);
    const chiaviGpFinoAdOggi = statoApp.granPremiDellAnno.slice(0, indiceGPAttuale + 1).map(gp => gp.valore);
    
    // Estraiamo solo le sessioni che appartengono a questi Gran Premi
    const sessioniPassate = statoApp.tutteSessioniPuntiDellAnno.filter(s => chiaviGpFinoAdOggi.includes(s.meeting_key));

    const cacheKey = `matrice_classifiche_dettaglio_${statoApp.chiaveGPCorrente}`;

    if (idMessaggio) idMessaggio.style.display = 'block';
    if (idContenitore) idContenitore.style.display = 'none';

    // ⚡ 2. CONTROLLO CACHE GLOBALE
    if (statoApp.cacheDati[cacheKey]) {
        console.log("⚡ Matrice Campionato Dettagliata caricata ISTATANEAMENTE dalla cache!");
        const dati = statoApp.cacheDati[cacheKey];
        popolaTabellaDaJson("tabella-classifica-piloti", dati.piloti);
        popolaTabellaDaJson("tabella-classifica-costruttori", dati.team);
        if (idMessaggio) idMessaggio.style.display = 'none';
        if (idContenitore) idContenitore.style.display = 'block';
        return;
    }

    // 📥 3. DOWNLOAD PROGRESSIVO
    if (idMessaggio) idMessaggio.innerHTML = `⏳ Calcolo storico in corso... Analisi di ${sessioniPassate.length} sessioni (Sprint e Gare). <br><span class="w3-tiny">Questa operazione scarica la storia dell'intero campionato, attendere qualche secondo...</span>`;

    try {
        const storicoPiloti = [];
        const storicoTeam = [];

        // Cicliamo ogni sessione passata per costruire la cronologia dei punti
        for (const sessione of sessioniPassate) {
            let classP = await eseguiRichiestaGenerica("/championship_drivers", `session_key=${sessione.session_key}`);
            await attendi(150); // Pausa rapida
            let classT = await eseguiRichiestaGenerica("/championship_teams", `session_key=${sessione.session_key}`);
            await attendi(150); 
            
            // In caso di errore API su una sessione, pushiamo un array vuoto, il Cuoco sa come gestirlo!
            storicoPiloti.push(Array.isArray(classP) ? classP : []);
            storicoTeam.push(Array.isArray(classT) ? classT : []);
        }

        // Recuperiamo le foto dei piloti dall'ultima sessione nota
        const ultimaSessione = sessioniPassate[sessioniPassate.length - 1];
        const pilotiCrudi = ultimaSessione ? await recuperaPiloti(ultimaSessione.session_key) : [];

        // 4. ELABORAZIONE MATRICE
        const matricePiloti = elaboraMatriceCampionatoPiloti(sessioniPassate, storicoPiloti, pilotiCrudi);
        const matriceTeam = elaboraMatriceCampionatoCostruttori(sessioniPassate, storicoTeam, pilotiCrudi);

        // Salva in Cache
        statoApp.cacheDati[cacheKey] = { piloti: matricePiloti, team: matriceTeam };

        // 5. DISEGNO A SCHERMO
        popolaTabellaDaJson("tabella-classifica-piloti", matricePiloti);
        popolaTabellaDaJson("tabella-classifica-costruttori", matriceTeam);

        if (idMessaggio) idMessaggio.style.display = 'none';
        if (idContenitore) idContenitore.style.display = 'block';

    } catch (e) {
        console.error("Errore generazione matrice campionato:", e);
        if (idMessaggio) {
            idMessaggio.style.display = 'block';
            idMessaggio.innerHTML = `<span class="w3-text-red">❌ Impossibile caricare lo storico. Il server ha bloccato troppe richieste o i dati non sono disponibili.</span>`;
        }
    }
}