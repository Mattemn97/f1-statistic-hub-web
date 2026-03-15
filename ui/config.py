import logging
from textual.app import ComposeResult
from textual.containers import VerticalScroll
from textual.widgets import Label, Select, Button

logger = logging.getLogger("f1_tsa")

class ConfigPanel(VerticalScroll):
    """
    Pannello Top-Left: Gestisce le opzioni di caricamento dati.
    Permette di selezionare Anno, GP e Sessione.
    """
    
    def compose(self) -> ComposeResult:
        yield Label("🛠️ Config & Setup", classes="panel-title", id="cfg_title")
        
        # In un'app reale, la lista GP verrebbe popolata dinamicamente
        yield Select(
            [("Live (Sperimentale)", "live"), ("Storico (Replay)", "storico")], 
            prompt="Modalità", id="sel_mode", value="storico"
        )
        yield Select([(str(y), y) for y in range(2020, 2025)], prompt="Anno", id="sel_year")
        yield Select([("Monza", "Monza"), ("Spa", "Spa"), ("Silverstone", "Silverstone")], prompt="GP", id="sel_gp")
        yield Select([("Gara (R)", "R"), ("Qualifica (Q)", "Q")], prompt="Sessione", id="sel_session")
        
        yield Button("LOAD DATA", id="btn_load", variant="success")
        yield Label("Status: IDLE", id="status_label")

    def get_selection(self) -> tuple:
        """Restituisce i valori selezionati dall'utente."""
        year = self.query_one("#sel_year", Select).value
        gp = self.query_one("#sel_gp", Select).value
        session = self.query_one("#sel_session", Select).value
        return year, gp, session