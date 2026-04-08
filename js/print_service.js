// js/print_service.js

/**
 * Cattura la tabella (o il contenitore) visualizzato al momento nella scheda attiva
 * e lo scarica come immagine PNG ad alta qualità.
 */
async function scaricaSchedaAttivaComePng() {
    // 1. Individua il contenitore dati visibile al momento
    // Cerchiamo tutti i div 'tab-content' e prendiamo quello che ha display 'block'
    const schede = document.querySelectorAll('.tab-content');
    let schedaVisibile = null;
    
    schede.forEach(s => {
        if (s.style.display === 'block') {
            schedaVisibile = s;
        }
    });

    if (!schedaVisibile) {
        alert("❌ Nessuna tabella visibile da stampare.");
        return;
    }

    // Cerchiamo la tabella o il contenitore specifico dei dati dentro la scheda
    // Escludiamo il titolo h2 e l'eventuale avviso di assenza
    const elementoDaCatturare = schedaVisibile.querySelector('table') || schedaVisibile;

    // 2. Controllo sicurezza se la tabella è vuota
    if (elementoDaCatturare.tagName === 'TABLE' && elementoDaCatturare.innerHTML.trim() === "") {
        alert("⚠️ La tabella è vuota. Carica dei dati prima di stampare.");
        return;
    }

    const btnStampa = document.getElementById('btn-stampa');
    btnStampa.innerText = "⏳ Generazione immagine...";
    btnStampa.disabled = true;

    // 3. Configurazione html2canvas per ALTA QUALITA'
    const opzioni = {
        scale: 2, // 🚀 Moltiplica per 2 la risoluzione (simile a un display Retina)
        useCORS: true, // Fondamentale per caricare le foto dei piloti da server esterni (OpenF1)
        backgroundColor: "#ffffff", // Forza lo sfondo bianco se la tabella ha trasparenze
        logging: false, // Disabilita i log in console
    };

    try {
        console.log("📷 Cattura dell'elemento in corso...", elementoDaCatturare);
        
        // 4. Esegui la cattura
        const canvas = await html2canvas(elementoDaCatturare, opzioni);

        // 5. Converti il Canvas in un URL immagine PNG
        const imgData = canvas.toDataURL("image/png");

        // 6. Crea un nome file dinamico basato sul titolo della scheda
        const titoloH2 = schedaVisibile.querySelector('h2');
        const nomePulito = titoloH2 ? titoloH2.innerText.replace(/[^a-z0-9]/gi, '_').toLowerCase() : "f1_data";
        const nomeFile = `${nomePulito}_${new Date().toISOString().slice(0,10)}.png`;

        // 7. Forza il download usando un link temporaneo
        const link = document.createElement('a');
        link.href = imgData;
        link.download = nomeFile;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (errore) {
        console.error("❌ Errore durante la generazione dell'immagine:", errore);
        alert("Si è verificato un errore durante la creazione dell'immagine PNG.");
    } finally {
        // Ripristina il bottone
        btnStampa.innerText = "📷 Scarica Tabella (PNG)";
        btnStampa.disabled = false;
    }
}