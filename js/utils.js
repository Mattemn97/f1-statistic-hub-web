// js/utils.js

function formattaTempo(secondi) {
    if (!secondi || isNaN(secondi)) return "-";
    const h = Math.floor(secondi / 3600);
    const m = Math.floor((secondi % 3600) / 60);
    const s = (secondi % 60).toFixed(3);
    
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.padStart(6, '0')}`;
    else if (m > 0) return `${m}:${s.padStart(6, '0')}`;
    else return s.padStart(6, '0');
}

function formattaDistacco(secondiDistacco, doppiato = false) {
    if (doppiato) return `+${secondiDistacco} Giro/i`;
    if (!secondiDistacco || isNaN(secondiDistacco) || secondiDistacco === 0) return "-";
    return `+${secondiDistacco.toFixed(3)}`;
}

function ottieniInfoGomma(mescola) {
    const tipologie = {
        "SOFT": { coloreBase: "#ff2800", coloreTesto: "#fff", lettera: "S" },
        "MEDIUM": { coloreBase: "#f5d033", coloreTesto: "#fff", lettera: "M" },
        "HARD": { coloreBase: "#ffffff", coloreTesto: "#000", lettera: "H" },
        "INTERMEDIATE": { coloreBase: "#39b54a", coloreTesto: "#fff", lettera: "I" },
        "WET": { coloreBase: "#0aeeef", coloreTesto: "#fff", lettera: "W" }
    };
    return tipologie[mescola] || { coloreBase: "#333", coloreTesto: "#fff", lettera: "?" };
}

function calcolaMediana(numeri) {
    if (!numeri || numeri.length === 0) return null;
    let arrayOrdinato = [...numeri].sort((a, b) => a - b);
    let meta = Math.floor(arrayOrdinato.length / 2);
    return arrayOrdinato.length % 2 !== 0 
        ? arrayOrdinato[meta] 
        : (arrayOrdinato[meta - 1] + arrayOrdinato[meta]) / 2;
}

function calcolaDeviazioneStandard(numeri) {
    if (!numeri || numeri.length === 0) return null;
    let media = numeri.reduce((a, b) => a + b, 0) / numeri.length;
    let varianza = numeri.reduce((a, b) => a + Math.pow(b - media, 2), 0) / numeri.length;
    return Math.sqrt(varianza);
}

function trovaMescolaGiro(stintCrudi, numPilota, numGiro) {
    if (!stintCrudi || !numPilota || !numGiro) return "UNKNOWN";
    
    const stintTrovato = stintCrudi.find(stint => 
        stint.driver_number === numPilota && 
        numGiro >= stint.lap_start && 
        numGiro <= (stint.lap_end || Infinity)
    );
    
    return stintTrovato ? stintTrovato.compound : "UNKNOWN";
}

function calcolaStatoPistaGiro(inizioGiroMs, fineGiroMs, direzioneCrudi) {
    const statoBase = { stato: "🟢", coloreSfondo: "transparent" };
    
    // Controllo di guardia sui parametri essenziali
    if (!inizioGiroMs || !fineGiroMs || !direzioneCrudi || direzioneCrudi.length === 0) {
        return statoBase;
    }

    // Isola solo i messaggi di questo specifico giro
    const messaggiGiro = direzioneCrudi.filter(msg => {
        if (!msg.date) return false;
        const timestamp = new Date(msg.date).getTime();
        return timestamp >= inizioGiroMs && timestamp <= fineGiroMs;
    });

    // Cerca eventuali bandiere o safety car con priorità (dalla più grave)
    for (const msg of messaggiGiro) {
        const flag = (msg.flag || "").toUpperCase();
        const testo = (msg.message || "").toUpperCase();

        if (flag.includes("RED")) {
            return { stato: "🔴", coloreSfondo: "rgba(255, 0, 0, 0.2)" };
        }
        if (flag.includes("DOUBLE YELLOW") || testo.includes("VIRTUAL SAFETY CAR")) {
            return { stato: "🟡🟡", coloreSfondo: "rgba(255, 165, 0, 0.3)" };
        }
        if (flag.includes("YELLOW") || testo.includes("SAFETY CAR") || testo.includes("SC DEPLOYED")) {
            return { stato: "🟡", coloreSfondo: "rgba(255, 255, 0, 0.2)" };
        }
    }
    
    return statoBase;
}