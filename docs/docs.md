# Gestión de Locales

Este documento contiene los comandos de **PowerShell** necesarios para interactuar con la API. 

> **Nota Importante:** Reemplaza los valores de `id` y `$TOKEN` por los reales antes de ejecutar.

---

## PONER EL TOKEN
Ejecuta esto al abrir tu terminal:
```powershell
$TOKEN = "TU_TOKEN_AQUÍ"
```

## READ (Consultar locales)
```powershell
Invoke-RestMethod -Method Get `
  -Uri "https://gestor-2h2k71rv7-fernandanevarez7171-gmailcoms-projects.vercel.app/api/locales" `
  -Headers @{ Authorization = "Bearer $TOKEN" } | ConvertTo-Json -Depth 10
  ```

  ## CREATE (Crear nuevo local)
  ```powershell
  $body = @{
  numero = 105
  metros_cuadrados = 145
  estatus = "desocupado"
  renta = 12000
  mantenimiento_mensual = 1500
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "https://gestor-2h2k71rv7-fernandanevarez7171-gmailcoms-projects.vercel.app/api/locales" `
  -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $body | ConvertTo-Json -Depth 10
  ```

  
  ## UPDATE (Actualizar local)
  ```powershell
  $bodyUpdate = @{
  id = "7949ee3a-9a40-4082-83bd-a89945782113"
  numero = 105
  metros_cuadrados = 99
  estatus = "propuesta_activa"
  renta = 9999
  mantenimiento_mensual = 99
} | ConvertTo-Json

Invoke-RestMethod -Method Put `
  -Uri "https://gestor-2h2k71rv7-fernandanevarez7171-gmailcoms-projects.vercel.app/api/locales" `
  -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" } `
  -Body $bodyUpdate | ConvertTo-Json -Depth 10
  ```

  
  ## DELETE (Eliminar local)
  ```powershell
 $TOKEN = "ES NECESARIO PONERLO JUNTITO"

$bodyDelete = @{ id = "7949ee3a-9a40-4082-83bd-a89945782113"; action = "delete" } | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "https://gestor-7i1clbiuk-fernandanevarez7171-gmailcoms-projects.vercel.app/api/locales" -Headers @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" } -Body $bodyDelete
  ```