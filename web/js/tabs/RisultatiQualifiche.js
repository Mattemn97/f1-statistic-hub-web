// js/tabs/RisultatiQualifiche.js

window.RisultatiQualifiche = {
    renderizza: async function(sessionKeyIgnorata, containerId) {
        const container = document.getElementById(containerId);
        const gpKey = statoApp.chiaveGPCorrente;

        if (!gpKey) {
            container.innerHTML = `<div class="sys-error">[ERR] Selezionare un Gran Premio.</div>`;
            return;
        }

        // 1. CONTROLLO CACHE (Legata al GP)
        if (statoApp.uiCache.tabQuali && statoApp.uiCache.tabQuali[gpKey]) {
            SysLog.info(`RisultatiQualifiche: Dati UI recuperati dalla CACHE per GP ${gpKey}`);
            container.innerHTML = statoApp.uiCache.tabQuali[gpKey];
            this.impostaEventiInterattivi(container);
            return;
        }

        // 2. TROVA TUTTE LE SESSIONI DI QUALIFICA DEL GP
        const qualiSessions = [];
        for (const [nomeSessione, chiave] of Object.entries(statoApp.sessioniDelGPCorrente)) {
            const nomeLower = nomeSessione.toLowerCase();
            // Cerca le qualifiche standard e quelle Sprint
            if (nomeLower.includes("qualifying") || nomeLower.includes("shootout") || nomeLower.includes("sprint quali")) {
                qualiSessions.push({ nome: nomeSessione.toUpperCase(), key: chiave });
            }
        }
        
        qualiSessions.sort((a, b) => a.key - b.key);

        if (qualiSessions.length === 0) {
            container.innerHTML = `<div style="color:var(--accent-color);">[WARN] Nessuna sessione di Qualifica trovata in questo GP.</div>`;
            return;
        }

        container.innerHTML = `<div class="sys-loader">FETCHING MULTI-SESSION QUALIFYING TELEMETRY... (Anti-Spam Seq. Mode in corso)</div>`;
        let htmlMultiplo = `<div class="quali-multi-dashboard">`;

        try {
            // 3. FETCH SEQUENZIALE (Anti-Rate Limit 429)
            for (const sess of qualiSessions) {
                SysLog.info(`RisultatiQualifiche: Elaborazione ${sess.nome} (Key: ${sess.key})...`);
                
                // NOTA: Niente track_status, estraiamo i dati da race_control
                const datiPiloti = await recuperaPiloti(sess.key) || [];
                const datiGiri = await recuperaGiri(sess.key) || [];
                const datiMeteo = await recuperaDatiMeteo(sess.key) || [];
                const datiRadio = await recuperaComunicazioniRadio(sess.key) || [];
                const datiRaceControl = await recuperaDirezioneGara(sess.key) || [];
                const datiSessione = await recuperaDettagliSessione(sess.key) || [];
                // Usiamo la funzione specifica definita in api.js per le gomme
                const datiStint = typeof recuperaStintGomme === 'function' ? await recuperaStintGomme(sess.key) : [];

                // 4. ELABORAZIONE DATI
                const pilotiMap = this.elaboraPiloti(datiPiloti);
                const classificaQuali = this.calcolaDatiQualifica(datiGiri, pilotiMap, datiStint);
                const meteoStats = this.calcolaStatisticheMeteo(datiMeteo);
                
                // Fallback Temporale
                let sessionStart = 0; let sessionEnd = 0;
                if (datiSessione && datiSessione.length > 0 && datiSessione[0].date_start) {
                    sessionStart = new Date(datiSessione[0].date_start).getTime();
                    sessionEnd = datiSessione[0].date_end ? new Date(datiSessione[0].date_end).getTime() : new Date().getTime();
                } else if (datiGiri && datiGiri.length > 0) {
                    const timestamps = datiGiri.map(g => g.date_start ? new Date(g.date_start).getTime() : 0).filter(t => t > 0);
                    if (timestamps.length > 0) {
                        sessionStart = Math.min(...timestamps) - 60000;
                        sessionEnd = Math.max(...timestamps) + 60000;
                    }
                }
                if (sessionStart === 0) { sessionStart = Date.now() - 3600000; sessionEnd = Date.now(); }

                htmlMultiplo += `
                    <div class="quali-session-block" style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dashed var(--border-color);">
                        <h3 style="color:var(--accent-color); margin-bottom:10px; font-weight:bold;">> SESSION: ${sess.nome}</h3>
                        ${this.generaMeteoHTML(meteoStats)}
                        ${this.generaTimelineHTML(sessionStart, sessionEnd, datiRadio, datiRaceControl, pilotiMap)}
                        ${this.generaTabellaHTML(classificaQuali)}
                    </div>
                `;
            }

            // Livello popup unico in fondo al contenitore
            htmlMultiplo += `<div id="quali-popup-layer" class="sys-popup"></div></div>`;

            // 5. SALVATAGGIO IN CACHE E INIEZIONE
            statoApp.uiCache.tabQuali = statoApp.uiCache.tabQuali || {};
            statoApp.uiCache.tabQuali[gpKey] = htmlMultiplo;
            container.innerHTML = htmlMultiplo;

            // 6. BINDING EVENTI
            this.impostaEventiInterattivi(container);
            
            SysLog.info("RisultatiQualifiche: Multi-rendering completato.");

        } catch (err) {
            SysLog.error("RisultatiQualifiche: Errore fatale", err);
            container.innerHTML = `<div class="sys-error" style="color: var(--danger-color);">[FATAL_ERR] ${err.message}</div>`;
        }
    },

    elaboraPiloti: function(datiPiloti) {
        const mappa = {};
        datiPiloti.forEach(p => { if (p.driver_number) mappa[p.driver_number] = p; });
        return mappa;
    },

    /**
     * Motore analitico delle Qualifiche: Best Lap, Best Sectors Assoluti, Gap e Delta.
     */
    calcolaDatiQualifica: function(datiGiri, pilotiMap, datiStint) {
        const stats = {};
        
        datiGiri.forEach(giro => {
            const dn = giro.driver_number;
            if (!dn) return;
            
            if (!stats[dn]) {
                stats[dn] = {
                    driver_number: dn,
                    pilota: pilotiMap[dn] || { name_acronym: "UNK", team_name: "UNK" },
                    best_lap_duration: Infinity,
                    best_lap_data: null,
                    best_s1: Infinity,
                    best_s2: Infinity,
                    best_s3: Infinity,
                    stint_gomma: "UNK"
                };
            }

            if (giro.duration_sector_1 && giro.duration_sector_1 < stats[dn].best_s1) stats[dn].best_s1 = giro.duration_sector_1;
            if (giro.duration_sector_2 && giro.duration_sector_2 < stats[dn].best_s2) stats[dn].best_s2 = giro.duration_sector_2;
            if (giro.duration_sector_3 && giro.duration_sector_3 < stats[dn].best_s3) stats[dn].best_s3 = giro.duration_sector_3;

            if (giro.lap_duration && giro.lap_duration < stats[dn].best_lap_duration) {
                stats[dn].best_lap_duration = giro.lap_duration;
                stats[dn].best_lap_data = giro;
                
                if (datiStint && datiStint.length > 0) {
                    const stintCorrispondente = datiStint.find(s => s.driver_number === dn && s.stint_number === giro.stint);
                    if (stintCorrispondente) stats[dn].stint_gomma = stintCorrispondente.compound;
                }
            }
        });

        const classifica = Object.values(stats)
            .filter(s => s.best_lap_data !== null)
            .sort((a, b) => a.best_lap_duration - b.best_lap_duration);

        if (classifica.length === 0) return [];

        const leaderTime = classifica[0].best_lap_duration;

        classifica.forEach((item, index) => {
            item.gap_leader = index === 0 ? "-" : "+" + (item.best_lap_duration - leaderTime).toFixed(3);
            item.gap_ahead = index === 0 ? "-" : "+" + (item.best_lap_duration - classifica[index - 1].best_lap_duration).toFixed(3);

            if (item.best_s1 !== Infinity && item.best_s2 !== Infinity && item.best_s3 !== Infinity) {
                item.giro_ideale = item.best_s1 + item.best_s2 + item.best_s3;
                item.delta_ideale = "+" + (item.best_lap_duration - item.giro_ideale).toFixed(3);
            } else {
                item.giro_ideale = null;
                item.delta_ideale = "-";
            }

            const mioTeam = item.pilota.team_name;
            const compagni = classifica.filter(c => c.pilota.team_name === mioTeam && c.driver_number !== item.driver_number);
            if (compagni.length > 0) {
                const bestTeammateTime = Math.min(...compagni.map(c => c.best_lap_duration));
                const diff = item.best_lap_duration - bestTeammateTime;
                item.gap_teammate = diff > 0 ? "+" + diff.toFixed(3) : diff.toFixed(3);
            } else {
                item.gap_teammate = "-";
            }
        });

        return classifica;
    },

    calcolaStatisticheMeteo: function(datiMeteo) {
        if (!datiMeteo || datiMeteo.length === 0) return null;
        let tAir = [], tTrack = [], hum = [], wind = [];
        datiMeteo.forEach(m => {
            if (m.air_temperature !== null) tAir.push(m.air_temperature);
            if (m.track_temperature !== null) tTrack.push(m.track_temperature);
            if (m.humidity !== null) hum.push(m.humidity);
            if (m.wind_speed !== null) wind.push(m.wind_speed);
        });
        const calcola = (arr) => {
            if (arr.length === 0) return { min: "-", max: "-", avg: "-" };
            return { min: Math.min(...arr).toFixed(1), max: Math.max(...arr).toFixed(1), avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) };
        };
        return { air: calcola(tAir), track: calcola(tTrack), hum: calcola(hum), wind: calcola(wind) };
    },

    generaMeteoHTML: function(stats) {
        if (!stats) return `<div style="color:var(--accent-color); font-size:10px; margin-bottom:5px;">[WARN] METEO_SYS OFF-LINE</div>`;
        return `
            <table class="meteo-micro-table" style="width: 400px;">
                <thead>
                    <tr><th>METEO_SYS</th><th>AIR_TEMP_°C</th><th>TRK_TEMP_°C</th><th>HUMIDITY_%</th><th>WIND_M/S</th></tr>
                </thead>
                <tbody>
                    <tr><td style="color:var(--accent-color)">MAX</td><td>${stats.air.max}</td><td>${stats.track.max}</td><td>${stats.hum.max}</td><td>${stats.wind.max}</td></tr>
                    <tr><td style="color:var(--accent-color)">AVG</td><td>${stats.air.avg}</td><td>${stats.track.avg}</td><td>${stats.hum.avg}</td><td>${stats.wind.avg}</td></tr>
                    <tr><td style="color:var(--accent-color)">MIN</td><td>${stats.air.min}</td><td>${stats.track.min}</td><td>${stats.hum.min}</td><td>${stats.wind.min}</td></tr>
                </tbody>
            </table>
        `;
    },

    // MOTORE TIMELINE BASATO SU DIREZIONE GARA (Evita il 404 del track_status)
    generaTimelineHTML: function(startMs, endMs, datiRadio, datiRaceControl, pilotiMap) {
        const durataTotale = endMs - startMs;
        if (durataTotale <= 0) return `<div>[TIMELINE_ERR] INVALID DURATION</div>`;

        let trackSegments = [];
        let currentStatus = "status-green"; 
        let lastTimeMs = startMs;

        if (datiRaceControl && datiRaceControl.length > 0) {
            const rcSorted = [...datiRaceControl].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            rcSorted.forEach(rc => {
                if(!rc.date) return;
                const rTime = new Date(rc.date).getTime();
                
                if (rTime >= startMs && rTime <= endMs) {
                    let newStatus = currentStatus;
                    const msgUpper = (rc.message || "").toUpperCase();
                    const flagUpper = (rc.flag || "").toUpperCase();

                    if (flagUpper === "GREEN" || msgUpper.includes("CLEAR")) newStatus = "status-green";
                    else if (flagUpper === "YELLOW" || flagUpper === "DOUBLE YELLOW") newStatus = "status-yellow";
                    else if (flagUpper === "RED" || msgUpper.includes("RED FLAG")) newStatus = "status-red";
                    else if (rc.category === "SafetyCar" || msgUpper.includes("SAFETY CAR") || msgUpper.includes("VSC")) newStatus = "status-orange";

                    if (newStatus !== currentStatus && rTime > lastTimeMs) {
                        trackSegments.push({ status: currentStatus, start: lastTimeMs, end: rTime });
                        currentStatus = newStatus;
                        lastTimeMs = rTime;
                    }
                }
            });
        }
        
        if (lastTimeMs < endMs) {
            trackSegments.push({ status: currentStatus, start: lastTimeMs, end: endMs });
        }

        let timelineBackgrounds = trackSegments.map(seg => {
            let startPerc = Math.max(0, ((seg.start - startMs) / durataTotale) * 100);
            let widthPerc = ((seg.end - seg.start) / durataTotale) * 100;
            return `<div class="track-status-segment ${seg.status}" style="position:absolute; left:${startPerc}%; width:${widthPerc}%; height:100%;"></div>`;
        }).join('');

        let radioIcons = "";
        if (datiRadio) {
            datiRadio.forEach(radio => {
                if(!radio.date) return;
                const rTime = new Date(radio.date).getTime();
                if(rTime >= startMs && rTime <= endMs) {
                    const leftPerc = ((rTime - startMs) / durataTotale) * 100;
                    const pilotaStr = pilotiMap[radio.driver_number] ? pilotiMap[radio.driver_number].name_acronym : `CAR ${radio.driver_number}`;
                    const audioUrl = radio.recording_url || ""; 
                    radioIcons += `<div class="timeline-icon-top" style="left:${leftPerc}%;" data-tipo="radio" data-pilota="${pilotaStr}" data-audio="${audioUrl}">📻</div>`;
                }
            });
        }

        let rcIcons = "";
        if (datiRaceControl) {
            datiRaceControl.forEach(rc => {
                if(!rc.date || !rc.message) return;
                const rTime = new Date(rc.date).getTime();
                if(rTime >= startMs && rTime <= endMs) {
                    const leftPerc = ((rTime - startMs) / durataTotale) * 100;
                    const msgLimpido = rc.message.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                    rcIcons += `<div class="timeline-icon-bottom" style="left:${leftPerc}%;" data-tipo="rc" data-msg="${msgLimpido}">⚠️</div>`;
                }
            });
        }

        return `
            <div class="timeline-wrapper">
                <div class="timeline-bar">${timelineBackgrounds}</div>
                ${radioIcons}
                ${rcIcons}
            </div>
        `;
    },

    generaTabellaHTML: function(classifica) {
        if (classifica.length === 0) return `<div>[NO_DATA] Nessun giro valido registrato in qualifica.</div>`;

        let righe = classifica.map((item, index) => {
            const p = item.pilota || {};
            const bl = item.best_lap_data;
            const pos = index + 1;
            const foto = p.headshot_url ? `<img src="${p.headshot_url}" class="foto-pilota" onerror="this.style.display='none'">` : ``;
            const colore = p.team_colour ? `#${p.team_colour}` : `#555555`;
            
            // Colore mescola F1 standard (Soft=Rosso, Med=Giallo, Hard=Bianco, Inter=Verde, Wet=Blu)
            let coloreGomma = "#ffffff";
            let nomeGomma = (item.stint_gomma || "UNK").toUpperCase();
            if(nomeGomma === "SOFT") coloreGomma = "#ff3333";
            if(nomeGomma === "MEDIUM") coloreGomma = "#ffff00";
            if(nomeGomma === "HARD") coloreGomma = "#ffffff";
            if(nomeGomma === "INTERMEDIATE") coloreGomma = "#00aa00";
            if(nomeGomma === "WET") coloreGomma = "#0055ff";

            // Gestione utility formattaTempo
            const tTotal = typeof formattaTempo === 'function' ? formattaTempo(item.best_lap_duration) : item.best_lap_duration.toFixed(3);
            const tIdeale = item.giro_ideale ? (typeof formattaTempo === 'function' ? formattaTempo(item.giro_ideale) : item.giro_ideale.toFixed(3)) : "-";
            
            const s1 = bl.duration_sector_1 ? bl.duration_sector_1.toFixed(3) : "-";
            const s2 = bl.duration_sector_2 ? bl.duration_sector_2.toFixed(3) : "-";
            const s3 = bl.duration_sector_3 ? bl.duration_sector_3.toFixed(3) : "-";

            // Formattazione colore gap teammate (Verde se ha battuto il compagno, Rosso se ha perso)
            let colorTeammate = "var(--text-color)";
            if (item.gap_teammate.startsWith("-")) colorTeammate = "#00ff00"; 
            else if (item.gap_teammate.startsWith("+")) colorTeammate = "var(--danger-color)"; 

            return `
                <tr>
                    <td style="color:#888;">P${pos}</td>
                    <td style="border-left: 4px solid ${colore}">
                        ${foto} <span style="color:var(--text-color);">${p.first_name || ""} ${p.last_name || ""}</span> <span style="color:var(--accent-color)">#${item.driver_number}</span>
                    </td>
                    <td style="font-weight:bold; color:var(--terminal-green);">${tTotal}</td>
                    <td>${s1}</td>
                    <td>${s2}</td>
                    <td>${s3}</td>
                    <td style="color:#aaa;">${item.gap_leader}</td>
                    <td style="color:#aaa;">${item.gap_ahead}</td>
                    <td style="color:${colorTeammate};">${item.gap_teammate}</td>
                    <td style="color:var(--accent-color);">${tIdeale}</td>
                    <td>${item.delta_ideale}</td>
                    <td style="color:${coloreGomma}; font-weight:bold;">${nomeGomma}</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="telemetry-table">
                <thead>
                    <tr>
                        <th>POS</th>
                        <th>DRIVER</th>
                        <th>Q_TIME</th>
                        <th>S1</th>
                        <th>S2</th>
                        <th>S3</th>
                        <th>GAP_LDR</th>
                        <th>GAP_AHD</th>
                        <th>GAP_TEAM</th>
                        <th>IDEAL_LAP</th>
                        <th>DELTA</th>
                        <th>TYRE</th>
                    </tr>
                </thead>
                <tbody>
                    ${righe}
                </tbody>
            </table>
        `;
    },

    impostaEventiInterattivi: function(container) {
        const popup = container.querySelector("#quali-popup-layer");
        if (!popup) return;

        let currentAudio = null;

        container.addEventListener("click", (e) => {
            const target = e.target;
            if (!target.classList.contains("timeline-icon-top") && !target.classList.contains("timeline-icon-bottom")) {
                popup.style.display = "none";
                return;
            }

            popup.style.left = `${e.clientX - 20}px`;
            popup.style.top = `${e.clientY + 20}px`;
            popup.style.display = "block";

            if (target.classList.contains("timeline-icon-top")) {
                const pilota = target.getAttribute("data-pilota");
                const audioUrl = target.getAttribute("data-audio");
                
                popup.innerHTML = `
                    <div style="color:var(--accent-color); font-weight:bold;">[RADIO] ${pilota}</div>
                    ${audioUrl && audioUrl !== "null" ? `<button class="btn-action play-btn" style="margin-top:5px; width:100%;">[PLAY_AUDIO]</button>` : `<div style="margin-top:5px; color:#777;">No Audio Stream</div>`}
                `;

                const playBtn = popup.querySelector('.play-btn');
                if (playBtn && audioUrl && audioUrl !== "null") {
                    playBtn.onclick = () => {
                        if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
                        currentAudio = new Audio(audioUrl);
                        currentAudio.play().catch(e => SysLog.error("Audio block:", e));
                        playBtn.innerText = "[PLAYING...]";
                        currentAudio.onended = () => playBtn.innerText = "[PLAY_AUDIO]";
                    };
                }
            } else if (target.classList.contains("timeline-icon-bottom")) {
                const msg = target.getAttribute("data-msg");
                popup.innerHTML = `<div style="color:var(--danger-color); font-weight:bold;">[RACE_CTRL]</div><div style="margin-top:5px; max-width:200px; white-space:normal;">${msg}</div>`;
            }
        });
    }
};