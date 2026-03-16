import argparse
from typing import Any, Union
import fastf1
import pandas as pd
from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import Header, Footer, DataTable, Static, Label, LoadingIndicator
from textual.containers import Container

# --- IMPORT LOGGING ---
from f1_logger import setup_f1_logger
log = setup_f1_logger("View-LapTimes-Full")

class LapTimesApp(App):
    TITLE = "PASSO GARA"
    CSS_PATH = "style.tcss"
    
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
        yield Static("Sincronizzazione Dati...", id="title-label")
        with Container(id="loading-container"):
            yield LoadingIndicator()
            yield Label("Elaborazione cronologici e Regime di gara...")
        yield DataTable(id="leaderboard-table", classes="hidden")
        yield Footer()

    def on_mount(self) -> None:
        self.fetch_data()

    def _format_time(self, td: Any) -> str:
        if pd.isna(td) or not isinstance(td, pd.Timedelta):
            return "-"
        ts = td.total_seconds()
        ms = int((ts % 1) * 1000)
        s = int(ts % 60)
        m = int(ts // 60)
        if m > 0:
            return f"{m}:{s:02d}.{ms:03d}"
        return f"{s}.{ms:03d}"

    def _map_status(self, status: str) -> str:
        s = str(status).lower()
        if "retired" in s: return "RET"
        if "accident" in s: return "ACC"
        if "collision" in s: return "COL"
        if "lapped" in s or "lap" in s: return "LAP"
        return "OUT"

    def _get_race_state_label(self, track_status: str) -> str:
        """Mappa il TrackStatus di FastF1 in sigle leggibili"""
        # 1: All Clear, 2: Yellow, 4: SC, 5: Red, 6: VSC, 7: VSC Ending
        if '5' in track_status: return "[b red]RF[/]"   # Red Flag
        if '4' in track_status: return "[b red]SC[/]"   # Safety Car
        if '6' in track_status: return "[b orange3]VSC[/]"
        if '7' in track_status: return "[b yellow]VSC[/]" # VSC Ending
        if '2' in track_status: return "[yellow]YF[/]"  # Yellow Flag
        return "-"

    @work(exclusive=True, thread=True)
    def fetch_data(self) -> None:
        try:
            session = fastf1.get_session(self.year, self.gp, self.session_type)
            session.load(laps=True, telemetry=False, weather=False)
            
            laps = session.laps
            results = session.results
            
            if laps.empty:
                raise ValueError("Nessun dato disponibile.")

            ordered_drivers = results['Abbreviation'].tolist()
            processed_matrix = {}
            # Creiamo un dizionario per lo stato gara globale per ogni giro
            race_states = laps.groupby('LapNumber')['TrackStatus'].first().to_dict()
            max_laps = int(laps['LapNumber'].max())

            for dr in ordered_drivers:
                dr_laps = laps.pick_driver(dr).sort_values(by='LapNumber')
                if dr_laps.empty: continue

                fastest_lap_data = dr_laps.pick_fastest()
                abs_best_lap_num = int(fastest_lap_data['LapNumber']) if fastest_lap_data is not None else -1
                
                prev_time = pd.Timedelta(days=1)

                for _, lap in dr_laps.iterrows():
                    lap_num = int(lap['LapNumber'])
                    curr_time = lap['LapTime']
                    
                    if pd.isna(curr_time):
                        st = results.loc[results['Abbreviation'] == dr, 'Status'].item()
                        processed_matrix[(lap_num, dr)] = f"[red]{self._map_status(st)}[/]"
                        continue

                    # --- LOGICA COLORE PULITA ---
                    color = ""
                    is_pit = pd.notna(lap['PitInTime']) or pd.notna(lap['PitOutTime'])

                    if is_pit:
                        color = "cyan"
                    elif lap_num == abs_best_lap_num:
                        color = "purple"
                    elif curr_time < prev_time and prev_time != pd.Timedelta(days=1):
                        color = "green"
                    
                    prev_time = curr_time

                    # --- COSTRUZIONE STRINGA ---
                    t_str = self._format_time(curr_time)
                    comp = str(lap['Compound'])[0].upper() if pd.notna(lap['Compound']) else "?"
                    
                    display_text = f"{t_str}{comp}"
                    if color:
                        display_text = f"[{color}]{display_text}[/]"
                    
                    processed_matrix[(lap_num, dr)] = display_text

            # --- COSTRUZIONE RIGHE FINALI ---
            final_rows = []
            for n in range(1, max_laps + 1):
                row = [f"[b]{n}[/b]"]
                # Aggiungiamo i tempi dei piloti
                for dr in ordered_drivers:
                    row.append(processed_matrix.get((n, dr), "-"))
                
                # Aggiungiamo la colonna REGIME alla fine
                ts_code = str(race_states.get(n, "1"))
                row.append(self._get_race_state_label(ts_code))
                
                final_rows.append(row)

            headers = ["LAP"] + ordered_drivers + ["REGIME"]
            self.app.call_from_thread(self.update_ui, final_rows, headers, session.event['EventName'])
            
        except Exception as e:
            log.error(f"Errore: {e}", exc_info=True)
            self.app.call_from_thread(self.notify, f"Errore: {e}", severity="error")

    def update_ui(self, rows: list, headers: list, event_name: str) -> None:
        self.query_one("#loading-container").add_class("hidden")
        self.query_one("#title-label").update(f"{event_name.upper()} {self.year}")
        table = self.query_one("#leaderboard-table", DataTable)
        table.remove_class("hidden")
        table.clear(columns=True)
        table.add_columns(*headers)
        table.add_rows(rows)

    def action_refresh(self) -> None:
        self.query_one("#leaderboard-table").add_class("hidden")
        self.query_one("#loading-container").remove_class("hidden")
        self.fetch_data()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, default=2024)
    parser.add_argument("--gp", type=str, default="Monaco")
    parser.add_argument("--session", type=str, default="R")
    args = parser.parse_args()
    app = LapTimesApp(args.year, args.gp, args.session)
    app.run()