import logging
import sys
import traceback
from datetime import datetime

def setup_f1_logger(module_name):
    # Configurazione log generale (append)
    logging.basicConfig(
        filename="f1_analyzer.log",
        level=logging.DEBUG,
        format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    logger = logging.getLogger(module_name)

    # Gestore dei crash per salvare l'ultimo tracciato (sovrascrive ogni volta)
    def crash_handler(exc_type, exc_value, exc_traceback):
        if issubclass(exc_type, KeyboardInterrupt):
            sys.__excepthook__(exc_type, exc_value, exc_traceback)
            return
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        trace = "".join(traceback.format_exception(exc_type, exc_value, exc_traceback))
        
        with open("last_crash.trace", "w", encoding='utf-8') as f:
            f.write(f"--- CRASH REPORT: {timestamp} ---\n")
            f.write(f"Modulo: {module_name}\n")
            f.write(trace)
        
        logger.critical("Crash dell'applicazione rilevato!", exc_info=(exc_type, exc_value, exc_traceback))

    sys.excepthook = crash_handler
    return logger