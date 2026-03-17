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
log = setup_f1_logger("View-Leaderboard")

class LeaderboardApp(App):
    TITLE = "CLASSIFICA FINALE"
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
        yield Static("Sincronizzazione Tempi Totali...", id="title-label")
        with Container(id="loading-container"):
            yield LoadingIndicator()
            yield Label("Estrazione dati ufficiali da FastF1...")
        yield DataTable(id="leaderboard-table", classes="hidden")
        yield Footer()

    def on_mount(self) -> None:
        self.fetch_data()

    def _format_time(self, td: Any, delta_time: bool = None) -> str:
        if pd.isna(td) or not isinstance(td, pd.Timedelta):
            return "-"
        
        total_seconds = td.total_seconds()
        
        abs_seconds = abs(total_seconds)
        hours = int(abs_seconds // 3600)
        minutes = int((abs_seconds % 3600) // 60)
        seconds = abs_seconds % 60
        
        if hours > 0:
            if delta_time == "R":
                return f"{hours:1d}:{minutes:2d}:{seconds:6.3f}"
            else:
                return f"{hours:02d}:{minutes:02d}:{seconds:06.3f}"
        elif minutes > 0:
            if delta_time == "R":
                return f"{hours:1d}:{minutes:2d}:{seconds:6.3f}"
            elif delta_time == "Q":
                return f"{minutes:1d}:{seconds:6.3f}"
            else:
                return f"{minutes:1d}:{seconds:06.3f}"
        else:            
            if delta_time == "R":
                return f"{hours:1d}:{minutes:2d}:{seconds:6.3f}"
            elif delta_time == "Q":
                return f"  {seconds:6.3f}"
            else:
                return f"{seconds:.3f}"

    def _map_status(self, status: str) -> str:
        s = str(status).lower()
        if "retired" in s: return "RET"
        if "accident" in s: return "ACC"
        if "collision" in s: return "COL"
        if "did not finish" in s: return "DNF"
        if "did not start" in s: return "DNS"
        if "disqualified" in s: return "DSQ"
        if "lapped" in s or "lap" in s: return "LAP"
        return ""

    @work(exclusive=True, thread=True)
    def fetch_data(self) -> None:
        try:
            session = fastf1.get_session(self.year, self.gp, self.session_type)
            session.load(laps=True, telemetry=False, weather=False)
            
            results = session.results
            laps = session.laps
            processed_data = []
            
            is_race = self.session_type in ['R', 'Race', 'S', 'Sprint']
            
            # --- FIX KEYERROR: RECUPERO SICURO DEL RIFERIMENTO ---
            leader_ref = pd.NaT
            if not results.empty:
                if is_race:
                    # In Gara cerchiamo la colonna 'Time'
                    leader_ref = results['Time'].iloc[0] if 'Time' in results.columns else pd.NaT
                else:
                    # In Qualifica cerchiamo 'BestLapTime' o usiamo il minimo dai laps
                    if 'BestLapTime' in results.columns:
                        leader_ref = results['BestLapTime'].min()
                    elif not laps.empty:
                        leader_ref = laps['LapTime'].min()
            
            log.info(f"Riferimento leader identificato: {leader_ref}")

            for row_idx, (idx, row) in enumerate(results.iterrows()):
                dr_code = row['Abbreviation']
                status_mapped = self._map_status(row.get('Status', ''))
                
                # --- LOGICA COLONNA TIME/GAP ---
                time_gap_str = "-"
                
                if is_race:
                    # Mostriamo il tempo totale (colonna 'Time') per tutti
                    curr_time = row.get('Time')
                    if status_mapped in ["RET", "ACC", "COL", "DNF", "DNS", "DSQ", "LAP"]:
                        time_gap_str = status_mapped
                    elif pd.notna(curr_time):
                        time_gap_str = self._format_time(curr_time, delta_time="R")
                        log.info(f"Tempo totale per {dr_code}: {curr_time} -> {time_gap_str}")
                    else:
                        time_gap_str = "-"
                else:
                    # In Qualifica: Tempo del leader e Delta per gli altri
                    curr_best = row.get('BestLapTime') 
                    # Se BestLapTime manca in results, proviamo a prenderlo dai laps del pilota
                    if pd.isna(curr_best) and not laps.empty:
                        curr_best = laps.pick_driver(dr_code)['LapTime'].min()

                    if row_idx == 0:
                        time_gap_str = self._format_time(curr_best)
                    elif pd.notna(curr_best) and pd.notna(leader_ref):
                        diff = curr_best - leader_ref
                        time_gap_str = self._format_time(diff, delta_time="Q")
                    else:
                        time_gap_str = status_mapped if status_mapped else "-"

                # --- ALTRI DATI (Lap e Settori) ---
                dr_laps = laps.pick_driver(dr_code)
                last_lap_str, l_s1, l_s2, l_s3 = "-", "-", "-", "-"
                best_lap_str, best_lap_num = "-", "-"
                pb_s1, pb_s2, pb_s3, theo_best_str = "-", "-", "-", "-"
                compound = "?"

                if not dr_laps.empty:
                    valid_laps = dr_laps.dropna(subset=['LapTime'])
                    if not valid_laps.empty:
                        last_lap = valid_laps.iloc[-1]
                        last_lap_str = self._format_time(last_lap['LapTime'])
                        l_s1 = f"{last_lap['Sector1Time'].total_seconds():.3f}" if pd.notna(last_lap['Sector1Time']) else "-"
                        l_s2 = f"{last_lap['Sector2Time'].total_seconds():.3f}" if pd.notna(last_lap['Sector2Time']) else "-"
                        l_s3 = f"{last_lap['Sector3Time'].total_seconds():.3f}" if pd.notna(last_lap['Sector3Time']) else "-"

                    # Cerchiamo il miglior giro nel dataframe laps invece che in results
                    fastest = dr_laps.pick_fastest()
                    if fastest is not None and pd.notna(fastest['LapTime']):
                        best_lap_str = self._format_time(fastest['LapTime'])
                        best_lap_num = str(int(fastest['LapNumber']))
                        compound = str(fastest.get('Compound', '?'))[0]

                    # Personal Best
                    s1b, s2b, s3b = dr_laps['Sector1Time'].min(), dr_laps['Sector2Time'].min(), dr_laps['Sector3Time'].min()
                    pb_s1 = f"{s1b.total_seconds():.3f}" if pd.notna(s1b) else "-"
                    pb_s2 = f"{s2b.total_seconds():.3f}" if pd.notna(s2b) else "-"
                    pb_s3 = f"{s3b.total_seconds():.3f}" if pd.notna(s3b) else "-"
                    
                    if pd.notna(s1b) and pd.notna(s2b) and pd.notna(s3b):
                        theo_best_str = self._format_time(s1b + s2b + s3b)

                processed_data.append((
                    str(int(row['Position'])) if pd.notna(row['Position']) else str(row_idx + 1),
                    dr_code,
                    time_gap_str,
                    last_lap_str, l_s1, l_s2, l_s3,
                    best_lap_str, best_lap_num,
                    pb_s1, pb_s2, pb_s3, theo_best_str,
                    compound
                ))

            self.app.call_from_thread(self.update_ui, processed_data, session.event['EventName'])
            
        except Exception as e:
            log.error(f"Errore critico durante fetch_data: {e}", exc_info=True)
            self.app.call_from_thread(self.notify, f"Errore: {e}", severity="error")

    def update_ui(self, data: list, event_name: str) -> None:
        self.query_one("#loading-container").add_class("hidden")
        self.query_one("#title-label").update(f"{event_name.upper()} {self.year} - {self.session_type}")
        table = self.query_one("#leaderboard-table", DataTable)
        table.remove_class("hidden")
        table.clear(columns=True)
        
        headers = [
            "POS", "ID", "TIME/GAP",
            "LAST LAP", "L-S1", "L-S2", "L-S3",
            "BEST LAP", "L#",
            "PB S1", "PB S2", "PB S3", "IDEAL", "TYRE"
        ]
        table.add_columns(*headers)
        table.add_rows(data)

    def action_refresh(self) -> None:
        log.info("Refresh richiesto.")
        self.query_one("#leaderboard-table").add_class("hidden")
        self.query_one("#loading-container").remove_class("hidden")
        self.fetch_data()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int)
    parser.add_argument("--gp", type=str)
    parser.add_argument("--session", type=str)
    args = parser.parse_args()
    app = LeaderboardApp(args.year, args.gp, args.session)
    app.run()