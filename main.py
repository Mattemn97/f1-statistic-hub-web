import argparse
from f1_app import F1TSAApp
from utils.logger import setup_logger

def main() -> None:
    """Entry point dell'applicazione F1-TSA."""
    parser = argparse.ArgumentParser(description="F1-TSA: Terminal Situation Awareness")
    parser.add_argument(
        "--debug", 
        action="store_true", 
        help="Attiva il logging a livello DEBUG su f1_tsa.log"
    )
    args = parser.parse_args()

    # Inizializza il logger prima di avviare l'app
    logger = setup_logger(args.debug)
    logger.info("Avvio di F1-TSA completato. Inizializzazione UI in corso...")

    # Avvia l'applicazione Textual
    app = F1TSAApp()
    app.run()

if __name__ == "__main__":
    main()