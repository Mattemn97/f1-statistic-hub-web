// js/main.js

/**
 * STATO GLOBALE DELL'APPLICAZIONE E CACHE
 */
const statoApp = {
    annoCorrente: null,
    chiaveGPCorrente: null,
    sessioniDelGPCorrente: {}, 
    cacheDati: {},
    granPremiDellAnno: [],
    tutteSessioniPuntiDellAnno: []
};


/**
 * PUNTO DI PARTENZA
 */
document.addEventListener("DOMContentLoaded", () => {
    console.log("🏁 Avvio F1 Situation Awareness (Cache e Anti-Spam Attivi)...");
    inizializzaApp();
    impostaAscoltatoriEventi();
});

// ==========================================
// INIZIALIZZAZIONE E GESTIONE EVENTI
// ==========================================

function inizializzaApp() {
    const anni = generaAnniSupportati(); 
    popolaSelectDaJson("select-anno", anni);

    const selectAnno = document.getElementById("select-anno");
    if (selectAnno && selectAnno.value) {
        statoApp.annoCorrente = selectAnno.value;
        caricaGranPremi(statoApp.annoCorrente);
    }
}

function impostaAscoltatoriEventi() {
    document.getElementById("select-anno").addEventListener("change", (evento) => {
        statoApp.annoCorrente = evento.target.value;
        caricaGranPremi(statoApp.annoCorrente);
    });

    document.getElementById("select-gp").addEventListener("change", (evento) => {
        statoApp.chiaveGPCorrente = evento.target.value;
        caricaSessioniGranPremio(statoApp.chiaveGPCorrente);
    });

    document.querySelectorAll(".tab-link").forEach(bottone => {
        bottone.addEventListener("click", (evento) => {
            const idSchedaDaAprire = evento.target.getAttribute("data-target");
            cambiaSchedaAttiva(evento.target, idSchedaDaAprire);
        });
    });
}

// ==========================================
// ORCHESTRAZIONE DATI 
// ==========================================

async function caricaGranPremi(anno) {
    const selectGp = document.getElementById("select-gp");
    selectGp.innerHTML = '<option value="">⏳ Caricamento GP...</option>';

    // 1. Scarica Gran Premi base
    const granPremiCrudi = await recuperaGranPremiPerAnno(anno);
    statoApp.granPremiDellAnno = formattaGranPremiPerSelect(granPremiCrudi);
    popolaSelectDaJson("select-gp", statoApp.granPremiDellAnno);
    
    // 2. Scarica la timeline di TUTTE le sessioni dell'anno (Filtra solo Sprint e Gare)
    const tutteSessioniCrude = await recuperaTutteSessioniPerAnno(anno);
    statoApp.tutteSessioniPuntiDellAnno = tutteSessioniCrude
        .filter(s => {
            const nome = s.session_name.toLowerCase();
            return nome === "race" || (nome.includes("sprint") && !nome.includes("shootout") && !nome.includes("qualifying"));
        })
        .sort((a, b) => new Date(a.date_start) - new Date(b.date_start)); // Ordine cronologico
    
    statoApp.sessioniDelGPCorrente = {};
    statoApp.cacheDati = {}; 
}

async function caricaSessioniGranPremio(chiaveGP) {
    const sessioniCrude = await recuperaSessioniPerGranPremio(chiaveGP);
    statoApp.sessioniDelGPCorrente = elaboraSessioniDisponibili(sessioniCrude);

    // Svuota la cache globale al cambio di GP
    statoApp.cacheDati = {}; 
    console.log("🧹 Cache svuotata per il nuovo Gran Premio.");

    const bottoneClassifiche = document.querySelector('[data-target="scheda-classifiche"]');
    if (bottoneClassifiche) bottoneClassifiche.click();
}

async function cambiaSchedaAttiva(bottoneCliccato, idScheda) {
    aggiornaInterfacciaSchede(bottoneCliccato, idScheda);

    if (idScheda === "scheda-classifiche") {
        await gestisciSchedaClassifiche();
    } else if (idScheda === "scheda-libere1") {
        await gestisciSchedaProveLibere("Practice 1", "libere1");
    } else if (idScheda === "scheda-libere2") {
        await gestisciSchedaProveLibere("Practice 2", "libere2");
    } else if (idScheda === "scheda-libere3") {
        await gestisciSchedaProveLibere("Practice 3", "libere3");
    }else if (idScheda === "scheda-sprint-quali") {
        await gestisciSchedaQualifiche("Sprint", "sprint-quali");
    }else if (idScheda === "scheda-quali") {
        await gestisciSchedaQualifiche("Qualifiche", "quali");
    } else if (idScheda === "scheda-sprint-gara") {
        await gestisciSchedaGara("Sprint", "sprint-gara");
    } else if (idScheda === "scheda-gara") {
        await gestisciSchedaGara("Normale", "gara");
    } else if (idScheda === "scheda-strategie") {
        await gestisciSchedaStrategie();
    }
}

/**
 * Orchestratore per le Classifiche: Genera la Matrice analitica per ogni singola sessione.
 */
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

/**
 * Orchestratore specifico per le tabelle delle Prove Libere
 * CON CACHE E GESTIONE ANTI RATE-LIMIT (429)
 */
async function gestisciSchedaProveLibere(nomeSessioneAPI, suffissoId) {
    const chiaveSessione = statoApp.sessioniDelGPCorrente[nomeSessioneAPI];
    const idTabella = `tabella-${suffissoId}`;
    const tabellaDOM = document.getElementById(idTabella);

    if (chiaveSessione) {
        mostraContenitoreDati(`scheda-${suffissoId}`, true);
        
        // ⚡ 1. CONTROLLO CACHE GLOBALE (Nessuna chiamata API se abbiamo già i dati)
        if (statoApp.cacheDati[chiaveSessione]) {
            console.log(`⚡ Dati per [${nomeSessioneAPI}] caricati ISTATANEAMENTE dalla cache globale!`);
            const datiSalvati = statoApp.cacheDati[chiaveSessione];
            const datiFormattati = elaboraRisultatiProveLibere(datiSalvati.piloti, datiSalvati.giri, datiSalvati.stint);
            popolaTabellaDaJson(idTabella, datiFormattati);
            return; 
        }

        // 📥 2. SCARICA E SALVA (Con Timer per non saturare la banda)
        if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-padding-16'>⏳ Download dati telemetria... (per evitare sovraccarichi, l'operazione richiede qualche secondo)</td></tr>";

        try {
            // Prima chiamata: Piloti
            const pilotiCrudi = await recuperaPiloti(chiaveSessione);

            // Seconda chiamata (pesante): Giri
            const giriCrudi = await recuperaGiri(chiaveSessione);
            
            // Terza chiamata: Gomme
            const stintCrudi = await recuperaStintGomme(chiaveSessione);

            // Salvataggio in cache
            statoApp.cacheDati[chiaveSessione] = {
                piloti: pilotiCrudi,
                giri: giriCrudi,
                stint: stintCrudi
            };
            console.log(`📥 Dati per [${nomeSessioneAPI}] scaricati in sicurezza e salvati in cache.`);

            // Elaborazione e disegno
            const datiFormattati = elaboraRisultatiProveLibere(pilotiCrudi, giriCrudi, stintCrudi);
            popolaTabellaDaJson(idTabella, datiFormattati);

        } catch (errore) {
            console.error(`Errore durante l'elaborazione di ${nomeSessioneAPI}:`, errore);
            if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-text-red w3-padding-16'>❌ Impossibile caricare i dati. Il server OpenF1 potrebbe essere irraggiungibile.</td></tr>";
        }

    } else {
        mostraContenitoreDati(`scheda-${suffissoId}`, false);
    }
}

/**
 * Orchestratore per la gestione delle Qualifiche (Standard o Sprint).
 * Include il sistema di Cache Globale e Anti-Spam.
 */
async function gestisciSchedaQualifiche(tipoQualifica, suffissoId) {
    // OpenF1 usa nomi diversi a seconda dell'anno ("Sprint Shootout" o "Sprint Qualifying")
    let chiaveSessione = null;
    if (tipoQualifica === "Sprint") {
        chiaveSessione = statoApp.sessioniDelGPCorrente["Sprint Shootout"] || statoApp.sessioniDelGPCorrente["Sprint Qualifying"];
    } else {
        chiaveSessione = statoApp.sessioniDelGPCorrente["Qualifying"];
    }

    const idTabella = `tabella-${suffissoId}`;
    const tabellaDOM = document.getElementById(idTabella);

    if (chiaveSessione) {
        mostraContenitoreDati(`scheda-${suffissoId}`, true);
        
        // ⚡ CACHE
        if (statoApp.cacheDati[chiaveSessione]) {
            console.log(`⚡ Dati Qualifiche caricati ISTATANEAMENTE dalla cache globale!`);
            const datiSalvati = statoApp.cacheDati[chiaveSessione];
            const datiFormattati = elaboraRisultatiQualifiche(datiSalvati.piloti, datiSalvati.giri, datiSalvati.stint);
            popolaTabellaDaJson(idTabella, datiFormattati);
            return; 
        }

        if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-padding-16'>⏳ Analisi dei micro-settori e calcolo Ideal Lap in corso...</td></tr>";

        // 📥 DOWNLOAD SICURO
        try {
            const pilotiCrudi = await recuperaPiloti(chiaveSessione);
            await attendi(500); 
            const giriCrudi = await recuperaGiri(chiaveSessione);
            await attendi(500); 
            const stintCrudi = await recuperaStintGomme(chiaveSessione);

            statoApp.cacheDati[chiaveSessione] = {
                piloti: pilotiCrudi,
                giri: giriCrudi,
                stint: stintCrudi
            };

            const datiFormattati = elaboraRisultatiQualifiche(pilotiCrudi, giriCrudi, stintCrudi);
            popolaTabellaDaJson(idTabella, datiFormattati);

        } catch (errore) {
            console.error(`Errore durante le Qualifiche:`, errore);
            if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-text-red w3-padding-16'>❌ Impossibile caricare i dati della Qualifica.</td></tr>";
        }

    } else {
        mostraContenitoreDati(`scheda-${suffissoId}`, false);
    }
}

/**
 * Orchestratore per la Gara (Standard o Sprint).
 * Identico flusso strutturale delle altre schede, ma chiama l'elaborazione specifica della Gara.
 */
async function gestisciSchedaGara(tipoGara, suffissoId) {
    let chiaveSessione = null;
    if (tipoGara === "Sprint") {
        chiaveSessione = statoApp.sessioniDelGPCorrente["Sprint"];
    } else {
        chiaveSessione = statoApp.sessioniDelGPCorrente["Race"];
    }

    const idTabella = `tabella-${suffissoId}`;
    const tabellaDOM = document.getElementById(idTabella);

    if (chiaveSessione) {
        mostraContenitoreDati(`scheda-${suffissoId}`, true);
        
        // ⚡ CACHE GLOBALE
        if (statoApp.cacheDati[chiaveSessione]) {
            console.log(`⚡ Dati Gara caricati ISTATANEAMENTE dalla cache!`);
            const datiSalvati = statoApp.cacheDati[chiaveSessione];
            const datiFormattati = elaboraRisultatiGara(datiSalvati.piloti, datiSalvati.giri, datiSalvati.stint);
            popolaTabellaDaJson(idTabella, datiFormattati);
            return; 
        }

        if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-padding-16'>⏳ Elaborazione dei distacchi e delle strategie gomme in corso...</td></tr>";

        // 📥 DOWNLOAD SICURO (Con Timer Anti-429)
        try {
            const pilotiCrudi = await recuperaPiloti(chiaveSessione);
            await attendi(500); 
            const giriCrudi = await recuperaGiri(chiaveSessione);
            await attendi(500); 
            const stintCrudi = await recuperaStintGomme(chiaveSessione);

            statoApp.cacheDati[chiaveSessione] = {
                piloti: pilotiCrudi,
                giri: giriCrudi,
                stint: stintCrudi
            };

            const datiFormattati = elaboraRisultatiGara(pilotiCrudi, giriCrudi, stintCrudi);
            popolaTabellaDaJson(idTabella, datiFormattati);

        } catch (errore) {
            console.error(`Errore durante la Gara:`, errore);
            if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-text-red w3-padding-16'>❌ Impossibile caricare i dati della Gara. Assicurati che l'evento sia concluso.</td></tr>";
        }

    } else {
        mostraContenitoreDati(`scheda-${suffissoId}`, false);
    }
}

/**
 * Orchestratore per la visualizzazione grafica delle Strategie Gomme.
 * Usa i dati della Gara (o Sprint se la gara non c'è ancora).
 */
async function gestisciSchedaStrategie() {
    // Prova a prendere la Gara, se non c'è prova la Sprint
    let chiaveSessione = statoApp.sessioniDelGPCorrente["Race"] || statoApp.sessioniDelGPCorrente["Sprint"];
    const idTabella = "tabella-strategie";
    const tabellaDOM = document.getElementById(idTabella);

    if (chiaveSessione) {
        mostraContenitoreDati("scheda-strategie", true);
        
        // ⚡ CACHE GLOBALE
        if (statoApp.cacheDati[chiaveSessione]) {
            console.log('⚡ Dati Strategie caricati ISTATANEAMENTE dalla cache!');
            const datiSalvati = statoApp.cacheDati[chiaveSessione];
            const datiFormattati = elaboraStrategieGomme(datiSalvati.piloti, datiSalvati.giri, datiSalvati.stint);
            popolaTabellaDaJson(idTabella, datiFormattati);
            return; 
        }

        if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-padding-16'>⏳ Generazione della matrice strategica in corso...</td></tr>";

        // 📥 DOWNLOAD SICURO
        try {
            const pilotiCrudi = await recuperaPiloti(chiaveSessione);
            await attendi(500); 
            const giriCrudi = await recuperaGiri(chiaveSessione);
            await attendi(500); 
            const stintCrudi = await recuperaStintGomme(chiaveSessione);

            statoApp.cacheDati[chiaveSessione] = { piloti: pilotiCrudi, giri: giriCrudi, stint: stintCrudi };

            const datiFormattati = elaboraStrategieGomme(pilotiCrudi, giriCrudi, stintCrudi);
            popolaTabellaDaJson(idTabella, datiFormattati);

        } catch (errore) {
            console.error('Errore durante il caricamento delle strategie:', errore);
            if (tabellaDOM) tabellaDOM.innerHTML = "<tr><td class='w3-center w3-text-red w3-padding-16'>❌ Impossibile caricare le strategie.</td></tr>";
        }

    } else {
        mostraContenitoreDati("scheda-strategie", false);
    }
}