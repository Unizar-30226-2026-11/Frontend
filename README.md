# Proyecto Software Frontend

Frontend Angular del proyecto de juego basado en Dixit, con soporte para:

- autenticacion y sesion persistente
- lobby y listado de partidas
- tienda, perfil y ajustes
- modo clasico de Dixit
- modo Stella
- integracion realtime por websocket para estado de sala, partida, minijuegos y eventos especiales

## Stack

- Angular 21 con componentes standalone
- TypeScript
- Angular Router
- Signals de Angular para estado reactivo
- Fetch API a traves de un cliente HTTP propio
- WebSocket / Socket.IO a traves del servicio `DixitRealtime`
- Nginx para despliegue del build estatico

## Requisitos

- Node.js 22 o compatible
- npm 11 o compatible
- Backend disponible en `http://localhost:3000` para desarrollo local

## Configuracion de entornos

- Desarrollo local:
  - `proxy.conf.json` redirige `/api` a `http://localhost:3000`
  - solo afecta a `ng serve`
- Produccion:
  - el frontend se sirve estaticamente con nginx
  - nginx proxifica `/api` y `/socket.io/` usando la variable de entorno `BACKEND_URL`
  - `proxy.conf.json` no se usa en produccion

Ejemplo de `BACKEND_URL`:

```bash
BACKEND_URL=http://backend:3000
```

## Scripts

```bash
npm install
npm run start
npm run build
npm run test
```

### Desarrollo local

El proyecto usa `proxy.conf.json` para redirigir `/api` a `http://localhost:3000`, asi que en local basta con levantar backend y frontend:

```bash
npm install
npm run start
```

La aplicacion quedara disponible en `http://localhost:4200`.

### Build de produccion

```bash
npm run build
```

El resultado se genera en `dist/proyecto-software-front/`.

### Despliegue Docker

La imagen final usa nginx y requiere `BACKEND_URL` en runtime para reenviar:

- `/api/*`
- `/socket.io/*`

Ejemplo:

```bash
docker run -p 8080:80 -e BACKEND_URL=http://backend:3000 ghcr.io/<org>/<repo>:latest
```

### Tests

```bash
npm run test
```

Los tests del repo estan escritos en formato Jasmine/Karma-style sobre el builder de Angular (`@angular/build:unit-test`), aunque tambien exista `vitest` como dependencia de desarrollo.

## Docker

El `Dockerfile` construye la app en una imagen `node:22-alpine` y despues sirve el resultado estatico con `nginx:1.27-alpine`.

Flujo:

1. `npm ci`
2. `ng build --configuration production`
3. copia de `dist/proyecto-software-front/browser` a `/usr/share/nginx/html`
4. uso de `nginx/default.conf.template`
5. proxy de `/api` y `/socket.io` usando `BACKEND_URL`

## Seguridad y produccion

- La app usa una `Content-Security-Policy` y cabeceras de seguridad desde `index.html` y nginx.
- El cliente de Socket.IO se carga como dependencia del proyecto, no desde CDN.
- La sesion se mantiene en `localStorage` por compatibilidad actual con backend.
- Solo se persiste la informacion minima necesaria para restaurar sesion y reconexion.
- El workflow de CI publica imagen Docker solo despues de pasar `build` y `test`.

## Rutas principales

Definidas en [src/app/app.routes.ts](src/app/app.routes.ts):

- `/` - portada
- `/login` - acceso
- `/register` - registro
- `/menu` - menu principal
- `/games` - listado de salas
- `/games/:id` - lobby de una partida
- `/game/:id` - shell unificado que decide entre Dixit clasico y Stella
- `/store` - tienda
- `/store/packs/:id` - detalle de pack
- `/deck-builder` - constructor de mazos
- `/profile` - perfil
- `/settings` - ajustes / resumen de cuenta
- `/test/dixit/:id` - shell de pruebas de Dixit
- `/test/stella/:id` - shell de pruebas de Stella
- `/test/star` - test visual de estrella fugaz

Las rutas antiguas `/dixit/:id` y `/dixit-stella/:id` redirigen a `/game/:id`.

## Arquitectura general

### 1. Capa de paginas y componentes

Cada pantalla principal vive en su propia carpeta bajo `src/app/` y suele exponerse como componente standalone:

- `home/`
- `login/`
- `register/`
- `main-menu/`
- `games/`
- `lobby-menu/`
- `store/`
- `profile/`
- `settings/`
- `deck-builder/`
- `dixit/`
- `dixit-stella/`

### 2. Capa de servicios

La carpeta `src/app/services/` concentra la logica de acceso a datos y estado compartido:

- `api-client.ts`
  Cliente base para peticiones REST contra `/api`.
- `auth.ts`
  Gestion de login, registro, refresco de sesion y persistencia local.
- `player-store.ts`
  Estado de jugador cargado en memoria.
- `player-info-pull.ts`
  Perfil, balance y mutaciones de cuenta.
- `dixit-realtime.ts`
  Servicio central de websocket para lobby, partida, chat, conflictos, minijuegos y cierre de partida.
- `games-pull.ts`
  Listado y detalle de partidas.
- `card-pull.ts`, `stella-card-pull.ts`
  Catalogos de cartas por modo.
- `boards-pull.ts`
  Inventario y activacion de tableros.
- `decks-pull.ts`
  Mazos del usuario y catalogo de tienda.
- `collections-pull.ts`, `friends-pull.ts`
  Otras consultas auxiliares.

### 3. Capa de interfaces

`src/app/interfaces/` contiene los contratos tipados del frontend:

- auth
- api
- game
- player-info
- dixit-realtime
- store-item
- word-card

## Como se selecciona el modo de juego

La ruta `/game/:id` renderiza [src/app/game-shell/game-shell.ts](src/app/game-shell/game-shell.ts), que decide si debe montar:

- `app-dixit`
- `app-dixit-stella`

La decision se toma a partir de:

1. `realtime.gameState()?.state.mode`
2. y, si aun no existe ese dato, `auth.activeGameEngine()`

## Realtime

El servicio [src/app/services/dixit-realtime.ts](src/app/services/dixit-realtime.ts) es una pieza central del proyecto. Gestiona:

- union a lobby por REST antes de abrir socket
- reconexion y restauracion de sesion activa
- estado de lobby
- estado publico de partida
- mano privada
- retos 1 vs 1
- inicio de minijuegos
- eventos especiales
- chat
- cierre de partida y actualizacion de wallet

Este servicio expone gran parte de su estado mediante `signal` y `computed`.

## Estructura del repositorio

```text
Frontend/
|- src/
|  |- app/
|  |  |- components/        # componentes reutilizables de UI
|  |  |- deck-builder/      # constructor de mazos
|  |  |- dixit/             # modo clasico
|  |  |  |- components/
|  |  |  |- minijuegos/
|  |  |  |- phases/
|  |  |  |- styles/
|  |  |- dixit-stella/      # modo Stella
|  |  |- game-shell/        # selector de modo para /game/:id
|  |  |- games/             # listado de salas y tarjetas de partida
|  |  |- home/              # landing
|  |  |- interfaces/        # contratos TypeScript
|  |  |- lobby-menu/        # sala previa a la partida
|  |  |- login/
|  |  |- main-menu/
|  |  |- profile/
|  |  |- register/
|  |  |- services/          # REST, auth, realtime, stores
|  |  |- settings/
|  |  |- shared/            # overlays y piezas compartidas
|  |  |- store/             # tienda y packs
|  |  |- test/              # shells de prueba manual
|  |  |- app.routes.ts
|  |  |- app.config.ts
|  |  |- app.ts
|  |- assets operativos de Angular
|  |- styles.css
|- assets/                  # imagenes y recursos del juego
|- fonts/                   # tipografias
|- nginx/                   # configuracion de nginx para despliegue
|- public/                  # archivos publicos copiados tal cual al build
|- .github/workflows/       # automatizacion CI/CD si aplica
|- Dockerfile
|- angular.json
|- proxy.conf.json
|- package.json
```

## Carpetas importantes dentro de `src/app/dixit`

- `minijuegos/`
  Minijuegos compartidos por los flujos realtime.
- `phases/`
  Vistas y logica de fases del juego clasico.
- `components/`
  Componentes visuales del tablero.
- `dixit.logic.ts`
  Utilidades de calculo y transformacion de estado.
- `dixit.constants.ts`
  Constantes de flujo y configuracion visual.

## Convenciones del proyecto

- Se usan componentes standalone en lugar de `NgModule` clasicos.
- El acceso a backend se hace a traves de servicios concretos apoyados en `ApiClient`.
- La logica realtime no se mezcla directamente con fetch REST salvo donde tiene sentido funcional.
- El estado de autenticacion y de partida activa se persiste en `localStorage`.
- Muchas pantallas tienen sus propios `.spec.ts`.

## Recursos auxiliares del repo

- `DixitStella_sin_entidades.md`
  Documento funcional relacionado con Stella.
- `Sockets Partida · Wiki.html`
  Documentacion exportada sobre eventos de socket y flujo de partida.

## Recomendaciones para trabajar en el proyecto

- Si tocas rutas o flujos de sesion, revisa tambien los guards en `app.routes.ts`.
- Si tocas modos de juego, comprueba si el cambio afecta tanto a `dixit/` como a `dixit-stella/`.
- Si tocas contratos de backend, revisa `interfaces/` y los normalizadores de `services/`.
- Si tocas minijuegos o eventos realtime, valida la integracion con `DixitRealtime`.

## Estado actual del README

Este documento intenta describir la estructura real del repo a fecha actual. Si se anaden nuevas areas funcionales, conviene actualizar:

- rutas
- estructura de carpetas
- servicios disponibles
- flujo de despliegue
