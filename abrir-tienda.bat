@echo off
cd /d "%~dp0"
echo Servidor de la tienda en http://localhost:8080  (cierra esta ventana para apagarlo)
start "" http://localhost:8080/index.html
python servir.py
