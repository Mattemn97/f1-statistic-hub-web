"""
F1-TUI-Analyzer: Main Launcher
------------------------------
Modulo principale per la configurazione e il lancio dell'ecosistema F1-TUI.
Gestisce la selezione della sessione tramite FastF1, il download dei dati
e l'apertura di moduli di analisi in terminali indipendenti.

Standard: PEP 8
Dipendenze: textual, fastf1, pandas
"""

import os
import platform
import subprocess
from datetime import datetime
from typing import List, Tuple, Optional

import fastf1
from textual import on, work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Container, Vertical
from textual.widgets import (
    Header, 
    Footer, 
    Select, 
    Button, 
    Label, 
    LoadingIndicator, 
    Static
)


# --- CONFIGURAZIONE CACHE FASTF1 ---
CACHE_DIR: str = "f1_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)

fastf1.set_log_level("ERROR")  # Riduce il log di FastF1 a errori critici per una UI più pulita


class F1LauncherApp(App):
    """
    Applicazione principale per il coordinamento delle sessioni F1.
    
    Questa classe gestisce l'interfaccia utente (TUI) per selezionare 
    l'anno, l'evento e la sessione specifica, escludendo le prove libere.
    Si occupa inoltre di orchestrare il lancio dei processi figli.
    """

    TITLE = "F1-TUI Analyzer"
    SUB_TITLE = "Gestore Analisi Motorsport"

    # Definizione degli stili TCSS (Textual CSS)
    CSS = """
    Container {
        padding: 1;
        align: center middle;
    }

    .config-panel {
        border: double $accent;
        padding: 2;
        width: 70;
        height: auto;
        background: $surface;
    }

    #title-label {
        width: 100%;
        content-align: center middle;
        text-style: bold;
        margin-bottom: 1;
        color: $accent;
    }

    .button-grid {
        margin-top: 1;
        layout: grid;
        grid-size: 2;
        grid-gutter: 1;
        display: none; /* Nascosto finché i dati non sono pronti */
    }

    .hidden {
        display: none;
    }

    Select {
        margin-bottom: 1;
    }

    #status-label {
        margin: 1;
        text-align: center;
        text-style: italic;
    }

    LoadingIndicator {
        height: 3;
        color: $accent;
    }

    Button {
        width: 100%;
    }
    """

    BINDINGS = [
        Binding("q", "quit", "Esci dall'applicazione", show=True),
    ]

    def compose(self) -> ComposeResult:
        """Crea la struttura dei widget della Home Page."""
        yield Header(show_clock=True)
        
        with Container():
            with Vertical(classes="config-panel"):
                yield Label("🏎️ F1-TUI CONFIGURATION HUB", id="title-label")
                
                # 1. Menu Selezione Anno
                years = [(str(y), y) for y in range(datetime.now().year, 2017, -1)]
                yield Select(years, prompt="Seleziona Stagione", id="select-year")
                
                # 2. Menu Selezione Gran Premio (Disabilitato all'avvio)
                yield Select([], prompt="Seleziona Evento GP", id="select-gp", disabled=True)
                
                # 3. Menu Selezione Sessione (Solo sessioni competitive)
                yield Select([], prompt="Seleziona Tipo Sessione", id="select-session", disabled=True)
                
                # Azione Download
                yield Button("PREPARA DATI SESSIONE", variant="primary", id="btn-download", disabled=True)
                
                # Indicatori di stato
                yield LoadingIndicator(id="loading", classes="hidden")
                yield Label("In attesa di configurazione...", id="status-label")

                # Griglia di lancio per i moduli esterni
                with Container(id="view-buttons", classes="button-grid"):
                    yield Button("📊 Leaderboard", id="launch-leaderboard", classes="launch-btn")
                    yield Button("⏱️ Race Pace", id="launch-pace", classes="launch-btn")
                    yield Button("⚙️ Telemetry Grid", id="launch-telemetry", classes="launch-btn")
                    yield Button("📈 Overlay Analysis", id="launch-overlay", classes="launch-btn")
                    yield Button("🛞 Tyre Strategy", id="launch-tyre", classes="launch-btn")

        yield Footer()

    # --- GESTIONE EVENTI (INTERATTIVITÀ) ---

    @on(Select.Changed, "#select-year")
    def handle_year_change(self, event: Select.Changed) -> None:
        """
        Aggiorna dinamicamente la lista dei GP in base all'anno selezionato.
        
        Args:
            event: L'evento di cambiamento della selezione dell'anno.
        """
        year = int(event.value)
        try:
            # Recupera il calendario ufficiale della stagione
            schedule = fastf1.get_event_schedule(year)
            # Filtra eventi validi (esclude test e sessioni nulle)
            gp_options = [
                (row['EventName'], row['RoundNumber']) 
                for _, row in schedule.iterrows() 
                if row['EventName'] != "Pre-Season Test"
            ]
            
            select_gp = self.query_one("#select-gp", Select)
            select_gp.set_options(gp_options)
            select_gp.disabled = False
            self.query_one("#status-label").update(f"Calendario {year} caricato.")
        except Exception as e:
            self.query_one("#status-label").update(f"[red]Errore calendario: {e}[/]")

    @on(Select.Changed, "#select-gp")
    def handle_gp_change(self) -> None:
        """Configura le sessioni disponibili per l'evento selezionato."""
        # Filtriamo automaticamente le FP (Practice) come richiesto
        sessions = [
            ("Qualifying", "Q"),
            ("Sprint", "S"),
            ("Race", "R")
        ]
        select_sess = self.query_one("#select-session", Select)
        select_sess.set_options(sessions)
        select_sess.disabled = False

    @on(Select.Changed, "#select-session")
    def handle_session_ready(self) -> None:
        """Abilita il pulsante di download una volta completata la selezione."""
        self.query_one("#btn-download", Button).disabled = False
        self.query_one("#status-label").update("[green]Configurazione completata. Pronto al download.[/]")

    # --- ELABORAZIONE DATI (BACKGROUND WORKER) ---

    @on(Button.Pressed, "#btn-download")
    def initiate_data_fetch(self) -> None:
        """Prepara l'interfaccia e avvia il download asincrono."""
        self.query_one("#btn-download").disabled = True
        self.query_one("#loading").remove_class("hidden")
        self.query_one("#status-label").update("[yellow]Caricamento dati FastF1 in corso...[/]")
        self.perform_data_download()

    @work(exclusive=True, thread=True)
    def perform_data_download(self) -> None:
        """
        Esegue il fetch dei dati in un thread separato.
        Utilizza la cache locale per ottimizzare le prestazioni.
        """
        year = self.query_one("#select-year", Select).value
        gp_round = self.query_one("#select-gp", Select).value
        session_type = self.query_one("#select-session", Select).value
        
        try:
            # Carica la sessione (Telemetria inclusa, meteo escluso come richiesto)
            session = fastf1.get_session(year, gp_round, session_type)
            session.load(telemetry=True, weather=False)
            
            # Notifica il completamento al thread principale della UI
            self.app.call_from_thread(self.finalize_download, True)
        except Exception as e:
            self.app.call_from_thread(self.finalize_download, False, str(e))

    def finalize_download(self, success: bool, error: str = "") -> None:
        """
        Aggiorna l'interfaccia utente al termine del caricamento dati.
        
        Args:
            success: Booleano che indica se il download è andato a buon fine.
            error: Messaggio di errore opzionale in caso di fallimento.
        """
        self.query_one("#loading").add_class("hidden")
        
        if success:
            self.query_one("#status-label").update(
                "[green]Dati sincronizzati con successo![/]"
            )
            # CORREZIONE: Usa 'block' per mostrare il widget. 
            # Il layout 'grid' è già gestito dal CSS.
            self.query_one("#view-buttons").display = "block"
        else:
            self.query_one("#status-label").update(
                f"[red]Errore durante il caricamento: {error}[/]"
            )
            self.query_one("#btn-download").disabled = False

    # --- LANCIO MODULI MULTI-TERMINALE ---

    @on(Button.Pressed, ".launch-btn")
    def on_launch_requested(self, event: Button.Pressed) -> None:
        """
        Identifica il modulo richiesto tramite l'ID del bottone premuto
        e ne avvia l'esecuzione in un nuovo processo.
        """
        # Mapping degli ID dei bottoni ai rispettivi file script
        mapping = {
            "launch-leaderboard": "view_leaderboard.py",
            "launch-pace": "view_race_pace.py",
            "launch-telemetry": "view_telemetry_grid.py",
            "launch-overlay": "view_telemetry_overlay.py",
            "launch-tyre": "view_tyre_strategy.py"
        }
        
        # Recuperiamo l'ID specifico del bottone che ha scatenato l'evento
        button_id = event.button.id
        script = mapping.get(button_id)
        
        if not script:
            self.notify("Modulo non trovato", severity="error")
            return

        # Recupero parametri correnti dalla UI
        year = self.query_one("#select-year", Select).value
        gp = self.query_one("#select-gp", Select).value
        sess = self.query_one("#select-session", Select).value
        
        self.spawn_terminal_process(script, year, gp, sess)

    def spawn_terminal_process(self, script: str, y: int, g: int, s: str) -> None:
        """
        Gestisce la logica cross-platform per l'apertura di nuovi terminali.
        
        Args:
            script: Nome del file python da eseguire.
            y, g, s: Parametri della sessione (anno, round, tipo).
        """
        # Comando Python con argomenti riga di comando
        full_command = f"python {script} --year {y} --gp {g} --session {s}"
        current_os = platform.system()

        try:
            if current_os == "Windows":
                # Apre un nuovo CMD e mantiene aperta la finestra dopo l'esecuzione (/k)
                subprocess.Popen(["start", "cmd", "/k", full_command], shell=True)
            
            elif current_os == "Linux":
                # Prova i terminali più comuni
                subprocess.Popen([
                    "gnome-terminal", "--", "bash", "-c", f"{full_command}; exec bash"
                ])
                
            elif current_os == "Darwin":  # macOS
                # Usa AppleScript per istruire l'app Terminale
                os.system(
                    f"osascript -e 'tell app \"Terminal\" to do script \"{full_command}\"'"
                )
            
            self.notify(f"Lancio modulo: {script}", title="Sistema")
        except Exception as e:
            self.notify(f"Impossibile aprire terminale: {e}", severity="error")


if __name__ == "__main__":
    # Avvio dell'applicazione Textual
    app = F1LauncherApp()
    app.run()