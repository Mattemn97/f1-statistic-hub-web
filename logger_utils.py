import logging
import sys
import traceback
from datetime import datetime

# Nome del file per il log persistente
LOG_FILE = "f1_analyzer.log"
# Nome del file per l'ultimo crash (il "last trace")
TRACE_FILE = "last_crash.trace"

def setup_logger(name: str):
    """Configura un logger che scrive su file con formattazione dettagliata."""
    logger = logging.getLogger(name)
    logger.setLevel(logging.DEBUG)

    # Formato: Data Ora | Livello | Modulo | Messaggio
    formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # File Handler
    file_handler = logging.FileHandler(LOG_FILE, encoding='utf-8')
    file_handler.setFormatter(formatter)
    
    if not logger.handlers:
        logger.addHandler(file_handler)
    
    return logger

def handle_exception(exc_type, exc_value, exc_traceback):
    """Cattura eccezioni non gestite e salva l'ultimo tracciato su file."""
    if issubclass(exc_type, KeyboardInterrupt):
        sys.__excepthook__(exc_type, exc_value, exc_traceback)
        return

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    error_msg = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
    
    # Salva il "Last Trace" specifico
    with open(TRACE_FILE, "w", encoding='utf-8') as f:
        f.write(f"--- CRASH REPORT {timestamp} ---\n")
        f.write(error_msg)
    
    # Scrivi anche nel log generale
    logging.error("Eccezione non gestita (Crash)", exc_info=(exc_type, exc_value, exc_traceback))

# Collega l'excepthook globale di Python al nostro gestore
sys.excepthook = handle_exception