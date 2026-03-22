// js/graph.js

function popolaSelectDaJson(idSelect, datiJson) {
    const select = document.getElementById(idSelect);
    if (!select) return;
    
    select.innerHTML = "";
    
    if (!Array.isArray(datiJson) || datiJson.length === 0) return;

    for (const elemento of datiJson) {
        const opzione = document.createElement("option");
        // Legge le chiavi formattate dal Cuoco
        opzione.value = elemento.valore || Object.values(elemento)[0];
        opzione.innerText = elemento.testo || Object.values(elemento)[0];
        select.appendChild(opzione);
    }
}

function aggiornaInterfacciaSchede(bottoneCliccato, idScheda) {
    const bottoni = document.querySelectorAll('.tab-link');
    bottoni.forEach(btn => btn.classList.remove('w3-blue'));
    if (bottoneCliccato) bottoneCliccato.classList.add('w3-blue');

    const contenuti = document.querySelectorAll('.tab-content');
    contenuti.forEach(contenuto => contenuto.style.display = 'none');

    const schedaTarget = document.getElementById(idScheda);
    if (schedaTarget) schedaTarget.style.display = 'block';
}

function mostraContenitoreDati(idScheda, sessioneEsiste) {
    const suffisso = idScheda.replace('scheda-', '');
    const contenitore = document.getElementById(`contenitore-dati-${suffisso}`);
    const avviso = document.getElementById(`avviso-assenza-${suffisso}`);

    if (sessioneEsiste) {
        if (contenitore) contenitore.style.display = 'block';
        if (avviso) avviso.style.display = 'none';
    } else {
        if (contenitore) contenitore.style.display = 'none';
        if (avviso) avviso.style.display = 'block';
    }
}

function popolaTabellaDaJson(idTabella, datiJson) {
    const tabella = document.getElementById(idTabella);
    if (!tabella) return;
    
    if (!Array.isArray(datiJson) || datiJson.length === 0) {
        tabella.innerHTML = "<tr><td class='w3-center w3-padding-16'>Nessun dato disponibile.</td></tr>";
        return;
    }

    tabella.innerHTML = "";
    const intestazione = document.createElement("thead");
    const corpo = document.createElement("tbody");
    const chiaviColonne = Object.keys(datiJson[0]);

    const rigaIntestazione = document.createElement("tr");
    rigaIntestazione.className = "w3-dark-grey";
    for (const chiave of chiaviColonne) {
        const cellaIntestazione = document.createElement("th");
        cellaIntestazione.innerHTML = chiave; 
        cellaIntestazione.className = "w3-center";
        rigaIntestazione.appendChild(cellaIntestazione);
    }
    intestazione.appendChild(rigaIntestazione);

    for (const elemento of datiJson) {
        const riga = document.createElement("tr");
        riga.className = "w3-hover-light-grey";

        for (const chiave of chiaviColonne) {
            const cellaDato = document.createElement("td");
            let valore = elemento[chiave];
            
            if (valore === null || valore === undefined) {
                valore = "-";
            } else if (typeof valore === "object") {
                valore = JSON.stringify(valore); 
            }

            cellaDato.innerHTML = valore; // Modifica fondamentale per interpretare l'HTML!
            cellaDato.className = "w3-center";
            if (chiave === "Pilota") cellaDato.style.textAlign = "left"; // Allinea a sx il nome pilota
            riga.appendChild(cellaDato);
        }
        corpo.appendChild(riga);
    }

    tabella.appendChild(intestazione);
    tabella.appendChild(corpo);
}