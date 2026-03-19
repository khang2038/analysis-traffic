# Script để setup PostgreSQL database
Write-Host "=== Setup PostgreSQL Database ===" -ForegroundColor Cyan
Write-Host ""

# Kiểm tra Docker
Write-Host "Checking Docker..." -ForegroundColor Yellow
$dockerRunning = $false
try {
    docker ps | Out-Null
    $dockerRunning = $true
    Write-Host "✓ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start Docker Desktop and run this script again." -ForegroundColor Yellow
    Write-Host "Or install PostgreSQL manually:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "  2. Install PostgreSQL" -ForegroundColor White
    Write-Host "  3. Create database: createdb analysis_traffic" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Chạy PostgreSQL container
Write-Host ""
Write-Host "Starting PostgreSQL container..." -ForegroundColor Yellow
docker-compose up -d

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ PostgreSQL container started" -ForegroundColor Green
    
    # Đợi PostgreSQL sẵn sàng
    Write-Host ""
    Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
    $maxAttempts = 30
    $attempt = 0
    $ready = $false
    
    while ($attempt -lt $maxAttempts -and -not $ready) {
        Start-Sleep -Seconds 2
        $attempt++
        try {
            $result = docker exec analysis_traffic_db pg_isready -U analysis_user -d analysis_traffic 2>&1
            if ($result -match "accepting connections") {
                $ready = $true
                Write-Host "✓ PostgreSQL is ready!" -ForegroundColor Green
            }
        } catch {
            # Continue waiting
        }
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host ""
    Write-Host "=== Database Setup Complete ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Database connection details:" -ForegroundColor Cyan
    Write-Host "  Host: localhost" -ForegroundColor White
    Write-Host "  Port: 5432" -ForegroundColor White
    Write-Host "  Database: analysis_traffic" -ForegroundColor White
    Write-Host "  User: analysis_user" -ForegroundColor White
    Write-Host "  Password: analysis_password" -ForegroundColor White
    Write-Host ""
    Write-Host "Add this to your .env file:" -ForegroundColor Yellow
    Write-Host 'DATABASE_URL="postgresql://analysis_user:analysis_password@localhost:5432/analysis_traffic?schema=public"' -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Add DATABASE_URL to .env file" -ForegroundColor White
    Write-Host "  2. Run: npm run prisma:migrate" -ForegroundColor White
    Write-Host "  3. Start collecting data!" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✗ Failed to start PostgreSQL container" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying to pull image..." -ForegroundColor Yellow
    docker pull postgres:15-alpine
    docker-compose up -d
}
