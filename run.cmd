@echo off
title F1-TUI HOME
:: Imposta la finestra a 117 colonne e 30 righe
mode con: cols=117 lines=30
:: Avvia lo script principale
python main_launcher.py
:: Mantiene la finestra aperta in caso di errore o chiusura app
pause