@echo off
title F1-TUI HOME
:: Imposta la finestra a 136 colonne e 32 righe
mode con: cols=136 lines=32
:: Avvia lo script principale
python main_launcher.py
:: Mantiene la finestra aperta in caso di errore o chiusura app
pause