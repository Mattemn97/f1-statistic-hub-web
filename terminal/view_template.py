import argparse
from typing import Any, Union
import fastf1
import pandas as pd
from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import Header, Footer, DataTable, Static, Label, LoadingIndicator
from textual.containers import Container

# --- 1. CONFIGURAZIONE LOGGING ---
# Importa il tuo logger personalizzato per tracciare errori e debug
from f1_logger import setup_f1_logger
log = setup_f1_logger("Nome-Modulo")

class F1TemplateApp(App):
    """
    Template standard per le pagine dell'applicazione F1.
    Copia questo schema per creare nuove visualizzazioni (Telemetria, Strategie, ecc.)
    """
    
    # --- 2. CONFIGURAZIONE ESTETICA ---
    TITLE = "TITOLO DELLA PAGINA"
    SUB_TITLE = "Sottotitolo descrittivo"
    CSS_PATH = "style.tcss" # Mantieni un unico file CSS per coerenza globale
    
    # --- 3. KEYBINDINGS (Tasti rapidi) ---
    BINDINGS = [
        Binding("q", "quit", "Esci", show=True),
        Binding("r", "refresh", "Aggiorna Dati", show=True),
        Binding("b", "back", "Indietro", show=True), # Esempio per navigazione
    ]

    def __init__(self, year: int, gp: Union[int, str], session_type: str):
        super().__init__()
        # Stato dell'applicazione
        self.year = year
        self.gp = gp
        self.session_type = session_type
        
        # Configurazione FastF1
        fastf1.Cache.enable_cache('f1_cache')
        fastf1.set_log_level("ERROR")

    # --- 4. COSTRUZIONE INTERFACCIA (UI) ---
    def compose(self) -> ComposeResult:
        """Definisce la struttura widget della pagina."""
        yield Header()
        
        # Titolo dinamico della sezione
        yield Static("Inizializzazione...", id="section-title", classes="page-header")
        
        # Schermata di caricamento (Overlay)
        with Container(id="loading-overlay"):
            yield LoadingIndicator()
            yield Label("Recupero dati in corso dai server F1...")
        
        # Area Contenuto Principale (es. DataTable, Plot, o Liste)
        # Inizialmente nascosta con una classe CSS .hidden { display: none; }
        yield DataTable(id="main-data-table", classes="hidden")
        
        yield Footer()

    # --- 5. CICLO DI VITA & EVENTI ---
    def on_mount(self) -> None:
        """Azioni eseguite all'apertura della pagina."""
        self.fetch_data()

    def action_refresh(self) -> None:
        """Logica associata al tasto 'r'."""
        log.info("Refresh dei dati richiesto.")
        self.query_one("#main-data-table").add_class("hidden")
        self.query_one("#loading-overlay").remove_class("hidden")
        self.fetch_data()

    # --- 6. LOGICA DI BACKGROUND (Data Fetching) ---
    @work(exclusive=True, thread=True)
    def fetch_data(self) -> None:
        """
        Recupera i dati in un thread separato per non bloccare la UI.
        Usa self.app.call_from_thread per aggiornare i widget al termine.
        """
        try:
            # Esempio caricamento sessione
            session = fastf1.get_session(self.year, self.gp, self.session_type)
            session.load(laps=True, telemetry=False, weather=False)
            
            # --- ELABORAZIONE DATI (Inserisci qui la tua logica specifica) ---
            processed_results = [] 
            # Esempio: for row in session.results...
            
            # Invio dati alla UI
            self.app.call_from_thread(self.update_ui, processed_results, session.event['EventName'])
            
        except Exception as e:
            log.error(f"Errore caricamento: {e}", exc_info=True)
            self.app.call_from_thread(self.notify, f"Errore: {e}", severity="error")

    # --- 7. AGGIORNAMENTO UI ---
    def update_ui(self, data: list, event_name: str) -> None:
        """Aggiorna i widget con i dati elaborati."""
        # 1. Gestione visibilità
        self.query_one("#loading-overlay").add_class("hidden")
        self.query_one("#main-data-table").remove_class("hidden")
        
        # 2. Aggiornamento testi
        self.query_one("#section-title").update(f"📊 {event_name.upper()} {self.year}")
        
        # 3. Popolamento tabella/widget
        table = self.query_one("#main-data-table", DataTable)
        table.clear(columns=True)
        # table.add_columns(...)
        # table.add_rows(data)

    # --- 8. UTILITY DI FORMATTAZIONE ---
    def _format_time_display(self, td: pd.Timedelta) -> str:
        """Formatta i Timedelta di Pandas in stringhe leggibili (es. 1:23.456)."""
        if pd.isna(td): return "-"
        # Inserire logica di formattazione qui
        return str(td)

# --- 9. ENTRY POINT ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="F1 Data Viewer")
    parser.add_argument("--year", type=int, default=2023)
    parser.add_argument("--gp", type=str, default="Monza")
    parser.add_argument("--session", type=str, default="R")
    
    args = parser.parse_args()
    
    app = F1TemplateApp(args.year, args.gp, args.session)
    app.run()