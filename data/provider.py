import logging
import fastf1
import os
import pandas as pd
from typing import Optional, Dict, Any

fastf1.set_log_level('ERROR')

logger = logging.getLogger("f1_tsa")

class FastF1Provider:
    """Classe provider per l'astrazione e il recupero dati da FastF1."""

    def __init__(self):
        # Definiamo il nome della cartella di cache
        cache_dir = "f1_cache"
        
        # Crea la cartella se non esiste (exist_ok=True evita errori se c'è già)
        os.makedirs(cache_dir, exist_ok=True)
        
        # Ora possiamo abilitare la cache in totale sicurezza
        fastf1.Cache.enable_cache(cache_dir)
        
        self.session: Optional[fastf1.core.Session] = None

    def fetch_session_data(self, year: int, gp: str, identifier: str) -> bool:
        """
        [Livello 1 Try-Catch]: Recupera i dati della sessione.
        """
        try:
            logger.info(f"Fetching dati per {year} {gp} {identifier}...")
            self.session = fastf1.get_session(year, gp, identifier)
            self.session.load(telemetry=True, weather=True, messages=False)
            logger.info("Dati sessione caricati con successo.")
            return True
        except Exception as e:
            logger.error(f"Errore critico durante il fetch API: {e}", exc_info=True)
            self.session = None
            return False

    def get_driver_telemetry(self, driver_number: str) -> Optional[pd.DataFrame]:
        """
        [Livello 2 Try-Catch]: Estrae la telemetria di un pilota per il suo giro veloce.
        """
        if not self.session:
            return None
        
        try:
            laps = self.session.laps.pick_driver(driver_number)
            fastest_lap = laps.pick_fastest()
            if pd.isna(fastest_lap['LapTime']):
                logger.warning(f"Nessun tempo valido per il pilota {driver_number}.")
                return None
                
            telemetry = fastest_lap.get_telemetry()
            logger.debug(f"Telemetria estratta per {driver_number}.")
            return telemetry
        except Exception as e:
            logger.error(f"Errore processamento telemetria per {driver_number}: {e}")
            return None