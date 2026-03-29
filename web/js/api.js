// js/api.js

/**
 * Indirizzo di base per tutte le chiamate alle API di OpenF1.
 * @constant {string}
 */
const INDIRIZZO_BASE_API = "https://api.openf1.org/v1";

/**
 * Funzione di utilità per creare una pausa (anti Rate-Limit)
 * @param {number} ms - Millisecondi di attesa
 */
const attendi = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Funzione di supporto interna per eseguire la richiesta HTTP e gestire gli errori.
 * @param {string} percorso - L'endpoint specifico (es. '/laps').
 * @param {number} chiaveSessione - L'identificativo univoco della sessione.
 * @returns {Promise<Array|Object>} - I dati restituiti dall'API in formato JSON.
 */
async function eseguiRichiestaGenerica(percorso, query) {
    const urlCorrente = `${INDIRIZZO_BASE_API}${percorso}?${query}`;
    await attendi(1000);
    
    try {
        const risposta = await fetch(urlCorrente);
        if (!risposta.ok) {
            throw new Error(`Errore di rete durante la chiamata a ${percorso}: ${risposta.status}`);
        }
        const dati = await risposta.json();
        return dati;
    } catch (errore) {
        console.error(`Si è verificato un problema con l'endpoint ${percorso}:`, errore);
        return []; // Restituisce un array vuoto in caso di errore per non bloccare l'interfaccia
    }
}


// ==========================================
// FUNZIONI PER GRAN PREMI E SESSIONI
// ==========================================

/**
 * Recupera l'elenco di tutti i Gran Premi (meetings) disponibili per un dato anno.
 * @param {number} anno - L'anno di riferimento (es. 2024).
 * @returns {Promise<Array>} - Un array contenente i dati di tutti i Gran Premi di quell'anno.
 */
async function recuperaGranPremiPerAnno(anno) {
    return await eseguiRichiestaGenerica("/meetings", `year=${anno}`);
}

/**
 * Recupera l'elenco di tutte le sessioni (Prove Libere, Qualifiche, Sprint, Gara) per un dato Gran Premio.
 * @param {number} chiaveGranPremio - L'identificativo univoco del Gran Premio (meeting_key).
 * @returns {Promise<Array>} - Un array contenente i dati di tutte le sessioni di quel Gran Premio.
 */
async function recuperaSessioniPerGranPremio(chiaveGranPremio) {
    return await eseguiRichiestaGenerica("/sessions", `meeting_key=${chiaveGranPremio}`);
}

// ==========================================
// FUNZIONI ENDPOINT OPENF1
// ==========================================

/**
 * Recupera TUTTE le sessioni di un dato anno (utile per costruire la cronologia esatta di Sprint e Gare).
 * @param {number} anno - L'anno di riferimento (es. 2024).
 */
async function recuperaTutteSessioniPerAnno(anno) {
    return await eseguiRichiestaGenerica("/sessions", `year=${anno}`);
}

/**
 * Recupera la classifica Piloti aggiornata alla fine di un intero Gran Premio (Meeting).
 */
async function recuperaClassificaPilotiMeeting(chiaveMeeting) {
    return await eseguiRichiestaGenerica("/championship_drivers", `meeting_key=${chiaveMeeting}`);
}

/**
 * Recupera la classifica Costruttori aggiornata alla fine di un intero Gran Premio (Meeting).
 */
async function recuperaClassificaCostruttoriMeeting(chiaveMeeting) {
    return await eseguiRichiestaGenerica("/championship_teams", `meeting_key=${chiaveMeeting}`);
}

/**
 * Recupera la classifica Piloti aggiornata a una determinata sessione.
 * @param {number} chiaveSessione - L'identificativo della sessione (idealmente la Gara).
 */
async function recuperaClassificaPiloti(chiaveSessione) {
    return await eseguiRichiestaGenerica("/championship_drivers", `session_key=${chiaveSessione}`);
}

/**
 * Recupera la classifica Costruttori aggiornata a una determinata sessione.
 * @param {number} chiaveSessione - L'identificativo della sessione (idealmente la Gara).
 */
async function recuperaClassificaCostruttori(chiaveSessione) {
    return await eseguiRichiestaGenerica("/championship_teams", `session_key=${chiaveSessione}`);
}

/**
 * Recupera l'elenco dei piloti che hanno partecipato a una specifica sessione.
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaPiloti(chiaveSessione) {
    return await eseguiRichiestaGenerica("/drivers", `session_key=${chiaveSessione}`);
}

/**
 * Recupera tutti i giri completati (tempi e settori) in una specifica sessione.
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaGiri(chiaveSessione) {
    return await eseguiRichiestaGenerica("/laps", `session_key=${chiaveSessione}`);
}

/**
 * Recupera le posizioni in classifica dei piloti aggiornate durante la sessione.
 * @param {number} chiaveGranPremio - L'identificativo del Gran Premio.
 */
async function recuperaPosizioni(chiaveGranPremio) {
    return await eseguiRichiestaGenerica("/position", `meeting_key=${chiaveGranPremio}`);
}

/**
 * Recupera gli intervalli di tempo tra i piloti durante la sessione.
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaIntervalli(chiaveSessione) {
    return await eseguiRichiestaGenerica("/intervals", `session_key=${chiaveSessione}`);
}

/**
 * Recupera i dati di telemetria (velocità, marcia, giri motore, acceleratore, freno).
 * @param {number} chiaveSessione - L'identificativo della sessione.
 * @param {number} numeroVettura - Il numero di gara della vettura (es. 33 per Verstappen).
 */
async function recuperaDatiVettura(chiaveSessione, numeroVettura) {
    return await eseguiRichiestaGenerica("/car_data", `session_key=${chiaveSessione}&driver_number=${numeroVettura}`);
}

/**
 * Recupera le coordinate fisiche (X, Y, Z) delle vetture sul tracciato.
 * @param {number} chiaveSessione - L'identificativo della sessione.
 * @param {number} numeroVettura - Il numero di gara della vettura (es. 33 per Verstappen).
 */
async function recuperaPosizioneInPista(chiaveSessione, numeroVettura) {
    return await eseguiRichiestaGenerica("/location", `session_key=${chiaveSessione}&driver_number=${numeroVettura}`);
}

/**
 * Recupera le informazioni sugli stint legati agli pneumatici (mescole e durata).
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaStintGomme(chiaveSessione) {
    return await eseguiRichiestaGenerica("/stints", `session_key=${chiaveSessione}`);
}

/**
 * Recupera i dati relativi alle soste ai box (pit stop) avvenute nella sessione.
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaSosteAiBox(chiaveSessione) {
    return await eseguiRichiestaGenerica("/pit", `session_key=${chiaveSessione}`);
}

/**
 * Recupera i messaggi ufficiali della direzione gara (bandiere, safety car, penalità).
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaDirezioneGara(chiaveSessione) {
    return await eseguiRichiestaGenerica("/race_control", `session_key=${chiaveSessione}`);
}

/**
 * Recupera le trascrizioni delle comunicazioni radio tra pilota e muretto box.
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaComunicazioniRadio(chiaveSessione) {
    return await eseguiRichiestaGenerica("/team_radio", `session_key=${chiaveSessione}`);
}

/**
 * Recupera le misurazioni meteorologiche (temperatura, umidità, pioggia) della sessione.
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaDatiMeteo(chiaveSessione) {
    return await eseguiRichiestaGenerica("/weather", `session_key=${chiaveSessione}`);
}

/**
 * Recupera i dettagli anagrafici della sessione stessa (nome, orari di inizio e fine).
 * @param {number} chiaveSessione - L'identificativo della sessione.
 */
async function recuperaDettagliSessione(chiaveSessione) {
    return await eseguiRichiestaGenerica("/sessions", `session_key=${chiaveSessione}`);
}