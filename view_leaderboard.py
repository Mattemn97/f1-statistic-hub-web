"""
F1-TUI-Analyzer: Leaderboard View
---------------------------------
Modulo per la visualizzazione della classifica dettagliata di una sessione.
Riceve anno, round e tipo sessione come argomenti CLI.

Standard: PEP 8
Dipendenze: textual, fastf1, pandas
"""

import argparse
import sys
from typing import Optional

import fastf1
import pandas as pd
from textual import work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import Header, Footer, DataTable, Static, Label, LoadingIndicator
from textual.containers import Container


class LeaderboardApp(App):
    """
    Applicazione TUI per la visualizzazione della classifica F1.
    """

    TITLE = "F1 Leaderboard"
    SUB_TITLE = "Analisi Posizioni e Distacchi"

    CSS = """
    Container {
        padding: 1;
    }

    #header-info {
        background: $accent;
        color: $text;
        height: 3;
        content-align: center middle;
        text-style: bold;
        margin-bottom: 1;
    }

    DataTable {
        height: 1fr;
        /* CORREZIONE: 'round' invece di 'rounded' */
        border: round $accent;
    }

    #loading-container {
        align: center middle;
        height: 1fr;
    }

    .hidden {
        display: none;
    }
    """

    BINDINGS = [
        Binding("q", "quit", "Chiudi View", show=True),
        Binding("r", "refresh", "Aggiorna Dati", show=True),
    ]

    def __init__(self, year: int, gp: int, session_type: str):
        super().__init__()
        self.year = year
        self.gp = gp
        self.session_type = session_type
        # Abilitazione cache (stessa directory del launcher)
        CACHE_DIR: str = "f1_cache"
        fastf1.Cache.enable_cache(CACHE_DIR)

        fastf1.set_log_level("ERROR")

    def compose(self) -> ComposeResult:
        """Definisce l'architettura della UI."""
        yield Header()
        yield Static(
            f"CARICAMENTO: {self.year} - Round {self.gp} [{self.session_type}]", 
            id="header-info"
        )
        
        with Container(id="loading-container"):
            yield LoadingIndicator()
            yield Label("Elaborazione telemetria e tempi in corso...")
            
        yield DataTable(id="leaderboard-table", classes="hidden")
        yield Footer()

    def on_mount(self) -> None:
        """Avvia il caricamento dei dati all'apertura."""
        self.fetch_data()

    @work(exclusive=True, thread=True)
    def fetch_data(self) -> None:
        """
        Scarica e processa i dati della sessione in un thread separato.
        """
        try:
            # Caricamento sessione
            session = fastf1.get_session(self.year, self.gp, self.session_type)
            session.load(laps=True, telemetry=False, weather=False)
            
            # Elaborazione Classifica (Results)
            results = session.results
            laps = session.laps
            
            # Creazione dataset per la tabella
            processed_data = []
            
            # Il leader serve per calcolare i distacchi (Gap)
            leader_time = results.iloc[0]['Time'] if not pd.isna(results.iloc[0]['Time']) else None

            for _, row in results.iterrows():
                driver_code = row['Abbreviation']
                
                # Recupero ultimo giro e mescola
                driver_laps = laps.pick_driver(driver_code)
                if not driver_laps.empty:
                    last_lap = driver_laps.iloc[-1]
                    last_lap_time = str(last_lap['LapTime']).split('days ')[-1][:12] if not pd.isna(last_lap['LapTime']) else "N/A"
                    compound = last_lap['Compound']
                else:
                    last_lap_time = "N/A"
                    compound = "N/A"

                # Formattazione Gap e Interval
                gap = self._format_timedelta(row['Time'], leader_time) if leader_time else "LAP"
                
                # Costruzione riga
                processed_data.append((
                    str(int(row['Position'])),
                    driver_code,
                    row['TeamName'],
                    gap,
                    last_lap_time,
                    compound
                ))

            self.app.call_from_thread(self.update_ui, processed_data, session.event['EventName'])
            
        except Exception as e:
            self.app.call_from_thread(self.notify, f"Errore: {e}", severity="error")

    def update_ui(self, data: list, event_name: str) -> None:
        """Popola la tabella con i dati elaborati."""
        self.query_one("#loading-container").add_class("hidden")
        self.query_one("#header-info").update(f"🏁 {event_name} ({self.year}) - {self.session_type}")
        
        table = self.query_one("#leaderboard-table", DataTable)
        table.remove_class("hidden")
        table.clear()
        
        # Definizione Colonne
        columns = ["POS", "PILOTA", "TEAM", "DISTACCO (GAP)", "ULTIMO GIRO", "GOMMA"]
        table.add_columns(*columns)
        
        # Aggiunta Righe
        for row in data:
            table.add_row(*row)

    def _format_timedelta(self, current_time, leader_time) -> str:
        """Calcola la differenza di tempo in formato leggibile (+ss.ms)."""
        if pd.isna(current_time) or pd.isna(leader_time):
            return "N/A"
        
        diff = current_time - leader_time
        total_seconds = diff.total_seconds()
        
        if total_seconds == 0:
            return "LEADER"
        return f"+{total_seconds:.3f}s"

    def action_refresh(self) -> None:
        """Ricarica i dati (utile per sessioni live)."""
        self.query_one("#leaderboard-table").add_class("hidden")
        self.query_one("#loading-container").remove_class("hidden")
        self.fetch_data()


if __name__ == "__main__":
    # Parsing degli argomenti passati dal Main Launcher
    parser = argparse.ArgumentParser()
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--gp", type=str, required=True)
    parser.add_argument("--session", type=str, required=True)
    
    args = parser.parse_args()
    
    # Conversione GP in intero se possibile (Round Number)
    try:
        gp_val = int(args.gp)
    except ValueError:
        gp_val = args.gp

    app = LeaderboardApp(args.year, gp_val, args.session)
    app.run()