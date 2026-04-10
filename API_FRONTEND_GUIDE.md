# API Frontend Integration Guide

Last update: 2026-03-05
Source of truth: current backend code in `src/routes`, `src/controllers`, `src/middlewares`, `src/services`

## 1) Quick start

- Base URL local: `http://localhost:3000`
- API prefix: `/api`
- Swagger UI: `GET /api-docs`
- Content-Type for requests with body: `application/json`
- Auth header for protected endpoints:
  - `Authorization: Bearer <jwt_token>`

Most endpoints return JSON with this base error shape:

```json
{
  "message": "Error description"
}
```

Some endpoints add extra fields in errors (example: shop buy).

## 2) Auth model and token flow

### Register

- Method: `POST`
- Path: `/api/auth/register`
- Auth required: `No`
- Body:

```json
{
  "email": "player@example.com",
  "username": "player42",
  "password": "MyPassword123!"
}
```

- Success `201`:

```json
{
  "message": "Usuario registrado exitosamente.",
  "user": {
    "id": "u_123",
    "username": "player42",
    "email": "player@example.com"
  }
}
```

- Errors:
  - `400`: missing fields or email/username already used
  - `500`: internal server error

### Login

- Method: `POST`
- Path: `/api/auth/login`
- Auth required: `No`
- Body:

```json
{
  "email": "player@example.com",
  "password": "MyPassword123!"
}
```

- Success `200`:

```json
{
  "message": "Inicio de sesion exitoso.",
  "token": "<jwt>",
  "user": {
    "id": "u_123",
    "username": "player42"
  }
}
```

- Errors:
  - `400`: missing fields
  - `401`: invalid credentials
  - `500`: internal server error

### JWT details used by backend

- Token payload contains: `id`, `username`
- Expiration: `24h`
- Protected routes reject:
  - missing token: `401`
  - malformed token: `401`
  - expired token: `401`

## 3) Conventions and validations

### ID prefixes

- User IDs: `u_...`
- Friend IDs: `u_...`
- Friend request IDs: `req_...`
- Collection IDs: `col_...`
- Deck IDs: `d_...`
- Card IDs used in decks/cards responses: `c_...`

### Generic ID format

- Safe regex: `^[a-zA-Z0-9_]+$`
- Lobby code regex: `^[A-Z0-9]{4,6}$`

### Important frontend note

There are some response-shape inconsistencies in current code (documented below as "actual response"). Frontend should parse the real shape shown in this guide.

## 4) Endpoint map

- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Users:
  - `GET /api/users/profile`
  - `GET /api/users/balance`
  - `GET /api/users/inventory`
  - `GET /api/users/search?q=...`
  - `GET /api/users/cards`
  - `GET /api/users/decks`
  - `POST /api/users/decks`
  - `PUT /api/users/decks/:deckId`
  - `DELETE /api/users/decks/:deckId`
- Friends:
  - `GET /api/friends`
  - `GET /api/friends/requests`
  - `POST /api/friends/requests`
  - `PUT /api/friends/requests/:requestId`
  - `DELETE /api/friends/:friendId`
- Lobbies:
  - `POST /api/lobbies`
  - `GET /api/lobbies`
  - `GET /api/lobbies/:lobbyCode`
  - `POST	/lobbies/:lobbyCode/join`	Solicita acceso y obtiene el token (ticket) para el WebSocket.
- Shop:
  - `GET /api/shop/items`
  - `POST /api/shop/buy`
- Collections:
  - `GET /api/collections`
  - `GET /api/collections/:collectionId/cards`

## 5) Users module

All users endpoints require Bearer token.

### GET /api/users/profile

- Returns authenticated profile.
- Success `200` (actual):

```json
{
  "profile": {
    "id_user": 12,
    "username": "player42",
    "email": "player@example.com",
    "exp_level": 5,
    "progress_level": 40,
    "state": "online",
    "personal_state": "ready",
    "id": "u_12"
  }
}
```

- Errors:
  - `401`, `404`, `500`

### GET /api/users/balance

- Success `200` (actual shape):

```json
{
  "balance": {
    "balance": 1500
  }
}
```

- Errors:
  - `401`, `500`

### GET /api/users/inventory

- Success `200` (actual shape):

```json
{
  "inventory": {
    "inventory": []
  }
}
```

- Errors:
  - `401`, `500`

### GET /api/users/search?q=<text>

- Query required: `q`
- Success `200`:

```json
{
  "results": [
    {
      "id": "u_3",
      "username": "player3"
    }
  ]
}
```

- Errors:
  - `400` if `q` missing
  - `401`, `500`

### GET /api/users/cards

- Success `200`:

```json
{
  "cards": [
    {
      "cardId": "c_101",
      "name": "Dragon de Fuego",
      "quantity": 2
    }
  ]
}
```

- Errors:
  - `401`, `500`

### GET /api/users/decks

- Success `200`:

```json
{
  "decks": [
    {
      "id": "d_1",
      "name": "Mazo Velocidad",
      "cardIds": ["c_10", "c_20"]
    }
  ]
}
```

- Errors:
  - `401`, `500`

### POST /api/users/decks

- Body:

```json
{
  "name": "Mazo Control",
  "cardIds": ["c_10", "c_20", "c_20"]
}
```

- Validation notes:
  - `name` required, non-empty string
  - `cardIds` required, non-empty array
  - user must own all sent cards (middleware)

- Success `201`:

```json
{
  "message": "Mazo creado exitosamente.",
  "deck": {
    "id": "d_7",
    "name": "Mazo Control",
    "cardIds": ["c_10", "c_20", "c_20"]
  }
}
```

- Errors:
  - `400`: invalid deck body
  - `403`: user does not own all cards
  - `401`, `500`

### PUT /api/users/decks/:deckId

- Param: `deckId` must start with `d_`
- Body same as create deck.
- Middleware order:
  - `validateIdParam('deckId')`
  - `isDeckOwner`
  - `validateDeckBody`
  - `hasCardsInCollection`

- Success `200`:

```json
{
  "message": "Mazo actualizado.",
  "deck": {
    "id": "d_7",
    "name": "Mazo Control v2",
    "cardIds": ["c_10", "c_30"]
  }
}
```

- Errors:
  - `400`, `401`, `403`, `404`, `500`

### DELETE /api/users/decks/:deckId

- Param: `deckId` must start with `d_`
- Success `200`:

```json
{
  "message": "Mazo eliminado correctamente."
}
```

- Errors:
  - `400`, `401`, `403`, `404`, `500`

## 6) Friends module

All friends endpoints require Bearer token.

### GET /api/friends

- Success `200`:

```json
{
  "friends": [
    {
      "id": "u_456",
      "username": "PlayerDos",
      "status": "online"
    }
  ]
}
```

- Errors:
  - `401`, `500`

### GET /api/friends/requests

- Success `200`:

```json
{
  "pendingRequests": [
    {
      "id": "req_001",
      "fromUserId": "u_999",
      "fromUsername": "Ninja",
      "createdAt": "2026-03-01T10:00:00Z"
    }
  ]
}
```

- Errors:
  - `401`, `500`

### POST /api/friends/requests

- Body:

```json
{
  "targetUserId": "u_789"
}
```

- Validation notes:
  - `targetUserId` required
  - must start with `u_`
  - cannot send request to self
  - cannot send if already friends/pending

- Success `201`:

```json
{
  "message": "Solicitud de amistad enviada con exito.",
  "request": {
    "id": "req_1741170000000",
    "fromUserId": "u_123",
    "toUserId": "u_789",
    "status": "pending"
  }
}
```

- Errors:
  - `400`, `401`, `500`

### PUT /api/friends/requests/:requestId

- Param: `requestId` must start with `req_`
- Body:

```json
{
  "action": "accept"
}
```

or

```json
{
  "action": "reject"
}
```

- Success `200`:

```json
{
  "message": "Solicitud de amistad aceptada. Ahora son amigos."
}
```

or

```json
{
  "message": "Solicitud de amistad rechazada."
}
```

- Errors:
  - `400`, `401`, `403`, `404`, `500`

### DELETE /api/friends/:friendId

- Param: `friendId` must start with `u_`
- Success `200`:

```json
{
  "message": "Amigo eliminado correctamente de tu lista."
}
```

- Errors:
  - `400`, `401`, `500`

## 7) Lobbies module

All lobbies endpoints require Bearer token.

### POST /api/lobbies

- Body:

```json
{
  "name": "Mi sala",
  "maxPlayers": 4,
  "engine": "Classic",
  "isPrivate": false
}
```

- Validation:
  - `name` required non-empty string
  - `maxPlayers` between `3` and `6`
  - `engine` must be `Classic` or `Stella`
  - `isPrivate` boolean

- Success `201`:

```json
{
  "message": "Sala creada exitosamente. Listo para conexion WebSocket.",
  "lobby": {
    "_id": "db_id_12345",
    "hostId": "u_123",
    "name": "Mi sala",
    "maxPlayers": 4,
    "engine": "Classic",
    "isPrivate": false,
    "lobbyCode": "QIXQ",
    "status": "waiting",
    "players": ["u_123"],
    "createdAt": "2026-03-05T14:00:00.000Z"
  }
}
```

- Errors:
  - `400`, `401`, `500`

### GET /api/lobbies?search=<text>

- Query optional: `search`
- Success `200`:

```json
{
  "lobbies": [
    {
      "lobbyCode": "A1B2",
      "name": "Sala de Novatos",
      "hostId": "u_111",
      "players": ["u_111", "u_222"],
      "maxPlayers": 4,
      "engine": "Classic",
      "status": "waiting"
    }
  ]
}
```

- Errors:
  - `401`, `500`

### GET /api/lobbies/:lobbyCode

- Param: `lobbyCode` regex `^[A-Z0-9]{4,6}$`
- Success `200`:

```json
{
  "message": "Sala encontrada.",
  "lobby": {
    "lobbyCode": "A1B2",
    "name": "Sala de Novatos",
    "hostId": "u_111",
    "players": ["u_111", "u_222"],
    "maxPlayers": 4,
    "engine": "Classic",
    "isPrivate": false,
    "status": "waiting"
  }
}
```

- Business errors:
  - `403` if lobby is full
  - `404` if lobby does not exist
- Validation/internal errors:
  - `400`, `401`, `500`

## 8) Shop module

All shop endpoints require Bearer token.

### GET /api/shop/items

- Success `200`:

```json
{
  "items": [
    {
      "id": "deck_vampire",
      "type": "thematic_deck",
      "name": "Sombras Vampiricas",
      "price": 500
    },
    {
      "id": "board_neon",
      "type": "cosmetic",
      "name": "Tablero Neon Cyberpunk",
      "price": 1200
    }
  ]
}
```

- Errors:
  - `401`, `500`

### POST /api/shop/buy

- Body:

```json
{
  "itemId": "deck_vampire"
}
```

- Success `200`:

```json
{
  "message": "Has comprado 'Sombras Vampiricas' exitosamente.",
  "updatedBalance": {
    "userId": "u_123",
    "coins": 500,
    "gems": 50
  }
}
```

- Errors:
  - `400`: invalid body or item already owned
  - `403`: insufficient funds
  - `404`: item does not exist
  - `409`: transaction in progress for this user (lock)
  - `500`: internal transaction error

- `403` example:

```json
{
  "message": "Fondos insuficientes.",
  "required": 1200,
  "currentBalance": 300
}
```

## 9) Collections module

All collections endpoints currently require Bearer token.

### GET /api/collections

- Success `200` (actual current shape):

```json
{
  "collections": {
    "collections": [
      {
        "id": "col_1",
        "name": "Set Inicial",
        "description": "Coleccion base",
        "release_date": "2025-12-01T00:00:00.000Z",
        "total_cards": 100
      }
    ]
  }
}
```

- Errors:
  - `401`, `500`

### GET /api/collections/:collectionId/cards

- Param: `collectionId` must start with `col_`
- Success `200` (actual current shape):

```json
{
  "collection": {
    "id": "col_1",
    "name": "Set Inicial"
  },
  "cards": {
    "collection": {
      "id": "col_1",
      "name": "Set Inicial"
    },
    "cards": [
      {
        "id": "c_10",
        "name": "Dragon de Fuego",
        "type": "Standard",
        "rarity": "Rara"
      }
    ]
  }
}
```

- Errors:
  - `400`, `401`, `404`, `500`

## 10) Frontend TypeScript helpers

### Shared base types

```ts
export type ApiError = {
  message: string;
  required?: number;
  currentBalance?: number;
};

export type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  token?: string;
  body?: unknown;
};
```

### Generic request helper

```ts
const API_BASE = 'http://localhost:3000/api';

export async function apiRequest<T>(
  path: string,
  { method = 'GET', token, body }: ApiRequestOptions = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json();

  if (!res.ok) {
    throw data as ApiError;
  }

  return data as T;
}
```

### Example module clients

```ts
export const AuthApi = {
  register: (payload: { email: string; username: string; password: string }) =>
    apiRequest<{ message: string; user: { id: string; username: string; email: string } }>(
      '/auth/register',
      { method: 'POST', body: payload },
    ),

  login: (payload: { email: string; password: string }) =>
    apiRequest<{ message: string; token: string; user: { id: string; username: string } }>(
      '/auth/login',
      { method: 'POST', body: payload },
    ),
};
```

```ts
export const UsersApi = {
  profile: (token: string) => apiRequest('/users/profile', { token }),
  balance: (token: string) => apiRequest('/users/balance', { token }),
  inventory: (token: string) => apiRequest('/users/inventory', { token }),
  search: (token: string, q: string) => apiRequest(`/users/search?q=${encodeURIComponent(q)}`, { token }),
  cards: (token: string) => apiRequest('/users/cards', { token }),
  decks: (token: string) => apiRequest('/users/decks', { token }),
  createDeck: (token: string, payload: { name: string; cardIds: string[] }) =>
    apiRequest('/users/decks', { method: 'POST', token, body: payload }),
};
```

## 11) Known backend-contract quirks (important for frontend)

1. `GET /api/users/balance` returns nested object:
   - current: `{ balance: { balance: number } }`
2. `GET /api/users/inventory` returns nested object:
   - current: `{ inventory: { inventory: [] } }`
3. `GET /api/collections` returns nested object:
   - current: `{ collections: { collections: [...] } }`
4. `GET /api/collections/:collectionId/cards` returns nested `cards` object, not a plain array.
5. `PUT/DELETE /api/users/decks/:deckId` may fail due ownership check implementation mismatch (worth backend fix before frontend hard dependency).

## 12) Suggested frontend integration order

1. Implement auth (`register`, `login`, token store).
2. Add global API helper with auto `Authorization` header.
3. Integrate read-only data first (`profile`, `cards`, `collections`, `shop/items`).
4. Integrate mutations (`decks`, `friends`, `shop/buy`, `lobbies/create`).
5. Normalize inconsistent responses in one mapping layer.

## 13) Copy-paste fetch examples

### Login

```ts
const loginRes = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginData = await loginRes.json();
const token = loginData.token;
```

### Get profile

```ts
const res = await fetch('http://localhost:3000/api/users/profile', {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
```

### Buy item

```ts
const buyRes = await fetch('http://localhost:3000/api/shop/buy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ itemId: 'deck_vampire' }),
});
const buyData = await buyRes.json();
```

### Create lobby

```ts
const lobbyRes = await fetch('http://localhost:3000/api/lobbies', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    name: 'Sala Rankeds',
    maxPlayers: 4,
    engine: 'Classic',
    isPrivate: false,
  }),
});
const lobbyData = await lobbyRes.json();
```

## 14) Final recommendation

Use Swagger (`/api-docs`) for quick inspection, but for frontend contract rely on this file because it reflects current runtime behavior from controllers/services.
