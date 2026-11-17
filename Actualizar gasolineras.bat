@echo off
cd /d "%~dp0"
echo Actualizando precios de gasolineras...
call npm run actualizar:gasolineras
if %ERRORLEVEL% EQU 0 (
  echo Listo: los precios de gasolineras se han actualizado y publicado.
) else (
  echo ERROR: no se pudo actualizar. Revisa los mensajes de arriba.
)
pause
