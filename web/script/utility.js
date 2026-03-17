// ==========================================
// FUNZIONI DI SUPPORTO (UTILITY)
// ==========================================

function Logger(type, msg, data = "") {
    switch (type) {
        case "info":
            console.info(`🔵 [F1-APP] ${msg}`, data);
            break;
        case "success":
            console.log(`🟢 [F1-APP] ${msg}`, data);
            break;
        case "warn":
            console.warn(`🟠 [F1-APP] ${msg}`, data);
            break;
        case "error":
            console.error(`🔴 [F1-APP] ${msg}`, data);
            break;
    }
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return "-";
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(3);
    return m > 0 ? `${m}:${s.padStart(6, '0')}` : s.padStart(6, '0');
}

function formatGap(gapSeconds, isLapped = false) {
    if (isLapped) return `<span class="w3-text-grey">+${gapSeconds} Lap${gapSeconds > 1 ? 's' : ''}</span>`;
    if (!gapSeconds || isNaN(gapSeconds) || gapSeconds === 0) return "-";
    return `+${gapSeconds.toFixed(3)}`;
}

// Funzione per tradurre la gomma in un pallino colorato
function renderTyres(stintsArray) {
    if (!stintsArray || stintsArray.length === 0) return "-";
    // Ordiniamo per numero stint
    stintsArray.sort((a, b) => a.stint_number - b.stint_number);
    let html = "";
    stintsArray.forEach(s => {
        let color = "#333"; // default unknown
        let letter = "?";
        if (s.compound === "SOFT") { color = "#ff2800"; letter = "S"; }
        else if (s.compound === "MEDIUM") { color = "#f5d033"; letter = "M"; }
        else if (s.compound === "HARD") { color = "#ffffff"; letter = "H"; }
        else if (s.compound === "INTERMEDIATE") { color = "#39b54a"; letter = "I"; }
        else if (s.compound === "WET") { color = "#0aeeef"; letter = "W"; }
        
        html += `<span style="display:inline-block; width:18px; height:18px; border-radius:50%; background-color:${color}; color:${s.compound === 'HARD' ? '#000' : '#fff'}; text-align:center; line-height:18px; font-weight:bold; font-size:10px; margin-right:2px; border: 1px solid #ccc;">${letter}</span>`;
    });
    return html;
}

function getSessionType(sessionKey) {
    const session = cached_session_for_meeting.find(s => s.session_key == sessionKey);
    if (!session) return "UNKNOWN";
    const name = session.session_name.toLowerCase();
    if (name.includes("race") || (name.includes("sprint") && !name.includes("shootout") && !name.includes("qualifying"))) {
        return "RACE";
    }
    return "QUALI";
}