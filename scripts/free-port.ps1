$conn = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue
if ($conn) {
    $conn | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Output "Killed process on port 5173"
} else {
    Write-Output "Port 5173 is free"
}
