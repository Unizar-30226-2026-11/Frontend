# **Propuesta Técnica: Reconexión de Partidas (Versión Simplificada)**

## **1\. El Objetivo**

Que si un jugador refresca la página (sale de la aplicación) o se le corta el internet, el sistema sepa si debe devolverlo a la partida que tenía abierta o si debe dejarlo en el menú principal.

## **2\. El "Cerebro" del Sistema (Redis)**

Usaremos Redis para guardar quién está jugando. Es como una libreta de notas rápida que el Backend consulta constantemente.

| Clave | Valor | ¿Cuándo se borra? |
| :---- | :---- | :---- |
| user:session:{userId} | gameId | Cuando la partida termina o el jugador se rinde. |
| game:state:{gameId} | JSON (Tablero) | Cuando la partida termina. |

---

## **3\. Flujo de Inicio (Al cargar la web)**

El Frontend **siempre** empieza de cero. No le importa si tenía sesión antes o no.

1. **Petición de Refresh (HTTP):** Nada más cargar la aplicación, el Frontend hace un POST /auth/refresh.  
2. **Validación en Backend:**  
   * El Backend mira la cookie del usuario.  
   * Consulta en Redis: GET user:session:{userId}.  
3. **La Respuesta del Token:** El Backend devuelve un JWT que contiene:  
   * userId: Quién es el jugador.  
   * activeGameId: El ID de la partida si existe en Redis, o null si no tiene ninguna.  
   * También puede devolver error si no está en ninguna partida.

---

## **4\. Lógica de Navegación (Decisión en el Frontend)**

Una vez el Frontend recibe el nuevo token, toma una decisión basada en el activeGameId:

### **Escenario A: activeGameId es NULL (No hay partida)**

* El Frontend **NO** se conecta al socket todavía.  
* Hace la operativa normal

### **Escenario B: activeGameId tiene un ID (Partida en curso)**

* El Frontend se conecta al **Socket** enviando el token.  
* El servidor, al ver el gameId en el token, mete al usuario automáticamente en la sala (socket.join(gameId)).  
* El servidor emite el evento session\_recovered con el estado del tablero.  
* El Frontend salta directamente a la pantalla de juego.

---

## **5\. Reglas de Negocio (Para que no explote nada)**

* **¿La partida ha terminado?** El Backend debe borrar user:session:{userId} de Redis. Así, cuando el usuario haga refresh, el token vendrá con activeGameId: null y volverá al menú.  
* **¿Se ha desconectado por error?** El socket se cierra, pero la clave en Redis sigue ahí. Al reconectar, el flujo lo devuelve a su sitio.  
* **¿Intento entrar a otro lobby teniendo partida?** El Backend rechazará cualquier join\_game si ve que el usuario ya tiene un gameId activo en Redis diferente al que intenta entrar.

---

## **6\. Ejemplo de Implementación Simplificada**

### **Respuesta del Backend (/auth/refresh)**

JSON

```
{
  "accessToken": "ey...", 
  "activeGameId": "partida_123" // O null si no está jugando
}
```

### **Lógica del Servidor de Socket**

TypeScript

```
io.on("connection", async (socket) => {
  const { userId, activeGameId } = socket.data; // Datos sacados del token

  if (activeGameId) {
    // 1. Meter al usuario en su habitación
    socket.join(activeGameId);

    // 2. Sacar el tablero de Redis
    const gameData = await redis.get(`game:state:${activeGameId}`);

    // 3. Enviarle la partida al usuario
    socket.emit("session_recovered", { 
        gameId: activeGameId, 
        state: JSON.parse(gameData) 
    });
  }
  // Si no hay activeGameId, el socket se queda conectado a la espera de que el 
  // usuario cree una partida o se una a una mediante eventos.
});
```

---

## **7\. Estrategia de Frontend y Navegación**

### **A. El Socket es Global (App-Level)**

Para que el usuario se entere de lo que pasa en su partida mientras navega por la web, el socket debe inicializarse en el componente raíz (ej. App.tsx o Layout.tsx).

* **¿Por qué?** Si el usuario está en /shop y el oponente se rinde, el servidor enviará un evento game\_ended. El Frontend recibirá ese evento, borrará el activeGameId de su estado y **el banner de "Partida en curso" desaparecerá mágicamente** ante sus ojos.

### **B. El Banner de "Partida Activa"**

En el componente de navegación (Navbar) o en el Layout principal, añadimos una lógica condicional:

* **Lógica:** if (activeGameId && currentPath \!== '/game') \-\> Mostrar Banner.  
* **Acción del Banner:** Un botón que diga "Volver a la partida" que simplemente hace un router.push('/game').

---

### **C. Bloqueo de Rutas (Guards/Middleware)**

Debemos proteger la lista de lobbies para que el usuario no se "líe" intentando entrar a dos sitios a la vez.

1. **Middleware de Lobbies:** Si el usuario intenta entrar en /lobbies pero tiene un activeGameId, el sistema lo redirige automáticamente a /game.  
2. **Estado Visual:** Si está en una partida, el enlace de "Lobbies" en el menú debería estar deshabilitado (gris) o ni siquiera aparecer.

---

### **D. Flujo de Eventos en Segundo Plano (Estando en la Tienda)**

¿Qué pasa si ocurre algo en la partida mientras el usuario no está mirando el tablero?

| Evento del Socket | Acción en el Frontend (Fuera de /game) |
| :---- | :---- |
| your\_turn | Mostrar una pequeña notificación (Toast) que diga: "¡Es tu turno\!". |
| game\_ended | 1\. Limpiar activeGameId del estado local. 2\. Quitar el banner de "Partida en curso". 3\. Habilitar de nuevo el acceso a /lobbies. |
| opponent\_disconnected | Actualizar el banner para que diga: "Oponente desconectado. Esperando...". |

---

## **8\. Resumen de Lógica para el Frontend (Pseudo-código)**

Para que tus compañeros sepan qué programar en el componente principal:

TypeScript

```
// En App.tsx o un Hook Global
const { token, activeGameId, setActiveGameId } = useAuth();
const socket = useSocket(token); // Se conecta una sola vez

useEffect(() => {
  if (!socket) return;

  // Si la partida termina mientras estoy en la tienda
  socket.on("game_ended", (data) => {
    setActiveGameId(null); // Borramos el ID del juego
    alert("La partida ha terminado. Ganador: " + data.winner);
  });

  // Si recuperamos sesión al conectar
  socket.on("session_recovered", (data) => {
    setActiveGameId(data.gameId);
    // Si queremos, podemos forzar el salto al juego:
    // router.push('/game'); 
  });

}, [socket]);

// En el HTML/Render
return (
  <>
    {activeGameId && currentPath !== '/game' && (
      <div className="banner-reconnection">
        ¡Tienes una partida activa! 
        <button onClick={() => router.push('/game')}>Volver</button>
      </div>
    )}
    <Routing />
  </>
)
```

---

### **Resumen de tareas para el equipo:**

* **Backend:** Modificar el /auth/refresh para que busque en Redis y añada el activeGameId al payload del JWT.  
* **Frontend:** Al recibir el token, leer el activeGameId. Si existe, conectar socket y redirigir a /game. Si no, cargar /lobbies por HTTP.  
* **Ambos:** Asegurarse de que cuando la partida se acabe, se limpie Redis.

Con esto, el sistema es "a prueba de balas" y muy sencillo de debugear. Si el usuario se pierde, solo tiene que darle a **F5** y el token lo pondrá en su sitio.