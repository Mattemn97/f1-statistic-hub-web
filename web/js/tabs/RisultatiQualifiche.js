// js/tabs/RisultatiQualifiche.js

window.RisultatiQualifiche = {
    renderizza: async function(sessionKeyIgnorata, containerId) {
        const container = document.getElementById(containerId);
        const gpKey = statoApp.chiaveGPCorrente;

        if (!gpKey) {
            container.innerHTML = `<div class="sys-error">[ERR] Selezionare un Gran Premio.</div>`;
            return;
        }

        if (statoApp.uiCache.tabQuali && statoApp.uiCache.tabQuali[gpKey]) {
            container.innerHTML = statoApp.uiCache.tabQuali[gpKey];
            this.impostaEventiInterattivi(container);
            return;
        }

        const qualiSessions = [];
        for (const [nomeSessione, chiave] of Object.entries(statoApp.sessioniDelGPCorrente)) {
            const nLower = nomeSessione.toLowerCase();
            if (nLower.includes("qualifying") || nLower.includes("shootout") || nLower.includes("sprint quali")) {
                qualiSessions.push({ nome: nomeSessione.toUpperCase(), key: chiave });
            }
        }
        
        qualiSessions.sort((a, b) => a.key - b.key);

        if (qualiSessions.length === 0) {
            container.innerHTML = `<div style="color:var(--accent-color);">[WARN] Nessuna Qualifica trovata.</div>`;
            return;
        }

        container.innerHTML = `<div class="sys-loader">FETCHING QUALIFYING TELEMETRY (Seq. Mode)...</div>`;
        let htmlMultiplo = `<div class="quali-multi-dashboard">`;

        try {
            for (const sess of qualiSessions) {
                const datiPiloti = await recuperaPiloti(sess.key) || [];
                const datiGiri = await recuperaGiri(sess.key) || [];
                const datiMeteo = await recuperaDatiMeteo(sess.key) || [];
                const datiRadio = await recuperaComunicazioniRadio(sess.key) || [];
                const datiRaceControl = await recuperaDirezioneGara(sess.key) || [];
                const datiSessione = await recuperaDettagliSessione(sess.key) || [];
                const datiStint = typeof recuperaStintGomme === 'function' ? await recuperaStintGomme(sess.key) : [];

                const pilotiMap = this.elaboraPiloti(datiPiloti);
                const datiQuali = this.calcolaDatiQualifica(datiGiri, pilotiMap, datiStint);
                const meteoStats = this.calcolaStatisticheMeteo(datiMeteo);
                
                let sStart = 0; let sEnd = 0;
                if (datiSessione && datiSessione.length > 0 && datiSessione[0].date_start) {
                    sStart = new Date(datiSessione[0].date_start).getTime();
                    sEnd = datiSessione[0].date_end ? new Date(datiSessione[0].date_end).getTime() : new Date().getTime();
                } else if (datiGiri && datiGiri.length > 0) {
                    const times = datiGiri.map(g => g.date_start ? new Date(g.date_start).getTime() : 0).filter(t => t > 0);
                    if (times.length > 0) { sStart = Math.min(...times) - 60000; sEnd = Math.max(...times) + 60000; }
                }
                if (sStart === 0) { sStart = Date.now() - 3600000; sEnd = Date.now(); }

                htmlMultiplo += `
                    <div class="quali-session-block" style="margin-bottom:25px; padding-bottom:15px; border-bottom:1px dashed var(--border-color);">
                        <h3 style="color:var(--accent-color); margin-bottom:10px; font-weight:bold;">> SESSION: ${sess.nome}</h3>
                        ${this.generaMeteoHTML(meteoStats)}
                        ${this.generaTimelineHTML(sStart, sEnd, datiRadio, datiRaceControl, pilotiMap)}
                        ${this.generaTabellaHTML(datiQuali)}
                    </div>
                `;
            }

            htmlMultiplo += `<div id="quali-popup-layer" class="sys-popup"></div></div>`;
            statoApp.uiCache.tabQuali = statoApp.uiCache.tabQuali || {};
            statoApp.uiCache.tabQuali[gpKey] = htmlMultiplo;
            container.innerHTML = htmlMultiplo;
            this.impostaEventiInterattivi(container);

        } catch (err) {
            container.innerHTML = `<div class="sys-error">[FATAL_ERR] ${err.message}</div>`;
        }
    },

    elaboraPiloti: function(datiPiloti) {
        const mappa = {};
        datiPiloti.forEach(p => { if (p.driver_number) mappa[p.driver_number] = p; });
        return mappa;
    },

    calcolaDatiQualifica: function(datiGiri, pilotiMap, datiStint) {
        const stats = {};
        let abs_lap = Infinity, abs_s1 = Infinity, abs_s2 = Infinity, abs_s3 = Infinity;
        
        datiGiri.forEach(giro => {
            const dn = giro.driver_number;
            if (!dn) return;

            // Track Absolute Best Sessione
            if (giro.lap_duration && giro.lap_duration < abs_lap) abs_lap = giro.lap_duration;
            if (giro.duration_sector_1 && giro.duration_sector_1 < abs_s1) abs_s1 = giro.duration_sector_1;
            if (giro.duration_sector_2 && giro.duration_sector_2 < abs_s2) abs_s2 = giro.duration_sector_2;
            if (giro.duration_sector_3 && giro.duration_sector_3 < abs_s3) abs_s3 = giro.duration_sector_3;

            if (!stats[dn]) {
                stats[dn] = {
                    driver_number: dn,
                    pilota: pilotiMap[dn] || { name_acronym: "UNK", team_name: "UNK", team_colour: "555" },
                    best_lap_duration: Infinity,
                    best_lap_data: null,
                    best_s1: Infinity, best_s2: Infinity, best_s3: Infinity,
                    stint_gomma: "UNK"
                };
            }

            // Track Personal Best
            if (giro.duration_sector_1 && giro.duration_sector_1 < stats[dn].best_s1) stats[dn].best_s1 = giro.duration_sector_1;
            if (giro.duration_sector_2 && giro.duration_sector_2 < stats[dn].best_s2) stats[dn].best_s2 = giro.duration_sector_2;
            if (giro.duration_sector_3 && giro.duration_sector_3 < stats[dn].best_s3) stats[dn].best_s3 = giro.duration_sector_3;

            // Update Best Lap Oficial
            if (giro.lap_duration && giro.lap_duration < stats[dn].best_lap_duration) {
                stats[dn].best_lap_duration = giro.lap_duration;
                stats[dn].best_lap_data = giro;
                
                if (datiStint && datiStint.length > 0) {
                    const sc = datiStint.find(s => s.driver_number === dn && s.stint_number === giro.stint);
                    if (sc) stats[dn].stint_gomma = sc.compound;
                }
            }
        });

        const classifica = Object.values(stats)
            .filter(s => s.best_lap_data !== null)
            .sort((a, b) => a.best_lap_duration - b.best_lap_duration);

        if (classifica.length === 0) return { classifica: [], absolutes: {} };

        const leaderTime = classifica[0].best_lap_duration;

        classifica.forEach((item, index) => {
            item.gap_leader = index === 0 ? "-" : "+" + (item.best_lap_duration - leaderTime).toFixed(3);
            item.gap_ahead = index === 0 ? "-" : "+" + (item.best_lap_duration - classifica[index - 1].best_lap_duration).toFixed(3);

            if (item.best_s1 !== Infinity && item.best_s2 !== Infinity && item.best_s3 !== Infinity) {
                item.giro_ideale = item.best_s1 + item.best_s2 + item.best_s3;
                item.delta_ideale = "+" + (item.best_lap_duration - item.giro_ideale).toFixed(3);
            } else {
                item.giro_ideale = null; item.delta_ideale = "-";
            }

            const compagni = classifica.filter(c => c.pilota.team_name === item.pilota.team_name && c.driver_number !== item.driver_number);
            if (compagni.length > 0) {
                const btt = Math.min(...compagni.map(c => c.best_lap_duration));
                const diff = item.best_lap_duration - btt;
                item.gap_teammate = diff > 0 ? "+" + diff.toFixed(3) : diff.toFixed(3);
            } else {
                item.gap_teammate = "-";
            }
        });

        return { classifica, absolutes: { lap: abs_lap, s1: abs_s1, s2: abs_s2, s3: abs_s3 } };
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
        const c = (arr) => arr.length === 0 ? { min: "-", max: "-", avg: "-" } : { min: Math.min(...arr).toFixed(1), max: Math.max(...arr).toFixed(1), avg: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) };
        return { air: c(tAir), track: c(tTrack), hum: c(hum), wind: c(wind) };
    },

    generaMeteoHTML: function(stats) {
        if (!stats) return `<div style="color:var(--accent-color); font-size:10px;">[WARN] METEO_SYS OFF-LINE</div>`;
        return `
            <table class="meteo-micro-table" style="width: 400px; margin-bottom:10px;">
                <thead><tr><th>METEO_SYS</th><th>AIR_°C</th><th>TRK_°C</th><th>HUM_%</th><th>WIND_M/S</th></tr></thead>
                <tbody>
                    <tr><td style="color:var(--accent-color)">MAX</td><td>${stats.air.max}</td><td>${stats.track.max}</td><td>${stats.hum.max}</td><td>${stats.wind.max}</td></tr>
                    <tr><td style="color:var(--accent-color)">AVG</td><td>${stats.air.avg}</td><td>${stats.track.avg}</td><td>${stats.hum.avg}</td><td>${stats.wind.avg}</td></tr>
                    <tr><td style="color:var(--accent-color)">MIN</td><td>${stats.air.min}</td><td>${stats.track.min}</td><td>${stats.hum.min}</td><td>${stats.wind.min}</td></tr>
                </tbody>
            </table>
        `;
    },

    generaTimelineHTML: function(startMs, endMs, datiRadio, datiRaceControl, pilotiMap) {
        const dTot = endMs - startMs;
        if (dTot <= 0) return `<div>[TIMELINE_ERR]</div>`;

        let tSeg = []; let currStatus = "status-green"; let lTime = startMs;
        if (datiRaceControl && datiRaceControl.length > 0) {
            const rcS = [...datiRaceControl].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            rcS.forEach(rc => {
                if(!rc.date) return;
                const rTime = new Date(rc.date).getTime();
                if (rTime >= startMs && rTime <= endMs) {
                    let nStatus = currStatus;
                    const msgU = (rc.message || "").toUpperCase();
                    const flagU = (rc.flag || "").toUpperCase();
                    if (flagU === "GREEN" || msgU.includes("CLEAR")) nStatus = "status-green";
                    else if (flagU === "YELLOW" || flagU === "DOUBLE YELLOW") nStatus = "status-yellow";
                    else if (flagU === "RED" || msgU.includes("RED FLAG")) nStatus = "status-red";
                    else if (rc.category === "SafetyCar" || msgU.includes("SAFETY CAR") || msgU.includes("VSC")) nStatus = "status-orange";

                    if (nStatus !== currStatus && rTime > lTime) {
                        tSeg.push({ status: currStatus, start: lTime, end: rTime });
                        currStatus = nStatus; lTime = rTime;
                    }
                }
            });
        }
        if (lTime < endMs) tSeg.push({ status: currStatus, start: lTime, end: endMs });

        let tBg = tSeg.map(seg => {
            let sP = Math.max(0, ((seg.start - startMs) / dTot) * 100);
            let wP = ((seg.end - seg.start) / dTot) * 100;
            return `<div class="track-status-segment ${seg.status}" style="position:absolute; left:${sP}%; width:${wP}%; height:100%;"></div>`;
        }).join('');

        let rIcons = "";
        if (datiRadio) {
            datiRadio.forEach(r => {
                if(!r.date) return;
                const rT = new Date(r.date).getTime();
                if(rT >= startMs && rT <= endMs) {
                    const pS = pilotiMap[r.driver_number] ? pilotiMap[r.driver_number].name_acronym : `CAR ${r.driver_number}`;
                    rIcons += `<div class="timeline-icon-top" style="left:${((rT - startMs) / dTot) * 100}%;" data-tipo="radio" data-pilota="${pS}" data-audio="${r.recording_url || ""}">📻</div>`;
                }
            });
        }

        let rcIcons = "";
        if (datiRaceControl) {
            datiRaceControl.forEach(rc => {
                if(!rc.date || !rc.message) return;
                const rT = new Date(rc.date).getTime();
                if(rT >= startMs && rT <= endMs) {
                    const msgL = rc.message.replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                    rcIcons += `<div class="timeline-icon-bottom" style="left:${((rT - startMs) / dTot) * 100}%;" data-tipo="rc" data-msg="${msgL}">⚠️</div>`;
                }
            });
        }

        return `<div class="timeline-wrapper"><div class="timeline-bar">${tBg}</div>${rIcons}${rcIcons}</div>`;
    },

    generaTabellaHTML: function(datiQuali) {
        const { classifica, absolutes } = datiQuali;
        if (classifica.length === 0) return `<div>[NO_DATA]</div>`;

        // Format Colors: Magenta -> Verde -> Bianco
        const fmtSec = (val, pBest, aBest) => {
            if (!val) return "-";
            let c = "f1-regular"; // Bianco
            if (val <= aBest) c = "f1-purple"; // Absolute
            else if (val <= pBest) c = "f1-green"; // Personal
            return `<span class="${c}">${val.toFixed(3)}</span>`;
        };

        let righe = classifica.map((item, index) => {
            const p = item.pilota || {};
            const bl = item.best_lap_data;
            const pos = index + 1;
            const foto = p.headshot_url ? `<img src="${p.headshot_url}" class="foto-pilota" onerror="this.style.display='none'">` : ``;
            const colore = p.team_colour ? `#${p.team_colour}` : `#555555`;
            
            let cGomma = "#ffffff"; let nGomma = (item.stint_gomma || "UNK").toUpperCase();
            if(nGomma==="SOFT") cGomma="#ff3333"; if(nGomma==="MEDIUM") cGomma="#ffff00"; if(nGomma==="HARD") cGomma="#ffffff";
            if(nGomma==="INTERMEDIATE") cGomma="#00aa00"; if(nGomma==="WET") cGomma="#0055ff";

            const strT = typeof formattaTempo === 'function' ? formattaTempo(item.best_lap_duration) : item.best_lap_duration.toFixed(3);
            const strId = item.giro_ideale ? (typeof formattaTempo === 'function' ? formattaTempo(item.giro_ideale) : item.giro_ideale.toFixed(3)) : "-";
            
            let cLap = (item.best_lap_duration <= absolutes.lap) ? "f1-purple" : "f1-green";
            let cIdeale = (item.giro_ideale && item.giro_ideale <= absolutes.lap) ? "f1-purple" : "f1-regular";

            const s1H = fmtSec(bl.duration_sector_1, item.best_s1, absolutes.s1);
            const s2H = fmtSec(bl.duration_sector_2, item.best_s2, absolutes.s2);
            const s3H = fmtSec(bl.duration_sector_3, item.best_s3, absolutes.s3);

            let cTeam = "var(--text-color)";
            if (item.gap_teammate.startsWith("-")) cTeam = "#00ff00"; 
            else if (item.gap_teammate.startsWith("+")) cTeam = "var(--danger-color)"; 

            return `
                <tr>
                    <td style="color:#888;">P${pos}</td>
                    <td style="border-left: 4px solid ${colore}">
                        ${foto} <span style="color:var(--text-color);">${p.first_name || ""} ${p.last_name || ""}</span> <span style="color:var(--accent-color)">#${item.driver_number}</span>
                    </td>
                    <td><span class="${cLap}">${strT}</span></td>
                    <td>${s1H}</td>
                    <td>${s2H}</td>
                    <td>${s3H}</td>
                    <td style="color:#aaa;">${item.gap_leader}</td>
                    <td style="color:#aaa;">${item.gap_ahead}</td>
                    <td style="color:${cTeam};">${item.gap_teammate}</td>
                    <td><span class="${cIdeale}">${strId}</span></td>
                    <td>${item.delta_ideale}</td>
                    <td style="color:${cGomma}; font-weight:bold;">${nGomma}</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="telemetry-table">
                <thead>
                    <tr><th>POS</th><th>DRIVER</th><th>Q_TIME</th><th>S1</th><th>S2</th><th>S3</th><th>GAP_LDR</th><th>GAP_AHD</th><th>GAP_TEAM</th><th>IDEAL_LAP</th><th>DELTA</th><th>TYRE</th></tr>
                </thead>
                <tbody>${righe}</tbody>
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
                popup.style.display = "none"; return;
            }

            popup.style.left = `${e.clientX - 20}px`; popup.style.top = `${e.clientY + 20}px`; popup.style.display = "block";

            if (target.classList.contains("timeline-icon-top")) {
                const p = target.getAttribute("data-pilota"); const aUrl = target.getAttribute("data-audio");
                popup.innerHTML = `<div style="color:var(--accent-color); font-weight:bold;">[RADIO] ${p}</div>
                                   ${aUrl && aUrl !== "null" ? `<button class="btn-action play-btn" style="margin-top:5px; width:100%;">[PLAY]</button>` : `<div style="margin-top:5px; color:#777;">No Stream</div>`}`;
                const btn = popup.querySelector('.play-btn');
                if (btn && aUrl && aUrl !== "null") {
                    btn.onclick = () => {
                        if (currentAudio) { currentAudio.pause(); currentAudio.currentTime = 0; }
                        currentAudio = new Audio(aUrl); currentAudio.play().catch(e => SysLog.error("Audio:", e));
                        btn.innerText = "[PLAYING...]"; currentAudio.onended = () => btn.innerText = "[PLAY]";
                    };
                }
            } else if (target.classList.contains("timeline-icon-bottom")) {
                popup.innerHTML = `<div style="color:var(--danger-color); font-weight:bold;">[RACE_CTRL]</div><div style="margin-top:5px; max-width:200px;">${target.getAttribute("data-msg")}</div>`;
            }
        });
    }
};