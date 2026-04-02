// js/tabs/RisultatiPL.js

window.RisultatiPL = {
    renderizza: async function(sessionKeyIgnorata, containerId) {
        const container = document.getElementById(containerId);
        const gpKey = statoApp.chiaveGPCorrente;

        if (!gpKey) {
            container.innerHTML = `<div class="sys-error">[ERR] Selezionare un Gran Premio.</div>`;
            return;
        }

        if (statoApp.uiCache.tabPL && statoApp.uiCache.tabPL[gpKey]) {
            SysLog.info(`RisultatiPL: Tutte le PL caricate dalla CACHE per GP ${gpKey}`);
            container.innerHTML = statoApp.uiCache.tabPL[gpKey];
            this.impostaEventiInterattivi(container);
            return;
        }

        const plSessions = [];
        for (const [nomeSessione, chiave] of Object.entries(statoApp.sessioniDelGPCorrente)) {
            if (nomeSessione.toLowerCase().includes("practice")) {
                plSessions.push({ nome: nomeSessione.toUpperCase(), key: chiave });
            }
        }
        
        plSessions.sort((a, b) => a.key - b.key);

        if (plSessions.length === 0) {
            container.innerHTML = `<div style="color:var(--accent-color);">[WARN] Nessuna sessione di Prove Libere trovata in questo GP.</div>`;
            return;
        }

        container.innerHTML = `<div class="sys-loader">FETCHING MULTI-SESSION TELEMETRY... (Anti-Spam Seq. Mode in corso)</div>`;
        let htmlMultiplo = `<div class="pl-multi-dashboard">`;

        try {
            for (const sess of plSessions) {
                SysLog.info(`RisultatiPL: Elaborazione ${sess.nome} (Key: ${sess.key})...`);
                
                // Fetch Sequenziale Pulito (RIMOSSO L'INESISTENTE TRACK_STATUS)
                const datiPiloti = await recuperaPiloti(sess.key) || [];
                const datiGiri = await recuperaGiri(sess.key) || [];
                const datiMeteo = await recuperaDatiMeteo(sess.key) || [];
                const datiRadio = await recuperaComunicazioniRadio(sess.key) || [];
                const datiRaceControl = await recuperaDirezioneGara(sess.key) || [];
                const datiSessione = await recuperaDettagliSessione(sess.key) || [];

                const pilotiMap = this.elaboraPiloti(datiPiloti);
                const classificaPL = this.calcolaMiglioriGiri(datiGiri, pilotiMap);
                const meteoStats = this.calcolaStatisticheMeteo(datiMeteo);
                
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
                    <div class="pl-session-block" style="margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px dashed var(--border-color);">
                        <h3 style="color:var(--accent-color); margin-bottom:10px; font-weight:bold;">> SESSION: ${sess.nome}</h3>
                        ${this.generaMeteoHTML(meteoStats)}
                        ${this.generaTimelineHTML(sessionStart, sessionEnd, datiRadio, datiRaceControl, pilotiMap)}
                        ${this.generaTabellaHTML(classificaPL)}
                    </div>
                `;
            }

            htmlMultiplo += `<div id="pl-popup-layer" class="sys-popup"></div></div>`;

            statoApp.uiCache.tabPL = statoApp.uiCache.tabPL || {};
            statoApp.uiCache.tabPL[gpKey] = htmlMultiplo;
            container.innerHTML = htmlMultiplo;

            this.impostaEventiInterattivi(container);
            SysLog.info("RisultatiPL: Multi-rendering completato.");

        } catch (err) {
            SysLog.error("RisultatiPL: Errore fatale", err);
            container.innerHTML = `<div class="sys-error" style="color: var(--danger-color);">[FATAL_ERR] ${err.message}</div>`;
        }
    },

    elaboraPiloti: function(datiPiloti) {
        const mappa = {};
        datiPiloti.forEach(p => { if (p.driver_number) mappa[p.driver_number] = p; });
        return mappa;
    },

    calcolaMiglioriGiri: function(datiGiri, pilotiMap) {
        const stats = {};
        datiGiri.forEach(giro => {
            if (!giro.lap_duration || !giro.driver_number) return; 
            const dn = giro.driver_number;
            if (!stats[dn]) {
                stats[dn] = {
                    driver_number: dn,
                    pilota: pilotiMap[dn] || { name_acronym: "UNK", team_colour: "555555" },
                    best_lap_duration: Infinity,
                    best_lap_data: null,
                    laps_count: 0
                };
            }
            stats[dn].laps_count++;
            if (giro.lap_duration < stats[dn].best_lap_duration) {
                stats[dn].best_lap_duration = giro.lap_duration;
                stats[dn].best_lap_data = giro;
            }
        });
        return Object.values(stats)
            .filter(s => s.best_lap_data !== null)
            .sort((a, b) => a.best_lap_duration - b.best_lap_duration);
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
            return {
                min: Math.min(...arr).toFixed(1),
                max: Math.max(...arr).toFixed(1),
                avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
            };
        };
        return { air: calcola(tAir), track: calcola(tTrack), hum: calcola(hum), wind: calcola(wind) };
    },

    generaMeteoHTML: function(stats) {
        if (!stats) return `<div style="color:var(--accent-color); font-size:10px; margin-bottom:5px;">[WARN] METEO_SYS OFF-LINE</div>`;
        return `
            <table class="meteo-micro-table" style="width: 400px;">
                <thead>
                    <tr><th>METEO</th><th>AIR_°C</th><th>TRK_°C</th><th>HUM_%</th><th>WIND_M/S</th></tr>
                </thead>
                <tbody>
                    <tr><td style="color:var(--accent-color)">MAX</td><td>${stats.air.max}</td><td>${stats.track.max}</td><td>${stats.hum.max}</td><td>${stats.wind.max}</td></tr>
                    <tr><td style="color:var(--accent-color)">AVG</td><td>${stats.air.avg}</td><td>${stats.track.avg}</td><td>${stats.hum.avg}</td><td>${stats.wind.avg}</td></tr>
                    <tr><td style="color:var(--accent-color)">MIN</td><td>${stats.air.min}</td><td>${stats.track.min}</td><td>${stats.hum.min}</td><td>${stats.wind.min}</td></tr>
                </tbody>
            </table>
        `;
    },

    // =========================================================================
    // NUOVO MOTORE TIMELINE: Calcola il Track Status analizzando /race_control
    // =========================================================================
    generaTimelineHTML: function(startMs, endMs, datiRadio, datiRaceControl, pilotiMap) {
        const durataTotale = endMs - startMs;
        if (durataTotale <= 0) return `<div>[TIMELINE_ERR]</div>`;

        // 1. Estrapolazione dinamica dello stato della pista (Colori Timeline)
        let trackSegments = [];
        let currentStatus = "status-green"; // Iniziamo da bandiera verde
        let lastTimeMs = startMs;

        if (datiRaceControl && datiRaceControl.length > 0) {
            // Ordiniamo per data per assicurare una linea temporale coerente
            const rcSorted = [...datiRaceControl].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            rcSorted.forEach(rc => {
                if(!rc.date) return;
                const rTime = new Date(rc.date).getTime();
                
                if (rTime >= startMs && rTime <= endMs) {
                    let newStatus = currentStatus;
                    const msgUpper = (rc.message || "").toUpperCase();
                    const flagUpper = (rc.flag || "").toUpperCase();

                    // Parser della Direzione Gara
                    if (flagUpper === "GREEN" || msgUpper.includes("CLEAR")) newStatus = "status-green";
                    else if (flagUpper === "YELLOW" || flagUpper === "DOUBLE YELLOW") newStatus = "status-yellow";
                    else if (flagUpper === "RED" || msgUpper.includes("RED FLAG")) newStatus = "status-red";
                    else if (rc.category === "SafetyCar" || msgUpper.includes("SAFETY CAR") || msgUpper.includes("VSC")) newStatus = "status-orange";

                    // Se lo stato cambia, salviamo il segmento precedente e aggiorniamo
                    if (newStatus !== currentStatus && rTime > lastTimeMs) {
                        trackSegments.push({ status: currentStatus, start: lastTimeMs, end: rTime });
                        currentStatus = newStatus;
                        lastTimeMs = rTime;
                    }
                }
            });
        }
        
        // Chiudiamo l'ultimo segmento fino alla fine della sessione
        if (lastTimeMs < endMs) {
            trackSegments.push({ status: currentStatus, start: lastTimeMs, end: endMs });
        }

        // Generazione HTML degli sfondi (Track Status Segmented)
        let timelineBackgrounds = trackSegments.map(seg => {
            let startPerc = Math.max(0, ((seg.start - startMs) / durataTotale) * 100);
            let widthPerc = ((seg.end - seg.start) / durataTotale) * 100;
            return `<div class="track-status-segment ${seg.status}" style="position:absolute; left:${startPerc}%; width:${widthPerc}%; height:100%;"></div>`;
        }).join('');


        // 2. Icone Team Radio
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

        // 3. Icone Race Control
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
        if (classifica.length === 0) return `<div>[NO_DATA]</div>`;

        let righe = classifica.map((item, index) => {
            const p = item.pilota || {};
            const bl = item.best_lap_data;
            const pos = index + 1;
            const foto = p.headshot_url ? `<img src="${p.headshot_url}" class="foto-pilota" onerror="this.style.display='none'">` : ``;
            const colore = p.team_colour ? `#${p.team_colour}` : `#555555`;
            
            const tTotal = typeof formattaTempo === 'function' ? formattaTempo(item.best_lap_duration) : item.best_lap_duration.toFixed(3);
            const s1 = bl.duration_sector_1 ? bl.duration_sector_1.toFixed(3) : "-";
            const s2 = bl.duration_sector_2 ? bl.duration_sector_2.toFixed(3) : "-";
            const s3 = bl.duration_sector_3 ? bl.duration_sector_3.toFixed(3) : "-";

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
                    <td style="color:#aaa;">${item.laps_count}</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="telemetry-table">
                <thead>
                    <tr>
                        <th>POS</th>
                        <th>DRIVER</th>
                        <th>BEST_LAP</th>
                        <th>S1</th>
                        <th>S2</th>
                        <th>S3</th>
                        <th>TOT_LAPS</th>
                    </tr>
                </thead>
                <tbody>
                    ${righe}
                </tbody>
            </table>
        `;
    },

    impostaEventiInterattivi: function(container) {
        const popup = container.querySelector("#pl-popup-layer");
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