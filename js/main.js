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
    console.log("Avvio applicazione..");
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

    document.getElementById("select-sessione-confronto-qualifica").addEventListener("change", () => gestisciSchedaConfrontoQualifica(false));
    document.getElementById("select-pilota-a-qualifica").addEventListener("change", () => gestisciSchedaConfrontoQualifica(true));
    document.getElementById("select-pilota-b-qualifica").addEventListener("change", () => gestisciSchedaConfrontoQualifica(true));

    document.getElementById("select-sessione-confronto-passo").addEventListener("change", () => gestisciSchedaConfrontoPasso(false));
    document.getElementById("select-pilota-a-passo").addEventListener("change", () => gestisciSchedaConfrontoPasso(true));
    document.getElementById("select-pilota-b-passo").addEventListener("change", () => gestisciSchedaConfrontoPasso(true));

    document.getElementById("select-pilota-passo-sprint").addEventListener("change", () => gestisciSchedaPasso("Sprint", "passo-sprint", true));
    document.getElementById("select-pilota-passo-gara").addEventListener("change", () => gestisciSchedaPasso("Normale", "passo-gara", true));

    document.getElementById("select-riassunto-pilota").addEventListener("change", () => gestisciSchedaRiassuntoWeekend(true));

    document.getElementById("btn-stampa").addEventListener("click", scaricaSchedaAttivaComePng);
    document.getElementById("select-sessione-giri").addEventListener("change", () => inizializzaSchedaGiri());
    document.getElementById("select-pilota-a-giri").addEventListener("change", () => popolaTendinaGiri('a'));
    document.getElementById("select-pilota-b-giri").addEventListener("change", () => popolaTendinaGiri('b'));
    // Trigger automatico scaricamento quando si cambia giro
    document.getElementById("select-giro-a").addEventListener("change", () => eseguiConfrontoGiri());
    document.getElementById("select-giro-b").addEventListener("change", () => eseguiConfrontoGiri());
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

/**
 * Scarica le sessioni del GP selezionato, le salva nello stato e popola le tendine secondarie.
 */
async function caricaSessioniGranPremio(chiaveGP) {
    const sessioniCrude = await recuperaSessioniPerGranPremio(chiaveGP);
    statoApp.sessioniDelGPCorrente = elaboraSessioniDisponibili(sessioniCrude);

    // 🧹 Svuota la cache globale per il nuovo GP
    statoApp.cacheDati = {}; 
    statoApp.chiaveMeteoCorrente = null;

    // Convertiamo il dizionario {"Race": 123, "Practice 1": 456} in array per il nostro graph.js
    const arraySessioni = Object.entries(statoApp.sessioniDelGPCorrente).map(([nome, chiave]) => {
        return { testo: nome, valore: chiave };
    });
    popolaSelectDaJson("select-sessione-meteo", arraySessioni);
    popolaSelectDaJson("select-sessione-radio", arraySessioni);
}

async function cambiaSchedaAttiva(bottoneCliccato, idScheda) {
    aggiornaInterfacciaSchede(bottoneCliccato, idScheda);

    if (idScheda === "scheda-classifiche") {
        await gestisciSchedaClassifiche();
    } else if (idScheda === "scheda-prove-libere") {
        await gestisciSchedaProveLibere();
    }else if (idScheda === "scheda-qualifiche") {
        await gestisciSchedaQualifiche();
    } else if (idScheda === "scheda-gare") {
        await gestisciSchedaGara();
    } else if (idScheda === "scheda-strategie") {
        await gestisciSchedaStrategie();
    } else if (idScheda === "scheda-radio") {
        await gestisciSchedaTeamRadio(false);
    } else if (idScheda === "scheda-riassunto") {
        await gestisciSchedaRiassuntoWeekend(false);
    } else if (idScheda === "scheda-passo-sprint") {
        await gestisciSchedaPasso("Sprint", "passo-sprint", false);
    } else if (idScheda === "scheda-passo-gara") {
        await gestisciSchedaPasso("Normale", "passo-gara", false);
    } else if (idScheda === "scheda-confronto-passo") {
        await gestisciSchedaConfrontoPasso(false); 
    } else if (idScheda === "scheda-confronto-qualifica") {
        await gestisciSchedaConfrontoQualifica(false);
    } else if (idScheda === "scheda-confronto-giri") {
        await inizializzaSchedaGiri();
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

/**
 * Orchestratore per il Riassunto del Weekend.
 * Aggrega in un'unica vista tutti i dati di FP, Qualifiche e Gara calcolati precedentemente.
 */
async function gestisciSchedaRiassuntoWeekend(soloFiltro = false) {
    const selectPilota = document.getElementById("select-riassunto-pilota");
    let numeroPilota = selectPilota ? selectPilota.value : null;

    const contenitoreDati = document.getElementById("riassunto-dati-container");
    const messaggioLoading = document.getElementById("messaggio-caricamento-riassunto");

    // Per popolare la tendina iniziale e l'identikit, ci serve l'elenco dei piloti da una sessione qualsiasi
    const chiaveBase = statoApp.sessioniDelGPCorrente["Race"] || statoApp.sessioniDelGPCorrente["Qualifying"] || statoApp.sessioniDelGPCorrente["Practice 1"];
    if (!chiaveBase) return;

    if (!soloFiltro) {
        contenitoreDati.style.display = 'none';
        messaggioLoading.style.display = 'block';
    }

    try {
        // 1. Popola la tendina se è la prima apertura
        let pilotiBase = statoApp.cacheDati[chiaveBase] ? statoApp.cacheDati[chiaveBase].piloti : await recuperaPiloti(chiaveBase);
        if (!soloFiltro || !numeroPilota) {
            let opzioniPiloti = pilotiBase.map(p => ({ testo: p.broadcast_name, valore: p.driver_number }));
            opzioniPiloti.sort((a,b) => a.testo.localeCompare(b.testo));
            popolaSelectDaJson("select-riassunto-pilota", opzioniPiloti);
            numeroPilota = opzioniPiloti[0].valore;
            selectPilota.value = numeroPilota;
        }

        // Disegna Identikit
        document.getElementById("riassunto-identikit").innerHTML = elaboraIdentikitPilota(numeroPilota, pilotiBase);

        // 2. FUNZIONE HELPER: Scarica e calcola una specifica sessione "dietro le quinte"
        async function estraiRigaPilota(nomeAPI, tipoElaborazione, nomeVisualizzato) {
            const chiave = statoApp.sessioniDelGPCorrente[nomeAPI];
            if (!chiave) return null;

            messaggioLoading.innerText = `⏳ Elaborazione dati per ${nomeVisualizzato}...`;

            // Download con Cache (Nessun caricamento se hai già visto quella scheda!)
            if (!statoApp.cacheDati[chiave]) {
                const p = await recuperaPiloti(chiave); await attendi(200);
                const g = await recuperaGiri(chiave); await attendi(200);
                const s = await recuperaStintGomme(chiave);
                statoApp.cacheDati[chiave] = { piloti: p, giri: g, stint: s };
            }

            const cache = statoApp.cacheDati[chiave];
            let datiFormattati = [];

            // Usa i "Cuochi" che abbiamo già creato per le altre schede!
            if (tipoElaborazione === 'FP') datiFormattati = elaboraRisultatiProveLibere(cache.piloti, cache.giri, cache.stint);
            if (tipoElaborazione === 'QUALI') datiFormattati = elaboraRisultatiQualifiche(cache.piloti, cache.giri, cache.stint);
            if (tipoElaborazione === 'GARA') datiFormattati = elaboraRisultatiGara(cache.piloti, cache.giri, cache.stint);

            // Trova la riga specifica del pilota tramite il tag generato nei nostri script (es. #16)
            const rigaPilota = datiFormattati.find(r => r["Pilota"].includes(`#${numeroPilota}<`));
            if (rigaPilota) {
                // Rimuoviamo la colonna "Pilota" (perché sappiamo già chi è) e aggiungiamo la colonna "Sessione"
                const rigaPulita = { "Sessione": `<b>${nomeVisualizzato}</b>`, ...rigaPilota };
                delete rigaPulita["Pilota"];
                return rigaPulita;
            }
            return null;
        }

        // 3. ESTRAZIONE DATI PER TUTTE LE SESSIONI DEL WEEKEND
        const recapFp = [];
        const recapQuali = [];
        const recapGara = [];

        // Libere
        const fp1 = await estraiRigaPilota("Practice 1", "FP", "Libere 1"); if (fp1) recapFp.push(fp1);
        const fp2 = await estraiRigaPilota("Practice 2", "FP", "Libere 2"); if (fp2) recapFp.push(fp2);
        const fp3 = await estraiRigaPilota("Practice 3", "FP", "Libere 3"); if (fp3) recapFp.push(fp3);

        // Qualifiche (Gara e Sprint)
        const quali = await estraiRigaPilota("Qualifying", "QUALI", "Qualifiche"); if (quali) recapQuali.push(quali);
        const sqName = statoApp.sessioniDelGPCorrente["Sprint Shootout"] ? "Sprint Shootout" : "Sprint Qualifying";
        const sprintQ = await estraiRigaPilota(sqName, "QUALI", "Sprint Quali"); if (sprintQ) recapQuali.push(sprintQ);

        // Gare (Sprint e Domenica)
        const sprint = await estraiRigaPilota("Sprint", "GARA", "Gara Sprint"); if (sprint) recapGara.push(sprint);
        const gara = await estraiRigaPilota("Race", "GARA", "Gara"); if (gara) recapGara.push(gara);

        // 4. DISEGNO DELLE TABELLE
        popolaTabellaDaJson("tabella-riassunto-fp", recapFp.length > 0 ? recapFp : [{"Info": "Dati non disponibili"}]);
        popolaTabellaDaJson("tabella-riassunto-quali", recapQuali.length > 0 ? recapQuali : [{"Info": "Dati non disponibili"}]);
        popolaTabellaDaJson("tabella-riassunto-gara", recapGara.length > 0 ? recapGara : [{"Info": "Dati non disponibili"}]);

        messaggioLoading.style.display = 'none';
        contenitoreDati.style.display = 'block';

    } catch (errore) {
        console.error("Errore nel riassunto:", errore);
        messaggioLoading.innerHTML = `<span class="w3-text-red">❌ Errore durante l'aggregazione dei dati del weekend.</span>`;
    }
}

/**
 * Orchestratore Universale per l'Analisi Passo (Gara o Sprint).
 * @param {string} tipoGara - "Sprint" o "Normale"
 * @param {string} suffissoId - "passo-sprint" o "passo-gara"
 * @param {boolean} soloFiltro - True se cambia solo il pilota nel grafico
 */
async function gestisciSchedaPasso(tipoGara, suffissoId, soloFiltro = false) {
    const chiaveSessione = tipoGara === "Sprint" 
        ? statoApp.sessioniDelGPCorrente["Sprint"] 
        : statoApp.sessioniDelGPCorrente["Race"];

    // ID Dinamici basati sul suffisso
    const idContenitoreDati = `contenitore-dati-${suffissoId}`;
    const idAvviso = `avviso-assenza-${suffissoId}`;
    const idSelectPilota = `select-pilota-${suffissoId}`;
    const idTabella = `tabella-${suffissoId}`;
    const idGrafico = `contenitore-grafico-${suffissoId}`;
    const idStatistiche = `statistiche-avanzate-pilota-${suffissoId}`;

    const contenitoreDOM = document.getElementById(idContenitoreDati);
    const avvisoDOM = document.getElementById(idAvviso);
    const selectPilota = document.getElementById(idSelectPilota);

    if (!chiaveSessione) {
        if(contenitoreDOM) contenitoreDOM.style.display = 'none';
        if(avvisoDOM) avvisoDOM.style.display = 'block';
        return;
    }

    if(contenitoreDOM) contenitoreDOM.style.display = 'block';
    if(avvisoDOM) avvisoDOM.style.display = 'none';
    
    const cacheKey = `analisi_passo_${chiaveSessione}`;

    // ⚡ Filtro rapido (Cambio Pilota nel Grafico)
    if (soloFiltro && statoApp.cacheDati[cacheKey]) {
        const cache = statoApp.cacheDati[cacheKey];
        const configGraf = preparaConfigGraficoPasso(selectPilota.value, cache.giri, cache.piloti, cache.risultato.zoneSfondoGrafico);
        disegnaGraficoConStatoPista(idGrafico, configGraf);
        document.getElementById(idStatistiche).innerHTML = calcolaStatisticheAvanzatePilota(selectPilota.value, cache.giri, cache.stint);        return;
    }

    try {
        let p, g, dir;
        
        // 📥 Download Dati con Cache
        if (!statoApp.cacheDati[cacheKey]) {
            document.getElementById(idTabella).innerHTML = "<tr><td class='w3-center'>⏳ Caricamento telemetria e direzione gara in corso...</td></tr>";
            
            p = await recuperaPiloti(chiaveSessione); await attendi(200);
            g = await recuperaGiri(chiaveSessione); await attendi(200);
            dir = await recuperaDirezioneGara(chiaveSessione); await attendi(200);
            let s = await recuperaStintGomme(chiaveSessione); 
            
            const risultato = elaboraAnalisiPasso(g, p, dir);
            
            statoApp.cacheDati[cacheKey] = { piloti: p, giri: g, stint: s, dir: dir, risultato: risultato };
        }

        const cache = statoApp.cacheDati[cacheKey];
        if (!cache.risultato) throw new Error("Dati non sufficienti");

        // Disegna Tabella
        popolaTabellaDaJson(idTabella, cache.risultato.matriceTabella);

        // Popola la tendina dei piloti
        if (!soloFiltro) {
            let opzioni = cache.risultato.pilotiValidi.map(pil => ({ testo: pil.broadcast_name, valore: pil.driver_number }));
            popolaSelectDaJson(idSelectPilota, opzioni);
            if (selectPilota) selectPilota.value = opzioni[0].valore;
        }

        // Disegna Grafico Iniziale
        const configGraf = preparaConfigGraficoPasso(selectPilota.value, cache.giri, cache.piloti, cache.risultato.zoneSfondoGrafico);
        disegnaGraficoConStatoPista(idGrafico, configGraf);

        document.getElementById(idStatistiche).innerHTML = calcolaStatisticheAvanzatePilota(selectPilota.value, cache.giri, cache.stint);
    } catch (e) {
        console.error(e);
        document.getElementById(idTabella).innerHTML = "<tr><td class='w3-center w3-text-red'>❌ Impossibile caricare l'analisi passo per questa sessione.</td></tr>";
    }
}

/**
 * Orchestratore per il Confronto Testa-a-Testa (Passo Gara).
 */
async function gestisciSchedaConfrontoPasso(soloFiltro = false) {
    const contenitoreDOM = document.getElementById("contenitore-dati-confronto-passo");
    const avvisoDOM = document.getElementById("avviso-assenza-confronto-passo");
    const selectSessione = document.getElementById("select-sessione-confronto-passo");
    const selectA = document.getElementById("select-pilota-a-passo");
    const selectB = document.getElementById("select-pilota-b-passo");

    if (!selectSessione.options.length) {
        let opzioniSessioni = [];
        if (statoApp.sessioniDelGPCorrente["Race"]) opzioniSessioni.push({ testo: "Gara", valore: statoApp.sessioniDelGPCorrente["Race"] });
        if (statoApp.sessioniDelGPCorrente["Sprint"]) opzioniSessioni.push({ testo: "Gara Sprint", valore: statoApp.sessioniDelGPCorrente["Sprint"] });
        popolaSelectDaJson("select-sessione-confronto-passo", opzioniSessioni);
    }

    let chiaveSessione = selectSessione.value;

    if (!chiaveSessione) {
        contenitoreDOM.style.display = 'none';
        avvisoDOM.style.display = 'block';
        return;
    }

    contenitoreDOM.style.display = 'block';
    avvisoDOM.style.display = 'none';

    const cacheKey = `analisi_passo_${chiaveSessione}`; 

    try {
        if (!statoApp.cacheDati[cacheKey]) {
            document.getElementById("colonna-stats-a-passo").innerHTML = "<p class='w3-center'>⏳ Caricamento telemetria in corso...</p>";
            let p = await recuperaPiloti(chiaveSessione); await attendi(200);
            let g = await recuperaGiri(chiaveSessione); await attendi(200);
            let dir = await recuperaDirezioneGara(chiaveSessione); await attendi(200);
            let s = await recuperaStintGomme(chiaveSessione); 
            const risultato = elaboraAnalisiPasso(g, p, dir); 
            statoApp.cacheDati[cacheKey] = { piloti: p, giri: g, stint: s, dir: dir, risultato: risultato };
        }

        const cache = statoApp.cacheDati[cacheKey];

        if (!soloFiltro) {
            let opzioni = cache.risultato.pilotiValidi.map(pil => ({ testo: pil.broadcast_name, valore: pil.driver_number }));
            popolaSelectDaJson("select-pilota-a-passo", opzioni);
            popolaSelectDaJson("select-pilota-b-passo", opzioni);
            if (opzioni.length > 0) selectA.value = opzioni[0].valore;
            if (opzioni.length > 1) selectB.value = opzioni[1].valore;
        }

        let pilA = selectA.value;
        let pilB = selectB.value;

        const configA = preparaConfigGraficoPasso(pilA, cache.giri, cache.piloti); 
        const configB = preparaConfigGraficoPasso(pilB, cache.giri, cache.piloti);
        disegnaGraficoDoppioConStatoPista("contenitore-grafico-confronto-passo", configA, configB, cache.risultato.zoneSfondoGrafico);

        document.getElementById("colonna-stats-a-passo").innerHTML = calcolaColonnaVerticalePilota(pilA, cache.giri, cache.stint, cache.piloti);
        document.getElementById("colonna-stats-b-passo").innerHTML = calcolaColonnaVerticalePilota(pilB, cache.giri, cache.stint, cache.piloti);

    } catch (e) {
        console.error(e);
        document.getElementById("colonna-stats-a-passo").innerHTML = "<p class='w3-text-red'>Errore caricamento dati.</p>";
    }
}

/**
 * Orchestratore per il Confronto Telemetrico Sovrapposto (Qualifica).
 */
async function gestisciSchedaConfrontoQualifica(soloFiltro = false) {
    const contenitoreDOM = document.getElementById("contenitore-dati-confronto-qualifica");
    const avvisoDOM = document.getElementById("avviso-assenza-confronto-qualifica");
    const loader = document.getElementById("messaggio-caricamento-qualifica");
    
    const selectSessione = document.getElementById("select-sessione-confronto-qualifica");
    const selectA = document.getElementById("select-pilota-a-qualifica");
    const selectB = document.getElementById("select-pilota-b-qualifica");

    if (!selectSessione.options.length) {
        let opzioni = [];
        if (statoApp.sessioniDelGPCorrente["Qualifying"]) opzioni.push({ testo: "Qualifiche Ufficiali", valore: statoApp.sessioniDelGPCorrente["Qualifying"] });
        if (statoApp.sessioniDelGPCorrente["Sprint Qualifying"]) opzioni.push({ testo: "Sprint Qualifying", valore: statoApp.sessioniDelGPCorrente["Sprint Qualifying"] });
        if (statoApp.sessioniDelGPCorrente["Sprint Shootout"]) opzioni.push({ testo: "Sprint Shootout", valore: statoApp.sessioniDelGPCorrente["Sprint Shootout"] });
        popolaSelectDaJson("select-sessione-confronto-qualifica", opzioni);
    }

    let chiaveSessione = selectSessione.value;
    if (!chiaveSessione) {
        contenitoreDOM.style.display = 'none';
        avvisoDOM.style.display = 'block';
        return;
    }
    contenitoreDOM.style.display = 'block';
    avvisoDOM.style.display = 'none';

    try {
        loader.style.display = "block";
        loader.innerHTML = "⏳ Inizializzazione dati sessione...";

        let cacheKey = `giri_quali_${chiaveSessione}`;
        if (!statoApp.cacheDati[cacheKey]) {
            let p = await recuperaPiloti(chiaveSessione); await attendi(200);
            let g = await recuperaGiri(chiaveSessione);
            statoApp.cacheDati[cacheKey] = { piloti: p, giri: g };
        }
        let datiBase = statoApp.cacheDati[cacheKey];

        if (!soloFiltro) {
            let opzioniP = datiBase.piloti.map(p => ({ testo: p.broadcast_name, valore: p.driver_number }));
            popolaSelectDaJson("select-pilota-a-qualifica", opzioniP);
            popolaSelectDaJson("select-pilota-b-qualifica", opzioniP);
            if (opzioniP.length > 0) selectA.value = opzioniP[0].valore;
            if (opzioniP.length > 1) selectB.value = opzioniP[1].valore;
        }

        let pilA = selectA.value;
        let pilB = selectB.value;

        async function estraiTelemetria(numPilota) {
            let pInfo = datiBase.piloti.find(p => p.driver_number == numPilota);
            let giriPilota = datiBase.giri.filter(g => g.driver_number == numPilota && g.lap_duration).sort((a,b) => a.lap_duration - b.lap_duration);
            if (giriPilota.length === 0 || !giriPilota[0].date_start) return null;
            
            let bestLap = giriPilota[0];
            
            let timestampInizio = new Date(bestLap.date_start).getTime();
            let timestampFine = timestampInizio + (bestLap.lap_duration * 1000);

            let rawData = await recuperaDatiVettura(chiaveSessione, numPilota);
            
            if (!rawData || rawData.length === 0) {
                console.warn(`Nessun dato telemetrico trovato per il pilota ${numPilota}`);
                return null;
            }

            let telemetriaGiro = rawData.filter(t => {
                let tempoCampione = new Date(t.date).getTime();
                return tempoCampione >= timestampInizio && tempoCampione <= timestampFine;
            });

            if (telemetriaGiro.length === 0) {
                console.warn(`Dati fuori range per il pilota ${numPilota} nel giro selezionato.`);
                return null;
            }

            return { info: pInfo, analisi: elaboraTelemetriaGiroConfronto(telemetriaGiro, pInfo) };
        }

        loader.innerHTML = `⏳ Download e calcolo vettoriale dei sensori vettura in corso...`;
        
        const [datiA, datiB] = await Promise.all([estraiTelemetria(pilA), estraiTelemetria(pilB)]);

        if (!datiA || !datiA.analisi || !datiB || !datiB.analisi) {
            throw new Error("Dati mancanti: l'API non ha ancora reso disponibile la telemetria per uno di questi piloti.");
        }

        if (!datiA || !datiB) throw new Error("Dati mancanti per uno dei piloti");

        loader.style.display = "none";

        // Inietta Colonne
        document.getElementById("stats-qualifica-a").innerHTML = generaColonnaTelemetria(datiA.analisi, datiA.info);
        document.getElementById("stats-qualifica-b").innerHTML = generaColonnaTelemetria(datiB.analisi, datiB.info);

        // Disegna Grafici
        disegnaGraficoDoppioConStatoPista("grafico-confronto-velocita-qualifica", 
            { titolo: `Velocità ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, etichetteX: datiA.analisi.asseX, datiY: datiA.analisi.velocitaY },
            { titolo: `Velocità ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, etichetteX: datiB.analisi.asseX, datiY: datiB.analisi.velocitaY }, []
        );

        disegnaGraficoDoppioConStatoPista("grafico-confronto-gas-qualifica", 
            { titolo: `Acceleratore % ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, etichetteX: datiA.analisi.asseX, datiY: datiA.analisi.gasY },
            { titolo: `Acceleratore % ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, etichetteX: datiB.analisi.asseX, datiY: datiB.analisi.gasY }, []
        );

        disegnaGraficoDoppioConStatoPista("grafico-confronto-freno-qualifica", 
            { titolo: `Freno ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, etichetteX: datiA.analisi.asseX, datiY: datiA.analisi.frenoY },
            { titolo: `Freno ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, etichetteX: datiB.analisi.asseX, datiY: datiB.analisi.frenoY }, []
        );

        disegnaGraficoDoppioConStatoPista("grafico-confronto-marce-qualifica", 
            { titolo: `Marce ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, etichetteX: datiA.analisi.asseX, datiY: datiA.analisi.marciaY },
            { titolo: `Marce ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, etichetteX: datiB.analisi.asseX, datiY: datiB.analisi.marciaY }, []
        );

        disegnaGraficoDoppioConStatoPista("grafico-confronto-rpm-qualifica", 
            { titolo: `RPM ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, etichetteX: datiA.analisi.asseX, datiY: datiA.analisi.rpmY },
            { titolo: `RPM ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, etichetteX: datiB.analisi.asseX, datiY: datiB.analisi.rpmY }, []
        );

        disegnaGraficoDoppioConStatoPista("grafico-confronto-drs-qualifica", 
            { titolo: `DRS Attivo ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, etichetteX: datiA.analisi.asseX, datiY: datiA.analisi.drsY },
            { titolo: `DRS Attivo ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, etichetteX: datiB.analisi.asseX, datiY: datiB.analisi.drsY }, []
        );

    } catch (e) {
        console.error(e);
        loader.innerHTML = `<p class="w3-text-red">❌ Errore durante l'estrazione telemetrica.</p>`;
    }
}

// ==========================================
// ORCHESTRATORE: CONFRONTO GIRI SPAZIALE
// ==========================================

async function inizializzaSchedaGiri() {
    const selectSessione = document.getElementById("select-sessione-giri");
    if (!selectSessione.options.length) {
        let opzioni = Object.keys(statoApp.sessioniDelGPCorrente).map(k => ({ testo: k, valore: statoApp.sessioniDelGPCorrente[k] }));
        popolaSelectDaJson("select-sessione-giri", opzioni);
    }

    let chiave = selectSessione.value;
    if (!chiave) return;

    const loader = document.getElementById("messaggio-caricamento-giri");
    loader.style.display = "block";
    loader.innerHTML = "⏳ Download storico giri e piloti...";
    document.getElementById("pannello-controlli-giri").style.display = "none";
    document.getElementById("pannello-grafici-giri").style.display = "none";

    let cacheKey = `storico_completo_${chiave}`;
    if (!statoApp.cacheDati[cacheKey]) {
        let p = await recuperaPiloti(chiave);
        let g = await recuperaGiri(chiave);
        statoApp.cacheDati[cacheKey] = { piloti: p, giri: g };
    }

    let datiBase = statoApp.cacheDati[cacheKey];
    let opzioniP = datiBase.piloti.map(p => ({ testo: p.broadcast_name, valore: p.driver_number }));
    
    popolaSelectDaJson("select-pilota-a-giri", opzioniP);
    popolaSelectDaJson("select-pilota-b-giri", opzioniP);
    if(opzioniP.length > 1) document.getElementById("select-pilota-b-giri").value = opzioniP[1].valore;

    // Popoliamo i giri disponibili per i piloti selezionati
    popolaTendinaGiri('a');
    popolaTendinaGiri('b');

    loader.style.display = "none";
    document.getElementById("pannello-controlli-giri").style.display = "block";
}

function popolaTendinaGiri(lato) {
    let chiave = document.getElementById("select-sessione-giri").value;
    let numPilota = document.getElementById(`select-pilota-${lato}-giri`).value;
    let datiBase = statoApp.cacheDati[`storico_completo_${chiave}`];
    
    // Filtriamo i giri validi e li ordiniamo per numero giro cronologico
    let giri = datiBase.giri.filter(g => g.driver_number == numPilota && g.lap_duration).sort((a,b) => a.lap_number - b.lap_number);
    
    let opzioniGiri = giri.map(g => {
        let isBest = g.is_personal_best ? "🔥 " : "";
        return { testo: `Giro ${g.lap_number} (${isBest}${formattaTempo(g.lap_duration)})`, valore: g.lap_number };
    });

    popolaSelectDaJson(`select-giro-${lato}`, opzioniGiri);
    
    // Seleziona il giro migliore di default
    let bestLapObj = giri.sort((a,b) => a.lap_duration - b.lap_duration)[0];
    if (bestLapObj) document.getElementById(`select-giro-${lato}`).value = bestLapObj.lap_number;

    eseguiConfrontoGiri();
}

async function eseguiConfrontoGiri() {
    let chiaveSessione = document.getElementById("select-sessione-giri").value;
    let pilA = document.getElementById("select-pilota-a-giri").value;
    let pilB = document.getElementById("select-pilota-b-giri").value;
    let numGiroA = document.getElementById("select-giro-a").value;
    let numGiroB = document.getElementById("select-giro-b").value;

    if (!numGiroA || !numGiroB) return;

    const loader = document.getElementById("messaggio-caricamento-giri");
    loader.style.display = "block";
    loader.innerHTML = `⏳ Estrazione telemetria spaziale in corso...`;
    document.getElementById("pannello-grafici-giri").style.display = "none";

    let datiBase = statoApp.cacheDati[`storico_completo_${chiaveSessione}`];

    async function scaricaGiroSpaziale(numPilota, numGiro) {
        let pInfo = datiBase.piloti.find(p => p.driver_number == numPilota);
        let infoGiro = datiBase.giri.find(g => g.driver_number == numPilota && g.lap_number == numGiro);
        
        let tInizio = new Date(infoGiro.date_start).getTime();
        let tFine = tInizio + (infoGiro.lap_duration * 1000);

        // Download massivo senza filtri date per evitare Error 500
        let rawData = await recuperaDatiVettura(chiaveSessione, numPilota);
        
        // Taglio chirurgico locale
        let telemetriaFiltrata = rawData.filter(t => {
            let tempo = new Date(t.date).getTime();
            return tempo >= tInizio && tempo <= tFine;
        });

        return { info: pInfo, analisi: elaboraTelemetriaSpaziale(telemetriaFiltrata, pInfo) };
    }

    try {
        const [datiA, datiB] = await Promise.all([
            scaricaGiroSpaziale(pilA, numGiroA),
            scaricaGiroSpaziale(pilB, numGiroB)
        ]);

        // Rendering Statistiche
        document.getElementById("stats-giri-a").innerHTML = generaColonnaTelemetria(datiA.analisi.stats, datiA.info);
        document.getElementById("stats-giri-b").innerHTML = generaColonnaTelemetria(datiB.analisi.stats, datiB.info);

        // Rendering Grafici Spaziali
        disegnaGraficoSpaziale("grafico-spazio-velocita", 
            { titolo: `Velocità ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, datiXY: datiA.analisi.datiVelocita },
            { titolo: `Velocità ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, datiXY: datiB.analisi.datiVelocita }
        );
        disegnaGraficoSpaziale("grafico-spazio-gas", 
            { titolo: `Gas % ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, datiXY: datiA.analisi.datiGas },
            { titolo: `Gas % ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, datiXY: datiB.analisi.datiGas }
        );
        disegnaGraficoSpaziale("grafico-spazio-freno", 
            { titolo: `Freno ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, datiXY: datiA.analisi.datiFreno },
            { titolo: `Freno ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, datiXY: datiB.analisi.datiFreno }
        );
        disegnaGraficoSpaziale("grafico-spazio-marce", 
            { titolo: `Marce ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, datiXY: datiA.analisi.datiMarce },
            { titolo: `Marce ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, datiXY: datiB.analisi.datiMarce }
        );
        disegnaGraficoSpaziale("grafico-spazio-rpm", 
            { titolo: `RPM ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, datiXY: datiA.analisi.datiRpm },
            { titolo: `RPM ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, datiXY: datiB.analisi.datiRpm }
        );
        disegnaGraficoSpaziale("grafico-spazio-gforce", 
            { titolo: `Forza G ${datiA.info.broadcast_name}`, colore: datiA.analisi.coloreTeam, datiXY: datiA.analisi.datiGForce },
            { titolo: `Forza G ${datiB.info.broadcast_name}`, colore: datiB.analisi.coloreTeam, datiXY: datiB.analisi.datiGForce }
        );

        loader.style.display = "none";
        document.getElementById("pannello-grafici-giri").style.display = "block";

    } catch (e) {
        console.error(e);
        loader.innerHTML = `<p class="w3-text-red">❌ Errore durante l'allineamento spaziale dei giri.</p>`;
    }
}