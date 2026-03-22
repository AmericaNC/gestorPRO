# GestiónPRO  
## Documento de Requerimientos del Sistema (SRS)

---
# 🚀 Instalación y Ejecución del Proyecto

Sigue estos pasos para correr GestiónPRO en tu entorno local.

---

## Clonar el repositorio

```bash
git clone https://github.com/AmericaNC/gestorPRO.git
cd gestionPRO
```

---

## Instalar dependencias

Tener instalado:

- Node.js (versión 18 o superior recomendada)
- npm

Luego ejecutar:

```bash
npm install
```

## Ejecutar el proyecto en modo desarrollo

```bash
npm run dev
```

Esto iniciará el servidor en:

```
http://localhost:5173
```

### Usar funciones API con Vercel local

Para que `/api/...` funcione igual que el servidor remoto:

```bash
npx vercel dev
```

Y en el frontend asegura la URL base con variable de entorno:

- `.env`:
  - `VITE_API_URL=https://gestor-jqli2b9n1-fernandanevarez7171-gmailcoms-projects.vercel.app`

Esto permite trabajar con `apiUrl('/api/users')` y `apiUrl('/api/locales')` sin cambiar el fetch manual.

## Despliegue en Vercel (frontend + API)

1. **Instala el CLI** (opcional para pruebas locales):
   ```bash
   npm install -g vercel
   ```
2. **Inicia sesión** y elige el proyecto desde la carpeta `gestionPRO`:
   ```bash
   vercel login
   vercel
   ```
3. Vercel detectará automáticamente el framework (Vite) y la carpeta `api`
   para funciones serverless. Cualquier archivo JS/TS dentro de `/api`
   se convertirá en una función accesible en `https://<tu-proyecto>.vercel.app/api/<nombre>`.
4. Usa variables de entorno (Settings → Environment Variables) para
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, y cualquier otra que
   necesites en tus funciones Node.

### Estructura de funciones

- `api/hello.js` contiene un ejemplo básico. Puedes agregar más rutas o
  mover tu backend Node aquí. Importa módulos normales, instala
  dependencias en `package.json`, y Vercel las empaquetará.
- Agrega un `vercel.json` (ya incluido) si quieres personalizar rutas o
  configuraciones de compilación.

> **Nota:** En producción, Vercel compila el frontend con `npm run
deploy` usando la configuración de `vite.config.js` y expone el bundle
estático junto a las funciones.





# 1. Descripción General

GestiónPRO es un sistema administrativo para la gestión de locales comerciales que centraliza:

- Control de locales
- Administración de contratos
- Gestión de arrendatarios
- Registro financiero de pagos
- Expediente digital
- Reportes administrativos

El sistema contará con **un único usuario administrador autenticado mediante login con contraseña**.

---

# 2. Arquitectura del Sistema

## 2.1 Frontend
- Framework: React + Vite
- Estilizado con Tailwind CSS
- Desplegado en Vercel
- Consume API serverless

## 2.2 Backend
- Node.js (Funciones Serverless)
- Desplegado en Vercel
- Contiene validaciones de negocio críticas antes de escribir en base de datos

## 2.3 Base de Datos
- PostgreSQL
- Integridad garantizada mediante:
  - Restricciones
  - Columnas generadas
  - Constraints únicos
  - Relaciones foráneas

## 2.4 Storage
- Supabase Storage
- Almacenamiento de:
  - Contratos en PDF
  - Documentos adicionales
- La base de datos almacena únicamente la ruta del archivo

---

# 3. Módulos Funcionales


# 3.1 Autenticación

## Descripción
El sistema tendrá un único usuario administrador.

## Reglas
- Login mediante contraseña encriptada.
- No existe sistema multiusuario.
- No existen roles.
- No existe recuperación automática de contraseña (opcional según implementación futura).

---

# 3.2 Dashboard

## Descripción
Vista demostrativa con métricas generales del sistema.

## Funcionalidad
- Consultas agregadas a la base de datos.
- No realiza escrituras.
- Muestra:
  - Total de locales (ocupados y rentados)
  - Tasa de ocupación
  - Ingresos mensuales
  - Contratos activos

---

# 3.3 Módulo de Locales

## Descripción
Gestión completa de los locales comerciales.

## Funcionalidades
- Registrar nuevo local.
- Editar información existente.
- Consultar lista completa.

## Campos Principales
- Número de local (único)
- Metros cuadrados
- Estatus:
  - rentado
  - desocupado
  - propuesta_activa
  - proximo_a_desocuparse
- Renta
- Mantenimiento
- Total (calculado automáticamente)
- Renta por m² (calculado automáticamente)
- Tarjetas de visualizacion (locales ocupados, rentados, en propuesta activa o proximos a desocuparse)
- Filtrado por numero de local o estatus

## Reglas de Negocio
- No puede existir duplicidad de número de local.
- El estatus debe estar dentro del ENUM permitido.
- Los cálculos financieros se generan automáticamente en base de datos.

---

# 3.4 Módulo de Arrendatarios

## Descripción
Gestión de personas físicas o morales que rentan los locales.

## Funcionalidades
- Registrar nuevo arrendatario.
- Editar información.
- Consultar historial.
- Ver estado financiero general.

## Estado Financiero del Arrendatario
El sistema debe determinar si el arrendatario está:

- al_dia
- atrasado
- pendiente

Este cálculo se basa en:
- Pagos registrados
- Periodos vencidos
- Diferencias acumuladas

---

# 3.5 Módulo de Contratos

## Descripción
Gestión completa del ciclo de contratos.

## Funcionalidades
- Crear nuevo contrato.
- Consultar contratos activos.
- Consultar contratos próximos a vencer.
- Consultar contratos vencidos.

## Validaciones Obligatorias (Backend)

Antes de crear un contrato:

1. El local debe estar en estado "desocupado".
2. El arrendatario no debe tener contrato activo en otro local.
3. Debe definirse:
   - Fecha inicio
   - Fecha fin
   - Renta acordada

## Reglas
- Al crear contrato:
  - El estatus del local cambia automáticamente a "rentado".
- Al vencer contrato:
  - El estatus del local puede cambiar a "proximo_a_desocuparse" o "desocupado".

---

# 3.6 Incremento de Renta

## Descripción
Permite aplicar aumento porcentual a la renta base.

## Modalidades
- Incremento individual por local.
- Incremento masivo a todos los locales activos.

## Reglas
- El incremento se expresa como porcentaje.
- El sistema recalcula:
  - renta
  - total
  - renta_por_m2
  - Diferencia porcentual de renta
---

# 3.7 Módulo Financiero

## Descripción
Registro mensual de pagos por local.

## Funcionalidades
- Registrar pago mensual.
- Consultar pagos históricos.
- Filtrar por periodo.
- Filtrar por local.
- Consultar diferencia contra monto esperado.

## Tabla 
Nueva tabla: pagos

## Campos Clave
- id
- periodo (YYYY-MM)
- local_id
- contrato_id
- monto_esperado
- monto_pagado
- diferencia (calculada)
- fecha_pago
- metodo_pago
- estado (calculado):
  - al_dia
  - parcial
  - pendiente

## Reglas Críticas
- No puede existir más de un pago por local en el mismo periodo.
- El estado se calcula automáticamente.
- La diferencia se calcula automáticamente.

---

# 3.8 Expediente Digital

## Descripción
Gestión documental asociada a contratos y locales.

## Funcionalidades
- Subir contrato PDF.
- Subir documentos adicionales.
- Consultar documentos por local.

## Base de Datos
La tabla debe contener:

- id
- local_id (FK)
- contrato_id (opcional)
- tipo_documento
- ruta_storage
- fecha_subida
Revisar los requerimientos de pdf de cada documento.

## Reglas
- El archivo físico se guarda en Supabase Storage.
- La base de datos solo guarda la referencia (ruta).
- Si se elimina contrato, debe evaluarse política de borrado de documentos.

---

# 3.9 Reportes

## Descripción
Presentación visual de información financiera y operativa.

## Características
- No escriben en base de datos.
- Solo realizan consultas.
- Pueden exportarse a:
  - PDF
- Presentacion de la informacion a forma de tarjetas
- Tabla de locales en estado moroso
- Tabla de contratos proximos a vencer
- Desglose de ingresos por local

---

# 4. Reglas Globales del Sistema

1. El sistema tiene 3 tipos de usuarios: administrador, gestr y lector
2. Las validaciones se hacen en backend.
3. La base de datos debe proteger integridad financiera.
4. No se permite duplicidad de:
   - Local por número
   - Pago por periodo
   - Contrato activo por local
5. Los cálculos financieros deben realizarse preferentemente en la base de datos.

# 4.1 Roles y usuarios
- El sistema actualmente cuenta con tres roles diferenciados: admin, gestor, lector
- /locales se puede acceder por admin y gestor 
- /contratos se puede acceder por admin y gestor 
- /expedientes se puede acceder por admin y gestor 
- /incrementos se puede acceder por admin y gestor 
- /financiero se puede acceder por admin y gestor 
- /arrendatarios se puede acceder por admin y gestor 
- /reportes se puede acceder por admin, gestor y lector
- /configuracion se puede acceder sola y unicamente por admin 

Es importante mantener la restriccion cuando se realice el consumo desde el fontend. Solo el usuario administrador puede crear otros usuarios.
