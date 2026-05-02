$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $PSScriptRoot ".env"

if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        $line = $_.Trim()
        if ($line -ne "" -and -not $line.StartsWith("#")) {
            $parts = $line -split "=", 2
            if ($parts.Count -eq 2) {
                $name = $parts[0].Trim()
                $value = $parts[1].Trim()
                [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
            }
        }
    }
}

Set-Location $root

$python = Join-Path $root ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = "python"
}

& $python -m uvicorn backend.main:app --reload --reload-dir backend --port 8000
