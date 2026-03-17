import argparse
from typing import Any, Union
import fastf1
import pandas as pd
from rich.text import Text
from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import Header, Footer, DataTable, Static, Label
from textual.containers import Container

# --- IMPORT LOGGING ---
# Assicurati di avere il tuo modulo f1_logger disponibile
try:
    from f1_logger import setup_f1_logger
    log = setup_f1_logger("View-Stints")
except ImportError:
    import logging
    log = logging.getLogger("View-Stints")

class StintLeaderboardApp(App):
    TITLE = "STRATEGIA E STINT GOMME"
    # CSS_PATH = "style.tcss" # Decommenta se usi un file CSS personalizzato
    
    BINDINGS = [
        Binding("q", "quit", "Chiudi View", show=True),
        Binding("r", "refresh", "Aggiorna", show=True),
    ]

    def __init__(self, year: int, gp: Union[int, str], session_type: str):
        super().__init__()
        self.year = year
        self.gp = gp
        self.session_type = session_type
        fastf1.Cache.enable_cache('f1_cache')
        fastf1.set_log_level("ERROR")

    def compose(self) -> ComposeResult:
        yield Header()
        yield Static("Sincronizzazione Dati Telemetrici...", id="title-label")
        yield DataTable(id="stint-table", classes="hidden")
        yield Footer()

    def on_mount(self) -> None:
        self.fetch_data()

    @work(exclusive=True, thread=True)
    def fetch_data(self) -> None:
        try:
            session = fastf1.get_session(self.year, self.gp, self.session_type)
            session.load(laps=True, telemetry=False, weather=False)
            
            results = session.results
            laps = session.laps
            processed_data = []
            
            # Mappa dei colori ufficiali Pirelli (formattazione per Rich)
            color_map = {
                'SOFT': 'red',
                'MEDIUM': 'yellow',
                'HARD': 'white',
                'INTERMEDIATE': 'green',
                'WET': 'blue'
            }

            for row_idx, (idx, row) in enumerate(results.iterrows()):
                pos = str(int(row['Position'])) if pd.notna(row['Position']) else str(row_idx + 1)
                dr_code = row['Abbreviation']
                
                # Prendiamo i giri validi del pilota con info sullo stint
                dr_laps = laps.pick_driver(dr_code).dropna(subset=['Stint', 'Compound'])
                
                stint_texts = Text()
                
                if not dr_laps.empty:
                    # Raggruppiamo i giri per numero di Stint
                    stints = dr_laps.groupby('Stint')
                    
                    for stint_num, stint_data in stints:
                        compound = stint_data['Compound'].iloc[0]
                        num_laps = len(stint_data)
                        
                        color = color_map.get(str(compound).upper(), 'grey50')
                        label = str(num_laps)
                        
                        # --- MODIFICA: 3 quadratini per ogni giro ---
                        visual_length = num_laps * 3
                        
                        # Creiamo la barra: usiamo 3 caratteri blocco per ogni giro.
                        # Centriamo il numero totale di giri all'interno della barra allungata.
                        if visual_length >= len(label):
                            pad_total = visual_length - len(label)
                            pad_left = pad_total // 2
                            pad_right = pad_total - pad_left
                            stint_str = ("█" * pad_left) + label + ("█" * pad_right)
                        else:
                            # Fallback nel caso rarissimo
                            stint_str = label
                            
                        # Aggiungiamo lo stint formattato alla stringa finale del pilota
                        stint_texts.append(Text(stint_str, style=color))
                        
                        # Aggiungiamo un separatore sottile per indicare il pit stop
                        stint_texts.append(Text("│", style="dim #444444"))
                else:
                    stint_texts = Text("Nessun dato", style="dim italic")

                processed_data.append((
                    pos,
                    dr_code,
                    stint_texts
                ))

            self.app.call_from_thread(self.update_ui, processed_data, session.event['EventName'])
            
        except Exception as e:
            log.error(f"Errore critico durante fetch_data: {e}", exc_info=True)
            self.app.call_from_thread(self.notify, f"Errore: {e}", severity="error")

    def update_ui(self, data: list, event_name: str) -> None:
        self.query_one("#title-label").update(f"{event_name.upper()} {self.year} - {self.session_type} | STRATEGIA")
        
        table = self.query_one("#stint-table", DataTable)
        table.remove_class("hidden")
        table.clear(columns=True)
        
        # --- MODIFICA: Intestazione aggiornata ---
        headers = ["POS", "ID", "STRATEGIA GOMME (3 quadratini = 1 giro)"]
        table.add_columns(*headers)
        table.add_rows(data)

    def action_refresh(self) -> None:
        log.info("Refresh richiesto.")
        self.query_one("#stint-table").add_class("hidden")
        self.fetch_data()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int)
    parser.add_argument("--gp", type=str)
    parser.add_argument("--session", type=str)
    args = parser.parse_args()
    
    app = StintLeaderboardApp(args.year, args.gp, args.session)
    app.run()