@echo off
title MIKE CONSOLE
cd /d "%~dp0"
start "" http://localhost:4317
node server.js
