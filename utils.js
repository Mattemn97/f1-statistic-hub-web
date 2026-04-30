const DEBUG_MODE = true; // Imposta su 'false' in produzione per disattivare tutti i log

const Logger = {
    info: (msg, ...args) => { if(DEBUG_MODE) console.log(`%c[INFO]%c ${msg}`, 'color: white; background: #007bff; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    success: (msg, ...args) => { if(DEBUG_MODE) console.log(`%c[SUCCESS]%c ${msg}`, 'color: white; background: #28a745; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    warn: (msg, ...args) => { if(DEBUG_MODE) console.warn(`%c[WARN]%c ${msg}`, 'color: black; background: #ffc107; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    error: (msg, ...args) => { if(DEBUG_MODE) console.error(`%c[ERROR]%c ${msg}`, 'color: white; background: #dc3545; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    debug: (msg, ...args) => { if(DEBUG_MODE) console.error(`%c[DEBUG]%c ${msg}`, 'color: white; background: #ac15f1; border-radius: 3px; padding: 2px 5px;', 'color: inherit;', ...args); },
    table: (data) => { if(DEBUG_MODE) console.table(data); }
};

const attendiRitardo = (ms = 500) => new Promise(resolve => setTimeout(resolve, ms));

async function eseguiConCache(chiaveCache, funzioneApi, ...lista_parametri) {
    const datiInCache = sessionStorage.getItem(chiaveCache);
    if (datiInCache) {
        return JSON.parse(datiInCache);
    }

    let dati = await funzioneApi(...lista_parametri);
    Logger.debug(`Dati grezzi da API (${funzioneApi.name}), parametri:`, lista_parametri, `dati:`, dati);

    if (funzioneApi === recuperaDatiVettura) {
        // 1. Prendi un elemento ogni 4 (indice 0, 4, 8, 12...)
        dati = dati.filter((elemento, indice) => indice % 4 === 0);

        // 2. Rimuovi le chiavi 'meeting_key', 'session_key' e 'drs'
        dati = dati.map(elemento => {
            const { meeting_key, session_key, drs, ...restoDati } = elemento;
            return restoDati; 
        });
    }

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

function formattaTempoGara(secondi) {
    if (!secondi || isNaN(secondi) || secondi === Infinity) return "-";
    const h = Math.floor(secondi / 3600);
    const m = Math.floor((secondi % 3600) / 60);
    const s = (secondi % 60).toFixed(3);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(6, '0')}`;
    if (m > 0) return `${m}:${s.padStart(6, '0')}`;
    return `${s}`;
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

function calcolaDevStandard(array) {
    if (array.length < 2) return 0;
    const media = array.reduce((a, b) => a + b, 0) / array.length;
    const varianza = array.reduce((a, b) => a + Math.pow(b - media, 2), 0) / array.length;
    return Math.sqrt(varianza);
}

function calcolaDegrado(array) {
    if (array.length < 2) return 0;
    const n = array.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += array[i];
        sumXY += i * array[i];
        sumXX += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope; // Secondi persi (o guadagnati) per giro
}