@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM ============================================================================
REM  OviApp - levanta el sistema completo de una sola vez
REM
REM    levantar-oviapp.bat            todo: db, backend, streaming, IA y la app
REM    levantar-oviapp.bat sin-ia     omite el modulo de vision por computadora
REM    levantar-oviapp.bat seed       ademas repuebla la base con datos de prueba
REM
REM  Los argumentos se combinan y van en cualquier orden:
REM    levantar-oviapp.bat seed sin-ia
REM
REM  Al cerrar la ventana de Edge, "flutter run" termina y este script tambien.
REM  Los contenedores quedan corriendo: para bajarlos, docker compose down
REM ============================================================================

REM --- Configuracion ----------------------------------------------------------

set "ENTRYPOINT=lib\main.dart"

set "PUERTO_WEB=5000"
set "DOCKER_EXE=C:\Program Files\Docker\Docker\Docker Desktop.exe"

REM Perfil de Edge aparte: evita el dialogo de sincronizacion de la cuenta
REM personal, que se dibuja encima de la app y bloquea los clics.
set "PERFIL_EDGE=%TEMP%\oviapp-edge-profile"

set "RAIZ=%~dp0"
set "SEMBRAR="
set "CON_IA=1"

REM Los argumentos se leen en cualquier orden.
:leer_args
if "%~1"=="" goto args_listos
if /i "%~1"=="seed"   set "SEMBRAR=1"
if /i "%~1"=="sin-ia" set "CON_IA="
shift
goto leer_args
:args_listos

REM El modulo de IA vive en el perfil "ia" del compose para que su imagen CUDA
REM no se arrastre cuando solo se quiere trabajar en la app movil.
set "PERFIL="
set "QUE_LEVANTA=db, db-test, backend, mediamtx, camara"
if defined CON_IA (
    set "PERFIL=--profile ia"
    set "QUE_LEVANTA=db, db-test, backend, mediamtx, camara, ia-engine"
)

echo.
echo   OviApp - arranque completo
echo   ==========================
echo.

REM --- 1. Docker Desktop ------------------------------------------------------

echo [1/5] Verificando Docker...
docker info >nul 2>&1
if not errorlevel 1 goto docker_listo

if not exist "%DOCKER_EXE%" (
    echo       ERROR: no se encontro Docker Desktop en:
    echo       %DOCKER_EXE%
    echo       Ajusta la variable DOCKER_EXE al inicio de este archivo.
    goto fin_error
)

echo       Docker no responde. Iniciando Docker Desktop...
start "" "%DOCKER_EXE%"
set /a ESPERA=0

:esperar_docker
REM ping en vez de timeout: timeout aborta cuando stdin viene redirigido
REM (por ejemplo al lanzar el .bat desde otro script o desde una terminal).
ping -n 4 127.0.0.1 >nul
set /a ESPERA+=1
docker info >nul 2>&1
if not errorlevel 1 goto docker_listo
if !ESPERA! GEQ 60 (
    echo       ERROR: Docker no arranco tras 3 minutos.
    goto fin_error
)
echo       ... esperando al motor de Docker ^(!ESPERA!/60^)
goto esperar_docker

:docker_listo
echo       Docker operativo.
echo.

REM --- 2. Backend, base de datos y streaming ----------------------------------

echo [2/5] Levantando contenedores...
echo       ^(!QUE_LEVANTA!^)
if defined CON_IA echo       La primera vez la imagen CUDA tarda: son varios GB.
pushd "%RAIZ%"
docker compose !PERFIL! up -d --build
if errorlevel 1 (
    echo       ERROR: fallo docker compose up.
    popd
    goto fin_error
)
popd

echo       Esperando a que la API responda...
set /a ESPERA=0

:esperar_api
curl -s -m 3 -o nul http://localhost:3000/health
if not errorlevel 1 goto api_lista
set /a ESPERA+=1
if !ESPERA! GEQ 40 (
    echo       ERROR: la API no respondio en localhost:3000.
    echo       Revisa los logs con: docker compose logs backend
    goto fin_error
)
ping -n 4 127.0.0.1 >nul
goto esperar_api

:api_lista
echo       API respondiendo en http://localhost:3000
echo.

REM --- 3. Datos de prueba (opcional) ------------------------------------------

if not defined SEMBRAR goto sin_seed
echo [3/5] Repoblando la base con datos de prueba...
pushd "%RAIZ%backend"
call npm run db:seed
if errorlevel 1 echo       AVISO: el seed fallo. El sistema sigue levantado.
popd
echo.
goto paso_ia

:sin_seed
echo [3/5] Seed omitido ^(usa "levantar-oviapp.bat seed" para repoblar^).
echo.

REM --- 4. Modulo de vision por computadora ------------------------------------

:paso_ia
if not defined CON_IA (
    echo [4/5] Modulo de IA omitido ^(argumento sin-ia^).
    echo.
    goto paso_flutter
)

echo [4/5] Comprobando el modulo de IA...
pushd "%RAIZ%"
for /f "tokens=*" %%s in ('docker inspect -f "{{.State.Status}}" oviapp-ia-engine 2^>nul') do set "ESTADO_IA=%%s"
popd

if /i "!ESTADO_IA!"=="running" (
    echo       ia-engine corriendo. Detecciones -^> POST /api/v1/edge/alertas
) else (
    echo       AVISO: ia-engine no esta corriendo ^(estado: !ESTADO_IA!^).
    echo       El resto del sistema funciona igual; la pantalla de Vigilancia
    echo       mostrara el ultimo estado conocido del dispositivo.
    echo       Revisa el detalle con:  docker compose logs ia-engine
)
echo.

REM --- 5. App Flutter en Microsoft Edge ---------------------------------------

:paso_flutter
echo [5/5] Compilando y abriendo la app en Microsoft Edge...
echo.
echo       URL       http://localhost:%PUERTO_WEB%
echo       Usuario   manuel@oviapp.cl   ^(PRODUCTOR^)
REM ^^! escapa la exclamacion: con EnableDelayedExpansion, un ! suelto se pierde.
echo       Clave     Ovi2026^^!
echo.
echo       Pulsa "q" en esta ventana para detener la app.
echo.

if not exist "%PERFIL_EDGE%" mkdir "%PERFIL_EDGE%" >nul 2>&1

pushd "%RAIZ%mobile"
call flutter run -d edge -t "%ENTRYPOINT%" --web-port=%PUERTO_WEB% ^
    --web-browser-flag="--user-data-dir=%PERFIL_EDGE%" ^
    --web-browser-flag=--no-first-run ^
    --web-browser-flag=--no-default-browser-check ^
    --web-browser-flag=--disable-sync
popd

echo.
echo   App detenida. Los contenedores siguen corriendo.
echo   Para bajarlos:  docker compose down
echo.
goto fin_ok

:fin_error
echo.
echo   Arranque interrumpido.
echo.
pause
exit /b 1

:fin_ok
pause
exit /b 0
