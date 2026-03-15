import logging
import pandas as pd
from textual.widgets import DataTable
from textual.app import ComposeResult

logger = logging.getLogger("f1_tsa")

class LeaderboardA(DataTable):
    """Gestisce la visualizzazione base della classifica."""
    def on_mount(self) -> None:
        self.cursor_type = "row"
        self.add_columns("Pos", "Num", "Driver", "Team")

    def populate(self, session_data) -> None:
        """[Livello 3 Try-Catch]: Popola la classifica."""
        self.clear()
        try:
            if not session_data or session_data.laps.empty:
                raise ValueError("Dati giri vuoti.")
                
            drivers = session_data.drivers
            for pos, drv in enumerate(drivers, start=1):
                # Se un dato manca, gestiamo con placeholder come richiesto
                team = session_data.get_driver(drv).get('TeamName', '--:--.---')
                self.add_row(str(pos), drv, str(drv), team, key=drv)
        except Exception as e:
            logger.error(f"Errore popolamento Leaderboard: {e}")
            self.add_row("--", "--", "DATA N/A", "--")

class LeaderboardB(DataTable):
    """
    Gestisce la visualizzazione dei microsettori (S1, S2, S3), mescola e Speed Trap.
    Si posiziona in Top-Right.
    """
    def on_mount(self) -> None:
        self.cursor_type = "row"
        self.add_columns("S1", "S2", "S3", "Tyre", "STrap")

    def populate(self, session_data) -> None:
        """[Livello 3 Try-Catch]: Estrae i settori e gestisce i NaN in modo pulito."""
        self.clear()
        try:
            if not session_data or session_data.laps.empty:
                raise ValueError("Nessun giro disponibile.")
                
            for drv in session_data.drivers:
                laps = session_data.laps.pick_driver(drv)
                if laps.empty:
                    self.add_row("--:--.---", "--:--.---", "--:--.---", "N/A", "N/A", key=f"{drv}_b")
                    continue
                    
                fastest = laps.pick_fastest()
                
                # Parsing sicuro dei timedelta e gestione NaN
                s1 = str(fastest['Sector1Time'])[10:19] if not pd.isna(fastest['Sector1Time']) else "--:--.---"
                s2 = str(fastest['Sector2Time'])[10:19] if not pd.isna(fastest['Sector2Time']) else "--:--.---"
                s3 = str(fastest['Sector3Time'])[10:19] if not pd.isna(fastest['Sector3Time']) else "--:--.---"
                
                tyre = fastest.get('Compound', 'N/A')
                if pd.isna(tyre): tyre = "N/A"
                
                strap_val = fastest.get('SpeedI1')
                strap = f"{int(strap_val)} km/h" if not pd.isna(strap_val) else "N/A"
                
                self.add_row(s1, s2, s3, tyre, strap, key=f"{drv}_b")
                
        except Exception as e:
            logger.error(f"Errore popolamento LeaderboardB: {e}", exc_info=True)
            self.add_row("--:--.---", "DATA N/A", "--:--.---", "ERR", "ERR")