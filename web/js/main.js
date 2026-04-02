// js/main.js

/**
 * =========================================================
 * LOGGER DI SISTEMA (F1 Terminal Style)
 * =========================================================
 */
const SysLog = {
    info: (msg, data = "") => console.log(`[INFO] ${new Date().toISOString()} :: ${msg}`, data),
    warn: (msg, data = "") => console.warn(`[WARN] ${new Date().toISOString()} :: ${msg}`, data),
    error: (msg, err = "") => console.error(`[ERR ] ${new Date().toISOString()} :: ${msg}`, err)
};

/**
 * =========================================================
 * STATO GLOBALE E CACHE (GP-Centric)
 * =========================================================
 */
const statoApp = {
    annoCorrente: null,
    chiaveGPCorrente: null,
    
    // Le sessioni vengono caricate in background e usate dai moduli
    sessioniDelGPCorrente: {}, 
    cacheDati: {}, 
    
    uiCache: {
        tabClassifica: {},
        tabPL: {},
        tabQuali: {},
        tabGara: {},
        tabAnalisiQuali: {},
        tabAnalisiPasso: {},
        tabConfrontoQuali: {},
        tabConfrontoGare: {},
        tabRiassunto: {}
    },
    
    granPremiDellAnno: []
};

/**
 * =========================================================
 * INIZIALIZZAZIONE E BOOT
 * =========================================================
 */
document.addEventListener("DOMContentLoaded", () => {
    SysLog.info("F1_SYS_AWARENESS_V2 Terminal Booting...");
    inizializzaApp();
    impostaAscoltatoriGlobali();
});

function inizializzaApp() {
    const anni = generaAnniSupportati();
    popolaSelectDaJson("select-anno", anni);
    
    const selectAnno = document.getElementById("select-anno");
    if (selectAnno && selectAnno.value) {
        statoApp.annoCorrente = selectAnno.value;
        caricaGranPremi(statoApp.annoCorrente); 
    }
}

/**
 * =========================================================
 * LOGICA A CASCATA DEI SELETTORI (Fetch + Aggiornamento UI)
 * =========================================================
 */
async function caricaGranPremi(anno) {
    SysLog.info(`Richiesta elenco GP per YR: ${anno}...`);
    try {
        const datiGrudi = await eseguiRichiestaGenerica("/meetings", `year=${anno}`);
        statoApp.granPremiDellAnno = formattaGranPremiPerSelect(datiGrudi); 
        popolaSelectDaJson("select-gp", statoApp.granPremiDellAnno);

        const selectGp = document.getElementById("select-gp");
        if (selectGp && selectGp.options.length > 0) {
            statoApp.chiaveGPCorrente = selectGp.value;
            await caricaSessioniBackground(statoApp.chiaveGPCorrente);
        }
    } catch (err) {
        SysLog.error("Errore critico durante il recupero dei GP:", err);
    }
}

// Carica l'elenco delle sessioni in background senza aggiornare nessuna select
async function caricaSessioniBackground(meetingKey) {
    SysLog.info(`Recupero dizionario Sessioni per GP_KEY: ${meetingKey}...`);
    try {
        const datiSessioni = await eseguiRichiestaGenerica("/sessions", `meeting_key=${meetingKey}`);
        statoApp.sessioniDelGPCorrente = elaboraSessioniDisponibili(datiSessioni);

        // Dizionario pronto in memoria: innesca il render del tab attivo
        aggiornaSchedaCorrente(); 
    } catch (err) {
        SysLog.error("Errore critico durante il recupero delle Sessioni:", err);
    }
}

/**
 * =========================================================
 * LISTENER E SISTEMA DI ROUTING (Architettura a Schede)
 * =========================================================
 */
function impostaAscoltatoriGlobali() {
    // Gestione Clicks sui Tab
    const tabs = document.querySelectorAll(".tab-link");
    tabs.forEach(tab => {
        tab.addEventListener("click", (e) => {
            const targetId = e.target.getAttribute("data-target");
            cambiaScheda(targetId, e.target);
        });
    });

    // Gestione Cambiamento Select Anno
    document.getElementById("select-anno").addEventListener("change", (e) => {
        statoApp.annoCorrente = e.target.value;
        SysLog.info(`Year Context Changed: ${statoApp.annoCorrente}`);
        caricaGranPremi(statoApp.annoCorrente);
    });

    // Gestione Cambiamento Select GP
    document.getElementById("select-gp").addEventListener("change", (e) => {
        statoApp.chiaveGPCorrente = e.target.value;
        SysLog.info(`GP Context Changed: ${statoApp.chiaveGPCorrente}`);
        caricaSessioniBackground(statoApp.chiaveGPCorrente);
    });

    // Gestione Bottone Stampa
    const btnStampa = document.getElementById("btn-stampa");
    if (btnStampa) {
        btnStampa.addEventListener("click", () => {
            if (typeof scaricaSchedaAttivaComePng === "function") {
                scaricaSchedaAttivaComePng();
            } else {
                SysLog.error("Modulo di stampa mancante.");
            }
        });
    }
}

function cambiaScheda(targetId, btnElement) {
    SysLog.info(`UI Routing -> ${targetId}`);
    
    document.querySelectorAll(".tab-link").forEach(btn => btn.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
    
    btnElement.classList.add("active");
    const targetContent = document.getElementById(targetId);
    if(targetContent) targetContent.classList.add("active");

    aggiornaSchedaCorrente();
}

/**
 * Dispatcher: Invia il comando di render al modulo JS dedicato alla scheda attiva.
 * NOTA: Ora passa il gpKey (chiaveGPCorrente) al posto della singola sessionKey.
 */
async function aggiornaSchedaCorrente() {
    const targetContent = document.querySelector(".tab-content.active");
    if (!targetContent) return;
    
    const activeTab = targetContent.id;
    const gpKey = statoApp.chiaveGPCorrente;

    if (!gpKey) {
        SysLog.warn("No GP key selected. Halted rendering.");
        return;
    }

    targetContent.innerHTML = `<div class="sys-loader">FETCHING TELEMETRY DATA FOR GP ${gpKey}...</div>`;

    try {
        switch (activeTab) {
            case "tab-gara":
                if (window.RisultatiGare) await window.RisultatiGare.renderizza(gpKey, "tab-gara");
                else targetContent.innerHTML = "<span class='error'>[ERR] Modulo RisultatiGare.js non trovato.</span>";
                break;
            case "tab-pl":
                if (window.RisultatiPL) await window.RisultatiPL.renderizza(gpKey, "tab-pl");
                else targetContent.innerHTML = "<span class='error'>[ERR] Modulo RisultatiPL.js non trovato.</span>";
                break;
            case "tab-quali":
                if (window.RisultatiQualifiche) await window.RisultatiQualifiche.renderizza(gpKey, "tab-quali");
                else targetContent.innerHTML = "<span class='error'>[ERR] Modulo RisultatiQualifiche.js non trovato.</span>";
                break;
            default:
                targetContent.innerHTML = `<div>[AWAITING MODULE FOR: ${activeTab}]</div>`;
                break;
        }
    } catch (err) {
        SysLog.error(`Errore fatale durante il rendering della scheda ${activeTab}:`, err);
        targetContent.innerHTML = `<div style="color:var(--danger-color)">[CRITICAL ERROR] ${err.message}</div>`;
    }
}