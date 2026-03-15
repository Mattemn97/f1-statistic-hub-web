import logging
from textual.app import App, ComposeResult
from textual import work, on
from textual.widgets import Header, Footer, Button, Label, DataTable
from textual.timer import Timer

from ui.config import ConfigPanel
from ui.leaderboard import LeaderboardA, LeaderboardB
from ui.plots import TelemetryPlot
from ui.session import SessionControl
from data.provider import FastF1Provider

logger = logging.getLogger("f1_tsa")

class F1TSAApp(App):
    """Applicazione TUI principale e state manager."""
    
    CSS_PATH = "styles.tcss"
    
    BINDINGS = [
        ("w", "play", "Avvia Replay"),
        ("s", "stop", "Pausa Replay"),
        ("a", "prev", "Giro Precedente"),
        ("d", "next", "Giro Successivo"),
        ("q", "quit", "Esci")
    ]

    def __init__(self):
        super().__init__()
        self.provider = FastF1Provider()
        self.playback_timer: Timer | None = None
        self.current_lap: int = 1
        self.selected_driver: str | None = None

    def compose(self) -> ComposeResult:
        yield Header()
        
        # TOP ROW
        yield ConfigPanel(id="config-panel")
        yield LeaderboardA(id="leaderboard-a")
        yield LeaderboardB(id="leaderboard-b")
        
        # MID ROW
        yield TelemetryPlot("Speed (km/h)", "cyan", "km/h", id="plot-speed")
        yield TelemetryPlot("Throttle (%)", "green", "%", id="plot-throttle")
        yield TelemetryPlot("Brake (bar)", "red", "bar", id="plot-brake")
        
        # BOTTOM ROW
        yield SessionControl(id="session-control")
        yield TelemetryPlot("Gear", "yellow", "n", id="plot-gear")
        yield TelemetryPlot("RPM", "magenta", "rpm", id="plot-rpm")
        
        yield Footer()

    @on(Button.Pressed, "#btn_load")
    def handle_load_data(self) -> None:
        """Avvia il worker asincrono leggendo i valori dal ConfigPanel."""
        panel = self.query_one(ConfigPanel)
        year, gp, session = panel.get_selection()
        
        if not all([year, gp, session]):
            self.notify("Seleziona tutti i parametri prima di caricare.", severity="warning")
            return

        status_label = self.query_one("#status_label", Label)
        status_label.update("Status: [bold yellow]LOADING API...[/]")
        logger.info(f"Avvio job: {year} {gp} {session}")
        
        self.load_data_async(int(year), gp, session)

    @work(thread=True)
    def load_data_async(self, year: int, gp: str, session: str) -> None:
        success = self.provider.fetch_session_data(year, gp, session)
        self.call_from_thread(self._on_data_loaded, success)

    def _on_data_loaded(self, success: bool) -> None:
        """Aggiorna le classifiche e il meteo al termine del fetch."""
        status_label = self.query_one("#status_label", Label)
        if success:
            status_label.update("Status: [bold green]READY[/]")
            self.query_one(LeaderboardA).populate(self.provider.session)
            self.query_one(LeaderboardB).populate(self.provider.session)
            if hasattr(self.provider.session, 'weather_data'):
                self.query_one(SessionControl).update_environment(self.provider.session.weather_data)
        else:
            status_label.update("Status: [bold red]API ERROR[/]")

    @on(DataTable.RowSelected)
    def on_driver_selected(self, event: DataTable.RowSelected) -> None:
        """Gestisce il click/Invio su un pilota: estrae ed espone i grafici."""
        driver_id = event.row_key.value
        # Rimuove il suffisso "_b" se selezionato dalla seconda tabella
        self.selected_driver = driver_id.replace("_b", "") 
        self.notify(f"Estraggo telemetria per {self.selected_driver}...")
        self.update_telemetry_async()

    @work(thread=True)
    def update_telemetry_async(self) -> None:
        """Worker background per non bloccare la UI durante l'elaborazione dei dataframe."""
        if not self.selected_driver:
            return
            
        telemetry = self.provider.get_driver_telemetry(self.selected_driver)
        # Aggiorna i grafici in modo thread-safe
        self.call_from_thread(self._render_plots, telemetry)

    def _render_plots(self, telemetry) -> None:
        """Invia i dataframe ai rispettivi widget Plotext."""
        self.query_one("#plot-speed", TelemetryPlot).render_data(telemetry, "Speed")
        self.query_one("#plot-throttle", TelemetryPlot).render_data(telemetry, "Throttle")
        self.query_one("#plot-brake", TelemetryPlot).render_data(telemetry, "Brake")
        self.query_one("#plot-gear", TelemetryPlot).render_data(telemetry, "nGear")
        self.query_one("#plot-rpm", TelemetryPlot).render_data(telemetry, "RPM")

    # --- CONTROLLI MOTORE TEMPORALE (Key Bindings) ---

    def action_play(self) -> None:
        """Tasto W: Avvia/Riprende l'avanzamento automatico dei giri."""
        session_ctrl = self.query_one(SessionControl)
        if self.playback_timer is None:
            # Esegue action_next ogni 10 secondi
            self.playback_timer = self.set_interval(10.0, self.action_next)
            logger.info("Player avviato.")
        else:
            self.playback_timer.resume()
            logger.info("Player ripreso.")
            
        session_ctrl.query_one("#lbl_player_status", Label).update("⏱️ Player: PLAYING ▶️")

    def action_stop(self) -> None:
        """Tasto S: Ferma l'avanzamento automatico."""
        if self.playback_timer:
            self.playback_timer.pause()
            logger.info("Player in pausa.")
            self.query_one(SessionControl).query_one("#lbl_player_status", Label).update("⏱️ Player: PAUSED ⏸️")

    def action_next(self) -> None:
        """Tasto D: Avanza di un giro o scatta se invocato dal timer."""
        self.current_lap += 1
        self.notify(f"Giro {self.current_lap} avviato.")
        logger.debug(f"Avanzamento manuale/auto: Giro {self.current_lap}")
        # Qui andrebbe inserita la logica avanzata per ricaricare la telemetria 
        # specificatamente per il giro `self.current_lap` invece del giro veloce.
        # self.update_telemetry_async()

    def action_prev(self) -> None:
        """Tasto A: Torna al giro precedente."""
        if self.current_lap > 1:
            self.current_lap -= 1
            self.notify(f"Ritorno al Giro {self.current_lap}.")
            logger.debug(f"Arretramento manuale: Giro {self.current_lap}")
            # self.update_telemetry_async()