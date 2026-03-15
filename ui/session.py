import logging
from textual.app import ComposeResult
from textual.containers import Vertical
from textual.widgets import Label

logger = logging.getLogger("f1_tsa")

class SessionControl(Vertical):
    """
    Pannello Bottom-Left: Mostra meteo, bandiere e lo stato del Player (Play/Pausa).
    """
    def compose(self) -> ComposeResult:
        yield Label("🎛️ Session Control", classes="panel-title")
        yield Label("🌡️ Air Temp: -- °C", id="lbl_air_temp")
        yield Label("🛣️ Track Temp: -- °C", id="lbl_track_temp")
        yield Label("💨 Wind: -- m/s", id="lbl_wind")
        yield Label("🏁 Flags: GREEN 🟩", id="lbl_flags")
        yield Label("⏱️ Player: IDLE ⏹️", id="lbl_player_status")

    def update_environment(self, weather_data) -> None:
        """Aggiorna le label con i dati meteo. Cattura errori se chiavi mancanti."""
        try:
            if weather_data is not None and not weather_data.empty:
                # Prende l'ultimo dato meteo registrato
                latest = weather_data.iloc[-1]
                self.query_one("#lbl_air_temp", Label).update(f"🌡️ Air Temp: {latest['AirTemp']} °C")
                self.query_one("#lbl_track_temp", Label).update(f"🛣️ Track Temp: {latest['TrackTemp']} °C")
                self.query_one("#lbl_wind", Label).update(f"💨 Wind: {latest['WindSpeed']} m/s")
        except Exception as e:
            logger.error(f"Errore lettura dati meteo: {e}")