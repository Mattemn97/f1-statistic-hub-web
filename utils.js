const DEBUG_MODE = true; // Imposta su 'false' in produzione per disattivare tutti i log

const Logger = {
    info: (msg, ...args) => { if(DEBUG_MODE) console.log(`%c[INFO]%c ${msg}`, 'color: white; background: #007bff; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    success: (msg, ...args) => { if(DEBUG_MODE) console.log(`%c[SUCCESS]%c ${msg}`, 'color: white; background: #28a745; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    warn: (msg, ...args) => { if(DEBUG_MODE) console.warn(`%c[WARN]%c ${msg}`, 'color: black; background: #ffc107; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    error: (msg, ...args) => { if(DEBUG_MODE) console.error(`%c[ERROR]%c ${msg}`, 'color: white; background: #dc3545; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    table: (data) => { if(DEBUG_MODE) console.table(data); },
    group: (label) => { if(DEBUG_MODE) console.groupCollapsed(`%c${label}`, 'font-weight: bold; font-size: 1.1em;'); },
    groupEnd: () => { if(DEBUG_MODE) console.groupEnd(); },
    time: (label) => { if(DEBUG_MODE) console.time(`${label}`); },
    timeEnd: (label) => { if(DEBUG_MODE) console.timeEnd(`${label}`); }
};

const attendiRitardo = (ms = 1200) => new Promise(resolve => setTimeout(resolve, ms));

async function eseguiConCache(chiaveCache, funzioneApi, parametro) {
    // Controlla se i dati sono già salvati nella memoria della sessione
    const datiInCache = sessionStorage.getItem(chiaveCache);
    if (datiInCache) {
        return JSON.parse(datiInCache);
    }

    // Se non ci sono, esegui la chiamata API reale
    const dati = await funzioneApi(parametro);
    
    // Prova a salvare in cache (Uso try/catch per evitare crash se la memoria si riempie)
    try {
        sessionStorage.setItem(chiaveCache, JSON.stringify(dati));
    } catch (e) {
        console.warn("Impossibile salvare in cache, memoria sessione probabilmente piena.", e);
    }
    
    return dati;
}

function formattaTempo(secondi) {
    if (!secondi || typeof secondi !== 'number' || !isFinite(secondi)) return "-";
    const minuti = Math.floor(secondi / 60);
    const secRimanenti = (secondi % 60).toFixed(3).padStart(6, '0');
    return minuti > 0 ? `${minuti}:${secRimanenti}` : secRimanenti;
}

function getColorsGomma(gommaStr) {
    const m = gommaStr.toUpperCase();
    if(m === 'SOFT') return { bg: '#FF3333', fg: '#FFFFFF' };
    if(m === 'MEDIUM') return { bg: '#EAE000', fg: '#000000' };
    if(m === 'HARD') return { bg: '#FFFFFF', fg: '#000000' };
    if(m === 'INTERMEDIATE') return { bg: '#33CC33', fg: '#FFFFFF' };
    if(m === 'WET') return { bg: '#0066FF', fg: '#FFFFFF' };
    return { bg: '#666666', fg: '#FFFFFF' };
}

function formattaDelta(val) {
    if (val === '-' || val === Infinity || val == null || val == 0) return '-';
    return '+' + val.toFixed(3);
}