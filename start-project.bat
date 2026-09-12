@echo off
title KMS - Knowledge Management System

echo.
echo +------------------------------------------------------------------+
echo ^|           KMS - Knowledge Management System                     ^|
echo ^|       Plataforma Colaborativa de Conocimiento                   ^|
echo +------------------------------------------------------------------+
echo ^|                                                                  ^|
echo ^|   Iniciando servicios...                                         ^|
echo ^|                                                                  ^|
echo ^|   [API]  Backend      : http://localhost:51478                   ^|
echo ^|  [WEB]  Frontend     : http://localhost:51479                   ^|
echo ^|   [SQL]  SQL Server   : 200.234.239.179:50271  (encrypt=false)   ^|
echo ^|                                                                  ^|
echo ^|   Credenciales demo:                                             ^|
echo ^|     - Usuario: carlos.perez@ejemplo.com                          ^|
echo ^|     - Clave  : Demo1234                                          ^|
echo ^|                                                                  ^|
echo +------------------------------------------------------------------+
echo.

cd /d "%~dp0"

REM ===== INYECCION TLS para SQL Server 2014 =====
set NODE_OPTIONS=--tls-min-v1.0 --tls-max-v1.2

REM ====== Verificar Node.js ======
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js no esta instalado o no esta en PATH.
    echo Descarga desde: https://nodejs.org/
    pause
    exit /b 1
)

REM ====== Dependencias BACKEND ======
if not exist "backend\node_modules" (
    echo [1/4] Instalando dependencias del BACKEND...
    cd backend
    call npm install --no-audit --no-fund
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Fallo al instalar backend.
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo       Listo.
) else (
    echo [1/4] Backend dependencies OK.
)

REM ====== Dependencias FRONTEND ======
if not exist "frontend\node_modules" (
    echo [2/4] Instalando dependencias del FRONTEND...
    cd frontend
    call npm install --no-audit --no-fund
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Fallo al instalar frontend.
        pause
        exit /b 1
    )
    cd /d "%~dp0"
    echo       Listo.
) else (
    echo [2/4] Frontend dependencies OK.
)

echo [3/4] Levantando BACKEND en puerto 51478...
start "KMS - Backend API  [localhost:51478]" cmd /k "cd /d %~dp0backend && echo =^> Backend KMS corriendo... && echo =^> Health: http://localhost:51478/api/health && echo =^> Credenciales demo: carlos.perez@ejemplo.com / Demo1234 && echo. && npm run dev"

timeout /t 2 /nobreak >nul

echo [4/4] Levantando FRONTEND en puerto 51479...
start "KMS - Frontend Web [localhost:51479]" cmd /k "cd /d %~dp0frontend && echo =^> Frontend KMS corriendo... && echo =^> Abre: http://localhost:51479 && echo =^> Credenciales demo: carlos.perez@ejemplo.com / Demo1234 && echo. && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo [OK] Ambiente KMS iniciado correctamente.
echo.
echo      Backend  -^> ventana [KMS - Backend API]
echo      Frontend -^> ventana [KMS - Frontend Web]
echo.
echo      [!] Tip: cierra este .bat o las 2 ventanas para detener todo.
echo.
pause
