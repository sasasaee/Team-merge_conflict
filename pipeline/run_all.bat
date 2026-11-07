@echo off
setlocal
rem ===== edit these two lines only if your folders are different =====
set DEM=E:\Team-merge_conflict-main\Team-merge_conflict-main\data\LDEM_80S_20MPP_ADJ.tiff
set CLONE=E:\tmc-clone
rem ===================================================================
set HERE=%~dp0
set OUT=%HERE%..\data\final_out

if not exist "%DEM%" ( echo DEM not found: %DEM% & pause & exit /b 1 )
if not exist "%CLONE%\.git" ( echo Git clone not found: %CLONE% & pause & exit /b 1 )

echo === 1/5 choosing the best point near each of the 9 NASA regions (about 10 minutes) ===
python "%HERE%snap_sites.py" --dem "%DEM%" --sites "%HERE%sites.nasa9.yaml" --out "%HERE%sites.snapped.yaml" || ( echo FAILED at step 1 & pause & exit /b 1 )

echo === 2/5 Sun and Earth positions ===
python "%HERE%sky.py" --sites "%HERE%sites.snapped.yaml" --out "%OUT%" || ( echo FAILED at step 2 & pause & exit /b 1 )

echo === 3/5 horizons and Shadow DNA (a few minutes) ===
python "%HERE%export.py" --dem "%DEM%" --sites "%HERE%sites.snapped.yaml" --out "%OUT%" --sample || ( echo FAILED at step 3 & pause & exit /b 1 )

echo === 4/5 copying into the repo clone ===
if not exist "%CLONE%\web\public\data" mkdir "%CLONE%\web\public\data"
for %%f in (malapert mons-mouton mons-mouton-plateau nobile-rim-1 nobile-rim-2 haworth de-gerlache-rim-2 peak-near-cabeus-b slater-plain) do copy /Y "%OUT%\%%f.json" "%CLONE%\web\public\data\" >nul
robocopy "%HERE%." "%CLONE%\pipeline" /E /XD cache out demo_out __pycache__ .pytest_cache >nul
if exist "%HERE%..\docs\METHOD.md" copy /Y "%HERE%..\docs\METHOD.md" "%CLONE%\docs\METHOD.md" >nul

echo === 5/5 pushing to GitHub ===
cd /d "%CLONE%"
git add pipeline web\public\data docs
git status --short
git commit -m "R2: real data for 9 sites, SPICE-checked sky, pipeline, METHOD.md"
git push -u origin HEAD

echo.
echo DONE. Now copy everything printed above (the dna lines and the push result) and paste it to Claude.
pause
