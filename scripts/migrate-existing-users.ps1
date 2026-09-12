$ErrorActionPreference = 'Stop'

$projectId = 'inter-level-progress-manager'
$appId = '1:379503088311:web:6a63dfcd8523e9f8133332'
$temporaryExport = Join-Path $env:TEMP ("collage-auth-{0}.json" -f [guid]::NewGuid())

try {
  firebase auth:export $temporaryExport --format=json --project $projectId | Out-Null
  $authExport = Get-Content -Raw -LiteralPath $temporaryExport | ConvertFrom-Json
  $firebaseLogin = firebase login:list --json | ConvertFrom-Json
  $accessToken = $firebaseLogin.result[0].tokens.access_token
  $headers = @{ Authorization = "Bearer $accessToken" }
  $runQueryUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents:runQuery"
  $uids = [System.Collections.Generic.HashSet[string]]::new()

  foreach ($collectionName in @('students', 'categories', 'items', 'participations', 'results', 'frameTemplates')) {
    $query = @{
      structuredQuery = @{
        from = @(@{ collectionId = $collectionName; allDescendants = $true })
        limit = 1000
      }
    } | ConvertTo-Json -Depth 8
    $rows = Invoke-RestMethod -Method Post -Uri $runQueryUrl -Headers $headers -ContentType 'application/json' -Body $query
    foreach ($row in $rows) {
      if ($row.document.name -match '/documents/users/([^/]+)/') { [void]$uids.Add($Matches[1]) }
    }
  }

  $migrated = 0
  $missingAuthUser = 0
  foreach ($uid in $uids) {
    $authUser = $authExport.users | Where-Object { $_.localId -eq $uid } | Select-Object -First 1
    if (-not $authUser) { $missingAuthUser++; continue }

    $documentUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/accessUsers/$uid"
    $existing = $null
    try { $existing = Invoke-RestMethod -Method Get -Uri $documentUrl -Headers $headers } catch {
      if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
    }

    $appFields = @{}
    if ($existing.fields.apps.mapValue.fields) {
      foreach ($property in $existing.fields.apps.mapValue.fields.PSObject.Properties) {
        $appFields[$property.Name] = @{ booleanValue = ($property.Value.booleanValue -eq $true) }
      }
    }
    $appFields[$appId] = @{ booleanValue = $true }

    $providers = @()
    foreach ($provider in $authUser.providerUserInfo) {
      if ($provider.providerId) { $providers += @{ stringValue = [string]$provider.providerId } }
    }

    $payload = @{
      fields = @{
        uid = @{ stringValue = $uid }
        email = @{ stringValue = ([string]$authUser.email).ToLowerInvariant() }
        displayName = @{ stringValue = [string]$authUser.displayName }
        providerIds = @{ arrayValue = @{ values = $providers } }
        active = @{ booleanValue = $true }
        apps = @{ mapValue = @{ fields = $appFields } }
        updatedAt = @{ timestampValue = [DateTime]::UtcNow.ToString('o') }
      }
    } | ConvertTo-Json -Depth 12

    $mask = '?updateMask.fieldPaths=uid&updateMask.fieldPaths=email&updateMask.fieldPaths=displayName&updateMask.fieldPaths=providerIds&updateMask.fieldPaths=active&updateMask.fieldPaths=apps&updateMask.fieldPaths=updatedAt'
    Invoke-RestMethod -Method Patch -Uri ($documentUrl + $mask) -Headers $headers -ContentType 'application/json' -Body $payload | Out-Null
    $migrated++
  }

  Write-Output "Migrated $migrated existing app data owner(s); $missingAuthUser had no matching Firebase Auth account."
}
finally {
  if (Test-Path -LiteralPath $temporaryExport) { Remove-Item -LiteralPath $temporaryExport -Force }
}
