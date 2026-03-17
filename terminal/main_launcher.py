import os
import subprocess
from datetime import datetime
from typing import Dict, Tuple

import fastf1
from textual import on, work
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Container, Vertical
from textual.widgets import Header, Footer, Select, Button, Label

# Setup Cache
CACHE_DIR: str = "f1_cache"
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)
fastf1.Cache.enable_cache(CACHE_DIR)
fastf1.set_log_level("ERROR")

class F1LauncherApp(App):
    TITLE = "🏎️ F1 TERMINAL ANALYZER"
    CSS_PATH = "style.tcss"
    BINDINGS = [Binding("q", "quit", "Esci", show=True)]

    LAUNCH_CONFIG: Dict[str, Tuple[str, str]] = {
        "launch-risultati-finali":           ("view_risultati_finali.py", "piccola"),
        "launch-passo-gara":                 ("view_passo_gara.py", "larga"),
        "launch-telemetria-singola":         ("view_telemetry_grid.py", "grande"),
        "launch-telemetria-multipla":        ("view_telemetry_overlay.py", "grande"),
        "launch-stint-gomme":                ("view_stint_gomme.py", "larga"),
    }

    WINDOW_SIZES = {"piccola": (136, 32), "larga": (274, 32), "alta": (136, 66), "grande": (274, 67)}

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Container():
            with Vertical(classes="config-panel"):
                
                # Area Selezione
                years = [(str(y), y) for y in range(datetime.now().year, 2017, -1)]
                yield Select(years, prompt="1. Seleziona Stagione", id="select-year")
                yield Select([], prompt="2. Seleziona GP", id="select-gp", disabled=True)
                yield Select([], prompt="3. Seleziona Sessione", id="select-session", disabled=True)
                
                # Azione Principale
                yield Button("CARICA DATI SESSIONE", variant="primary", id="btn-download", disabled=True)
                yield Label("Configura per iniziare", id="status-label")
                
                # Griglia Analisi (Sempre visibile)
                with Container(id="view-buttons", classes="button-grid"):
                    yield Button("CLASSIFICA FINALE", id="launch-risultati-finali", classes="launch-btn", disabled=True)
                    yield Button("PASSO GARA", id="launch-passo-gara", classes="launch-btn", disabled=True)
                    yield Button("TELEMETRIA", id="launch-telemetria-singola", classes="launch-btn", disabled=True)
                    yield Button("OVERLAY", id="launch-telemetria-multipla", classes="launch-btn", disabled=True)
                    yield Button("STRATEGIA GOMME", id="launch-stint-gomme", classes="launch-btn", disabled=True)
        yield Footer()

    # --- Logica di abilitazione progressiva ---
    @on(Select.Changed, "#select-year")
    def handle_year_change(self, event: Select.Changed) -> None:
        try:
            schedule = fastf1.get_event_schedule(int(event.value))
            gp_options = [(row['EventName'], row['EventName']) for _, row in schedule.iterrows() if row['EventName'] != "Pre-Season Test"]
            s = self.query_one("#select-gp", Select)
            s.set_options(gp_options)
            s.disabled = False
        except Exception: pass

    @on(Select.Changed, "#select-gp")
    def handle_gp_change(self) -> None:
        s = self.query_one("#select-session", Select)
        s.set_options([("Qualifying", "Q"), ("Sprint", "S"), ("Race", "R")])
        s.disabled = False

    @on(Select.Changed, "#select-session")
    def handle_session_ready(self) -> None:
        self.query_one("#btn-download", Button).disabled = False

    @on(Button.Pressed, "#btn-download")
    def initiate_fetch(self) -> None:
        self.query_one("#status-label").update("Download...")
        self.perform_download()

    @work(exclusive=True, thread=True)
    def perform_download(self) -> None:
        y, g, s = self.query_one("#select-year").value, self.query_one("#select-gp").value, self.query_one("#select-session").value
        try:
            # Caricamento leggero
            fastf1.get_session(y, g, s).load(telemetry=False, weather=False)
            self.app.call_from_thread(self.finalize, True)
        except Exception as e:
            self.app.call_from_thread(self.finalize, False, str(e))

    def finalize(self, success: bool, error: str = "") -> None:
        if success:
            self.query_one("#status-label").update("[green]Dati caricati![/]")
            # Abilita tutti i pulsanti di analisi
            for btn in self.query(".launch-btn"):
                btn.disabled = False
        else:
            self.query_one("#status-label").update(f"[red]Errore[/]")

    @on(Button.Pressed, ".launch-btn")
    def on_launch_requested(self, event: Button.Pressed) -> None:
        config = self.LAUNCH_CONFIG.get(event.button.id)
        if config:
            script, size_key = config
            y, g, s = self.query_one("#select-year").value, self.query_one("#select-gp").value, self.query_one("#select-session").value
            cols, rows = self.WINDOW_SIZES.get(size_key, (117, 30))
            cmd = f'mode con: cols={cols} lines={rows} && python {script} --year {y} --gp "{g}" --session {s}'
            subprocess.Popen(f'start "{script}" cmd /k "{cmd}"', shell=True)

if __name__ == "__main__":
    F1LauncherApp().run()