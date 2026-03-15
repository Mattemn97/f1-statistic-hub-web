import logging
import sys

def setup_logger(debug_mode: bool) -> logging.Logger:
    """
    Configura il logger dell'applicazione scrivendo ESCLUSIVAMENTE su file.
    
    Args:
        debug_mode (bool): Se True imposta il livello a DEBUG, altrimenti INFO.
        
    Returns:
        logging.Logger: Istanza del logger configurata.
    """
    logger = logging.getLogger("f1_tsa")
    level = logging.DEBUG if debug_mode else logging.INFO
    logger.setLevel(level)

    # Evita la propagazione al root logger (che potrebbe stampare su stdout)
    logger.propagate = False

    file_handler = logging.FileHandler("f1_tsa.log", mode="w")
    formatter = logging.Formatter(
        "%(asctime)s - %(threadName)s - %(levelname)s - %(module)s - %(message)s"
    )
    file_handler.setFormatter(formatter)
    
    # Rimuove eventuali handler preesistenti per sicurezza
    if logger.hasHandlers():
        logger.handlers.clear()
        
    logger.addHandler(file_handler)
    return logger