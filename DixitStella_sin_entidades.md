# Especificación Técnica y Arquitectura de Diseño: Adaptación Web de Stella Dixit Universe en Angular

## Introducción y Fundamentos Estructurales del Sistema

La adaptación digital de experiencias lúdicas de tablero requiere una amalgama precisa entre la fidelidad mecánica y la arquitectura de software contemporánea. El presente documento constituye una especificación de requisitos y un diseño arquitectónico exhaustivo para la implementación web del juego "Stella: Dixit Universe", utilizando el framework Angular.<sup>1</sup> Diseñado originalmente por Gérald Cattiaux y Jean-Louis Roubira con ilustraciones de Jérôme Pélissier, Stella se aparta de la mecánica tradicional de narración asimétrica de Dixit para ofrecer una experiencia centrada en la interpretación simultánea de imágenes, la gestión de riesgos (push-your-luck) y la consonancia cognitiva.<sup>1</sup>

El ecosistema de Angular, caracterizado por su enfoque basado en componentes, su sistema de reactividad a través de RxJS y su inyección de dependencias, proporciona la infraestructura ideal para modelar el complejo motor de estados finitos que gobierna las interacciones multijugador de Stella. A diferencia de las iteraciones asíncronas estándar, el flujo de Stella exige una sincronización bidireccional en tiempo real, validaciones estrictas en la etapa de formulación de decisiones ocultas y una retroalimentación visual inmediata que emule la tensión inherente a la resolución física en la mesa de juego.<sup>3</sup>

Este informe detalla meticulosamente la transcripción algorítmica de cada elemento físico, la topología de la interfaz gráfica, el modelo de datos subyacente y la secuenciación estricta del flujo de partida, proporcionando a los ingenieros de software, diseñadores de UI/UX y arquitectos de sistemas un mapa de ruta unívoco para el desarrollo del producto.

**Directriz de integración**: esta adaptación debe construirse sobre la implementación ya existente de Dixit clásico. La guía no impone nombres de entidades, clases, interfaces o componentes. Siempre que exista una estructura equivalente en el proyecto base, deberá reutilizarse y ampliarse en lugar de duplicarse.

## Reutilización del Dominio Existente y Extensión del Estado de Partida

Dado que la base de Dixit clásico ya existe, Stella no debe plantearse como una redefinición completa del dominio, sino como una ampliación del estado de partida y de las reglas de resolución. La implementación debe reutilizar, siempre que sea viable, los modelos, servicios, stores y componentes ya presentes en el proyecto base. El modelado adicional solo debe introducir los datos estrictamente necesarios para soportar la selección oculta, el conteo de intensidad, el estado de oscuridad, el estado de caída, el orden del explorador y la resolución secuencial de coincidencias. El objetivo es prevenir transiciones de estado ilegales y optimizar la transmisión de datos a través de los protocolos de WebSockets sin duplicar estructuras ya resueltas en Dixit clásico.

### Reutilización del modelo de cartas de imagen

El juego base incluye un mazo de 84 cartas de tamaño sobredimensionado, caracterizadas por su arte abstracto y surrealista, las cuales son universalmente compatibles con todas las expansiones de la franquicia Dixit.<sup>1</sup> La implementación debe reutilizar el modelo de carta de imagen ya existente en el proyecto base. Dado que las ilustraciones contienen matices minúsculos que los jugadores deben escudriñar para establecer asociaciones conceptuales, el sistema debe contemplar la entrega de imágenes de alta resolución mediante redes de distribución de contenido (CDN), aplicando técnicas de carga diferida (lazy loading) en Angular para no saturar el hilo principal del navegador. Sobre el modelo existente bastará con soportar, cuando sea necesario, información relacionada con selección local transitoria y resolución durante las fases activas, evitando redefinir una jerarquía paralela de cartas.

### Gestión de las cartas de palabra

El sistema de generación de pistas se fundamenta en un mazo de 110 Cartas de Palabra, las cuales se subdividen tipológicamente en 96 cartas de dos palabras, 4 cartas de descubrimiento y 10 cartas personalizables.<sup>2</sup> Durante la orquestación inicial de la partida, el algoritmo de configuración extraerá aleatoriamente cuatro instancias de este repositorio para construir el esquema narrativo de las cuatro rondas reglamentarias.<sup>4</sup> La separación conceptual entre las cartas de dos palabras obliga a la aplicación a implementar un mecanismo de selección pseudoaleatoria que extraiga un único término de la carta para establecerlo como palabra activa de la ronda dentro del estado global. Esta capacidad debe añadirse sin imponer un nuevo nombre de entidad si el proyecto ya dispone de un modelo válido para representar cartas, términos o recursos de ronda.

### Infraestructura espacial: tablero central y selección oculta por jugador

El espacio físico del juego se articula alrededor de dos componentes principales: un tablero central ensamblable y pizarras individuales borrables para cada participante. El tablero central aloja la carta de palabra activa, el registro numérico de puntuación y una pista (track) lineal numerada del 1 al 10, cuyo propósito es registrar la magnitud de las selecciones de cada jugador.<sup>4</sup> Las pizarras personales, denominadas _slates_, exhiben una matriz geométrica de 5 columnas por 3 filas, replicando con exactitud la disposición topológica de las 15 cartas Dixit desplegadas en el centro de la mesa.<sup>4</sup> En la adaptación web, esta duplicidad física entre la mesa y la pizarra personal puede resolverse aprovechando el estado ya existente del proyecto. En términos prácticos, basta con mantener, para cada jugador, una referencia a las cartas centrales seleccionadas durante la ronda y un acumulado de estrellas para la puntuación temporal o total, sin imponer un nuevo nombre de estructura si ya existe una representación equivalente en la implementación de Dixit clásico.

### Estados de orquestación y riesgo

Las mecánicas de control de flujo y la gestión del riesgo se operativizan mediante artefactos físicos específicos que el sistema digital debe emular con precisión:

- **Estado de linterna**: Cada jugador posee una ficha bifaz. La cara de "Luz" (Light) ilustra dos estrellas doradas, mientras que la cara de "Oscuridad" (Dark) ilustra una única estrella grisácea.<sup>5</sup> Este dato es crítico, pues determina una severa penalización matemática en la fase de evaluación final si el jugador incurre en una desincronización cognitiva.<sup>5</sup>
- **Estado de ronda**: El ciclo de vida de la partida consta estrictamente de 4 rondas.<sup>6</sup> Las fichas de ronda actúan como contadores temporales y además dictaminan un algoritmo de mantenimiento: la sustitución topológica de una fila completa de cartas (línea I, II o III) al término del ciclo.<sup>4</sup>
- **Orden del primer explorador**: Existe un indicador de privilegio de turno que se desplaza secuencialmente en el arreglo de jugadores, garantizando equidad en la prioridad de selección durante las fases de revelación.<sup>2</sup>

A efectos de implementación, estas capacidades deben incorporarse al estado de partida reutilizando las estructuras ya existentes del proyecto. Los nombres usados en esta guía describen responsabilidades funcionales y no implican la creación de nuevas clases, interfaces o archivos si el sistema actual ya dispone de equivalentes válidos.

## Topología de la Interfaz de Usuario y Composición de Componentes (UI/UX)

La disposición espacial de los elementos gráficos en Stella no es arbitraria; obedece a la necesidad de minimizar la carga cognitiva, maximizar la apreciación artística de las ilustraciones y proyectar claramente la interrelación del estado multijugador.<sup>8</sup> En Angular, la vista global de la mesa de juego (vista principal de la sala de juego) debe fragmentarse mediante patrones de arquitectura CSS Grid Layout y Flexbox, aislando las responsabilidades renderizadas en un árbol de componentes modulares.

### El Lienzo Principal: La Cuadrícula de Asociación (The Main Board)

El epicentro visual del aplicativo reside en el componente principal del tablero, responsable de renderizar el arreglo bidimensional de cartas Dixit.<sup>3</sup> Las reglas establecen de forma categórica que la mesa de juego despliega un arreglo rectilíneo compuesto por 3 líneas (filas horizontales) que contienen 5 cartas cada una, sumando un total constante de 15 ilustraciones activas por ronda.<sup>4</sup> En el plano del desarrollo web, este requerimiento se satisface instanciando un contenedor principal bajo la directiva CSS display: grid; grid-template-columns: repeat(5, 1fr); grid-template-rows: repeat(3, 1fr);.

Cada nodo dentro de esta matriz instancia un componente hijo, el componente visual de carta. Este componente debe ser dinámico e hiper-reactivo. Durante la experiencia física, la escasa iluminación ambiental y la aglomeración de jugadores pueden dificultar la visualización de los detalles microscópicos en el arte de Pélissier, llevando a los jugadores a prácticas antiergonómicas como fotografiar la mesa con sus dispositivos móviles.<sup>8</sup> La adaptación web soluciona este problema ontológico del tablero físico mediante implementaciones nativas: al superponer el puntero (hover) o al ejecutar una pulsación sostenida (long press en interfaces táctiles), la carta debe escalar espacialmente (transform: scale(1.05)) o invocar una ventana modal a pantalla completa para el escrutinio detallado. Esta maniobra de visualización debe ejecutarse de forma estrictamente local en el navegador del cliente; el sistema de WebSockets bajo ninguna circunstancia debe retransmitir qué carta está examinando un jugador, preservando la opacidad informativa hasta el momento de la confirmación formal.<sup>4</sup>

### El Eje Informativo: Panel de Navegación y Clave Conceptual

La zona superior de la interfaz, el franja superior de información, concentra los metadatos globales que rigen el estado absoluto de la mesa. En el centro geométrico absoluto de esta franja, se instanciará visualmente la Carta de Palabra de la ronda actual. Las normativas físicas exigen que esta carta se deslice bajo el tablero para que únicamente la palabra clave permanezca visible.<sup>4</sup> Traducido a la semiótica web, esto significa que la palabra clave (palabra activa de la ronda) debe gobernar la jerarquía tipográfica de la pantalla (ej. mediante una etiqueta &lt;h1&gt; con un contraste cromático excepcional), operando como un faro cognitivo constante para los usuarios que analizan la cuadrícula. A los flancos de este indicador central, se ubicarán los temporizadores globales (si la sala establece límites configurables) y el indicador fraccionario del ciclo de vida temporal (Ronda 1/4).<sup>6</sup>

### Panel Lateral de Metadatos: El Registro de Jugadores (Sidebar Roster)

En el segmento lateral, típicamente a la izquierda en monitores panorámicos, residirá el panel lateral de jugadores. Esta zona renderiza de forma vertical el estado público de todos los adversarios conectados. A diferencia de las pizarras individuales <sup>10</sup> cuya información interior permanece cifrada, este componente proyecta la información sistémica que todos deben conocer:

- **Puntuación Acumulada**: La suma matemática progresiva del rendimiento histórico del jugador.
- **Identidad del Primer Explorador**: El participante que detente la variable identificador del primer explorador ostentará un ícono heráldico destacado (por ejemplo, el peón característico del juego) para denotar quién posee el control inicial del flujo de revelación.<sup>4</sup>
- **Estado de Linterna (El Liderato y la Oscuridad)**: Un indicador binario vital que muestra si la linterna del jugador irradia luz (condición segura) o ha sido transmutada a la cara oscura (condición de riesgo de penalización extrema).<sup>4</sup>
- **Estado de Participación (Caída)**: Si un jugador sufre una "Caída" (The Fall) por un error de consonancia cognitiva, su avatar u objeto representativo debe experimentar una alteración visual profunda (aplicación de escala de grises, reducción de opacidad o la superposición de un ícono de caída libre), telegrafiando a los rivales que este usuario ha perdido su capacidad de actuar como explorador en la ronda vigente.<sup>4</sup>

### Consola Interactiva Inferior: HUD de Control y Validación

En la arquitectura propuesta, los jugadores no interactúan con una pizarra separada de la mesa <sup>5</sup>, sino que interactúan nativamente sobre las propias cartas de la cuadrícula mediante eventos de clic. Sin embargo, el estado de esta iteración debe compilarse en la barra inferior o barra inferior de control. Este bloque contiene el termómetro numérico que refleja cuántas variables se han acoplado a la matriz interna del jugador (selección actual.length). Las directivas de validación de Angular se vinculan aquí: el juego proscribe estrictamente enviar una selección nula (0) o exceder el umbral psicológico máximo (10).<sup>4</sup> Por tanto, el botón de acción asíncrona "Confirmar Selección" (Submit Selection) debe permanecer con el atributo \[disabled\]="true" en el DOM hasta que el evaluador interno confirme que la longitud de la matriz se encuentra en el rango inclusivo de 1 a 10. Al pulsar este botón emulando la regla física de "pasar el rotulador al vecino de la izquierda para indicar el término de la selección" <sup>4</sup>, la interfaz transmuta hacia un estado pasivo de carga, bloqueando cualquier modificación ulterior en el registro individual de ese ciclo.

## Infraestructura de Datos: Sincronización de Estados y Arquitectura de Eventos

La viabilidad operativa de Stella en Angular depende intrínsecamente del patrón arquitectónico empleado para sincronizar mutaciones de estado entre clientes dispersos geográficamente. El marco idóneo requiere la implementación de **NgRx** (patrón Redux adaptado a Angular) en conjunción con pasarelas de comunicación bidireccional continua (WebSockets a través de bibliotecas como Socket.io, SignalR o un canal equivalente).

Dado que Stella es altamente asimétrico en la distribución de la información (las selecciones son ultra secretas hasta que el protocolo exige su develación progresiva <sup>4</sup>), la arquitectura asume un diseño autoritativo del servidor. El cliente Angular opera bajo el paradigma de "UI Optimista" para interacciones locales (como resaltar una carta en azul temporalmente), pero carece del conocimiento del estado ajeno hasta que el servidor despacha cargas útiles cifradas (Payloads) a todos los puertos de suscripción.

El Store centralizado de Angular (estado global de la partida) debe estructurarse mediante particiones lógicas estrictas:

- segmento del tablero: Matriz central, cartas activas, índices de reemplazo.<sup>4</sup>
- segmento de jugadores: Entidades del jugador, identidades, puntuaciones acumuladas, estado binario de la linterna y estado transaccional de "caída".<sup>5</sup>
- segmento de ronda: Palabra activa, paso actual de la ronda, apuntador del explorador en curso.<sup>4</sup>

Cuando un evento requiere cálculos matriciales (como verificar si la carta seleccionada por el jugador coincide con las de sus oponentes), la lógica algorítmica no reside en el navegador del cliente; se procesa en el servidor, el cual despacha una acción de tipo \[Game Event\] Resolve Spark, a la cual se suscriben los reductors de todos los clientes Angular para sincronizar los marcadores matemáticos y detonar los selectores de animación reactivos.

## Flujo Secuencial Exhaustivo de la Partida y sus Regulaciones Procedimentales

La morfología del diseño de "Stella: Dixit Universe" se descompone en un ciclo exterior repetitivo (las cuatro rondas reglamentarias <sup>6</sup>) y un ciclo interior riguroso compuesto por fases estrictas e inalterables. A continuación, se detalla la implementación lógica y el mapeo de reglas punto por punto.

### Fase 0: Inicialización del Entorno y Orquestación de Variables

El preludio sistémico requiere preparar las colecciones de datos. El servidor instancia y mezcla (shuffles) el mazo completo de 84 cartas Dixit.<sup>4</sup> Automáticamente, se extraen los primeros 15 elementos para inyectarlos en la propiedad tridimensional de la cuadrícula (board\[0..2\]\[0..4\]).<sup>4</sup> Paralelamente, se instancian cuatro Cartas de Palabra al azar procedentes de la base de datos y se apartan en una cola secuencial oculta al usuario.<sup>4</sup> Se sortea algorítmicamente el privilegio de la primacía de turno asignando el Peón de Primer Explorador a un jugador aleatorio.<sup>4</sup> Finalmente, todas las instancias de los jugadores inicializan su propiedad de control de riesgo (estado de linterna) forzándola al valor por defecto: 'LIGHT'.<sup>4</sup>

### Fase 1: Asociación Cognitiva, Percepción y Registro (Association Step)

Al comenzar la ronda, el servidor extrae la primera Carta de Palabra de la cola y despacha el evento que actualiza el palabra activa de la ronda visible en la cabecera. Se transiciona al estado PHASE_ASSOCIATION.

Este es el núcleo analítico de la experiencia.<sup>4</sup> Basándose en la interpretación semántica y artística, cada jugador inspecciona la cuadrícula de forma autónoma, buscando conexiones lógicas, abstractas o emocionales entre la palabra en la pantalla y las 15 imágenes disponibles.<sup>3</sup> En su panel virtual interactivo, el jugador activa su selección mediante clics. Las reglas imponen fronteras matemáticas ineludibles a esta actividad:

- **Límite Inferior Inquebrantable**: Todo jugador está obligado a seleccionar un mínimo aritmético de 1 carta.<sup>4</sup> Un array de selección vacío (length === 0) genera un rechazo inmediato por parte de los validadores de formularios de Angular, bloqueando el progreso.
- **Límite Superior Categórico**: El sistema no admite la selección indiscriminada. El máximo tope algorítmico permitido son 10 cartas.<sup>4</sup> Si un usuario intenta hacer clic en una undécima imagen, la interfaz debe ejecutar una retroalimentación háptica y visual (shake animation, color rojo de alerta), ignorando la instrucción.

Una vez satisfecho con su estructura de asociación, el usuario invoca el comando de confirmación. Como estipula explícitamente el reglamento: "una vez que todos los jugadores han pasado su rotulador, la selección ha finalizado y ya no puedes cambiarla".<sup>4</sup> A nivel de software, esta declaración de inmutabilidad desactiva completamente todos los _Event Listeners_ atados a la cuadrícula, y el cliente despacha su matriz bidimensional oculta al servidor centralizado. El flujo se detiene en un estado de retención asíncrona ("spinner" o pantalla de espera animada) hasta que el 100% de los nodos reportan su matriz de configuración.<sup>4</sup>

### Fase 2: El Anuncio de Intensidad y la Evaluación Algorítmica del Liderato

Esta fase orquesta el componente sociológico de la teoría de juegos presente en Stella, infundiendo lo que se denomina "presión extra" o la mecánica del "caucho estabilizador" (rubber banding) que castiga estadísticamente la voracidad.<sup>6</sup> En la transición a la etapa PHASE_ANNOUNCE, el servidor instruye a los clientes a proyectar el metadato de longitud, sin revelar bajo ninguna circunstancia los IDs de las cartas ocultas. Cada jugador observa cómo los identificadores de sus adversarios se posicionan dinámicamente sobre la pista numerada del 1 al 10 en la interfaz gráfica, correspondiendo exactamente al tamaño del arreglo emitido en la fase anterior.<sup>4</sup>

Una vez la animación de posicionamiento ha culminado, el servidor ejecuta la **Subrutina de la Oscuridad**:

- **Extracción de Máximos**: El sistema escanea la matriz de longitudes en búsqueda del valor algebraico más alto.
- **Determinación de Colisiones (Ties)**: Se evalúa cuántas entidades comparten el valor máximo extraído.
  - **Escenario de Unicidad**: Si un jugador está matemáticamente aislado en la cima de la distribución (es decir, marcó _más_ casillas que absolutamente cualquier otro competidor singular), se cumple la condición reglamentaria de hallarse "Solo en el Liderato" (Alone in the lead).<sup>4</sup> Consecuentemente, el servidor emite una directriz de alteración de estado: el estado de linterna de ese único jugador muta inmediatamente al estado 'DARK'. En Angular, esta mutación del store dispara una intrincada animación tridimensional mediante animaciones del cliente, donde la representación dorada de su linterna rota sobre su eje Y (transform: rotateY(180deg)) descubriendo una siniestra ilustración de una sola estrella apagada, alertando a todo el ecosistema de la inminente vulnerabilidad estadística de este jugador.<sup>4</sup>
  - **Escenario de Colisión**: Si dos o más jugadores operan coincidentemente en el mismo umbral numérico máximo, la colisión los absuelve de la penalización. Como dicta taxativamente la ley del juego: "En ese caso, nadie está en la Oscuridad".<sup>4</sup> El servidor desestima el cambio de estado y todas las variables estado de linterna persisten en 'LIGHT' para todo el contingente.<sup>4</sup> (Se advierte a los desarrolladores de Angular ignorar activamente cualquier modificación comunitaria no oficial, como la regla casera que sugiere penalizar a todos los infractores en empate <sup>11</sup>, ya que contradice la especificación formal del producto).

Esta evaluación infunde una palpable tensión psicológica en la sala de juego, ya que el infractor marcado por la oscuridad enfrentará contingencias dramáticas si fracasa durante la inminente etapa de revelación heurística.<sup>3</sup>

### Fase 3: La Arquitectura de Revelación Iterativa, Chispas y el Algoritmo de Caída

El bucle transaccional del juego recae fundamentalmente en esta fase, caracterizada por iteraciones progresivas donde se valida la consonancia empírica de las asociaciones de pensamiento.<sup>3</sup> El estado migra a PHASE_REVEAL.

- **Identificación del Vector Activo**: El servidor consulta el índice identificador del primer explorador para identificar al sujeto emisor del ciclo. Este jugador adquiere el estado provisional de explorador activo (Explorador).<sup>4</sup>
- **La Selección Observable**: La interfaz desbloquea exclusivamente para este usuario aquellas casillas de la matriz 3x5 que él marcó originalmente y que persisten sin revelar. El explorador selecciona una.<sup>3</sup>
- **Procesamiento y Matrices de Coincidencia**: Al despacharse la coordenada de la carta hacia el servidor, este interroga transversalmente los repositorios invisibles de todos los demás competidores presentes. La regla procesa tres desenlaces condicionales mutuamente excluyentes <sup>4</sup>:
  - **Desencadenante Alfa - La Súper Chispa (The Super-Spark)**:
    - _Condición Algorítmica_: La función de intersección de arreglos devuelve una coincidencia estricta y absoluta con **exactamente 1** adversario adicional.<sup>4</sup>
    - _Efecto de Mutación_: Ambos actores (el Explorador y su único conector cognitivo) insertan un valor de 3 entidades en su contador (estrellas acumuladas += 3). La regla estipula la provisión geométrica de "2 estrellas y 1 estrella de bonificación".<sup>4</sup>
    - _Representación UI_: El motor de Angular debe desatar efectos de partículas vectoriales que tracen una parábola radiante entre los dos avatares involucrados, resaltando la extrema sincronización entre ambos.<sup>3</sup>
  - **Desencadenante Beta - La Chispa Estándar (The Spark)**:
    - _Condición Algorítmica_: La matriz de intersección reporta un quórum de **2 o más** adversarios adicionales.<sup>4</sup>
    - _Efecto de Mutación_: El explorador activo y toda la pluralidad de involucrados incrementan su registro en exactamente 2 entidades (estrellas acumuladas += 2).<sup>4</sup>
    - _Representación UI_: Expansión concéntrica de iluminación afectando de forma homogénea a todos los beneficiarios de la consonancia colectiva.
  - **Desencadenante Omega - La Caída Estructural (The Fall)**:
    - _Condición Algorítmica_: La interrogación transversal devuelve un conjunto vacío (null set). El explorador es el único ser consciente que asoció el concepto con la imagen.<sup>4</sup>
    - _Efecto de Mutación Inmediato_: El explorador percibe 0 estrellas. Inmediatamente, la variable interna del jugador sufre un cambio paramétrico de control: estado de caída = true.<sup>4</sup>
    - _Ramificaciones Sistémicas de la Caída_:
      - **Bloqueo Activo**: El jugador es revocado perpetuamente de sus credenciales para operar como "Explorador" en lo que resta del bucle de la fase 3.<sup>4</sup> No puede instigar más validaciones.
      - **Castración de Puntuación (Crucial para Angular)**: Una directiva vital del diseño estipula que este jugador caído **"no puede rellenar más estrellas"** bajo ninguna circunstancia futura de la iteración presente.<sup>4</sup> Sin embargo, si en turnos subsiguientes un explorador rival señala una ilustración que yace secreta en la matriz del jugador caído, el sistema Angular debe, inexorablemente, contabilizar la coincidencia para beneficio del rival (permitiendo generar chispas), pero el incremento matemático del infractor caído será anulado u omitido (if(player.estado de caída) { grantPoints = 0 }).<sup>6</sup>
      - _Representación UI_: Oscurecimiento dramático del avatar de la entidad caída, complementado con tipografía tachada sobre sus cartas restantes.<sup>6</sup>
- **Transferencia del Flujo de Control**: Si el jugador superó el evento Beta o Alfa, el testigo de explorador se transfiere secuencialmente al vecino inmediato a su izquierda (en la lista circular de Angular).<sup>4</sup> El algoritmo omite sistemáticamente a cualquier jugador cuyo marcador dicte estado de caída === true.<sup>4</sup>
- **Extinción del Bucle Iterativo**: Este motor de ciclo gira vertiginosamente hasta que se satisface una de dos condiciones de escape absolutas:
  - Toda la matriz poblacional ostenta el indicador estado de caída === true (caída universal).<sup>4</sup>
  - Aquellos sobrevivientes inmunes a la caída han agotado geométricamente todas sus "cruces" o cartas asociadas remanentes, dejando sus matrices de verificación vacías.<sup>4</sup> Al cumplirse el postulado, el servidor ordena la clausura definitiva de la fase y se avanza al procesamiento del balance temporal.

### Fase 4: Consolidación Algorítmica de Puntos, Penalizaciones y Limpieza de Estado

Al precipitarse la fase de evaluación PHASE_SCORING, la aplicación Angular ejecuta el compilador matemático final para materializar los puntajes.<sup>6</sup>

- **Tabulación Primaria**: Todos los vectores de incremento temporal (chispas acumuladas) se agregan a las puntuaciones vitalicias (puntuación total) de la entidad.<sup>7</sup>
- **Evaluación Punitiva (El Castigo de la Oscuridad)**: El sistema aplica el modificador de riesgo más brutal del ecosistema del universo Stella. El servidor filtra al único jugador cuyo estado es estado de linterna === 'DARK'.<sup>6</sup>
  - La sentencia dicta que si este jugador asilado en la oscuridad **además cometió una Caída empírica** (estado de caída === true) durante la fase previa, debe sufrir una exacción masiva: se le deducirá restroactivamente **una estrella completa por cada asociación que logró acoplar con éxito** a lo largo del turno.<sup>6</sup> Funcionalmente, esto divide y aniquila prácticamente a la mitad la efectividad de todas sus victorias anteriores.<sup>6</sup>
  - Por el contrario, el algoritmo debe contener un condicional excluyente de salvaguarda: si el jugador sombrío sorteó las probabilidades y cruzó la meta sin sucumbir a la "Caída" (estado de caída === false), el servidor ignora la exacción y aprueba la concesión total de los puntos recabados, premiando su audacia arquitectónica.<sup>2</sup>
- **Mantenimiento Rutinario y Reseteo (Cleanup)**:
  - Se despachan mutaciones destructivas al estado: Se formatean las matrices privadas (selección actual.clear()), se reconfiguran las variables vitales (estado de caída = false) y los parámetros paramétricos de riesgo retroceden a su formato inactivo (estado de linterna = 'LIGHT').<sup>4</sup>
  - Se extrae e implementa la topología de sustitución cartográfica del tablero. Al consultar la ficha de ronda en vigor (denominada I, II o III), el sistema Angular identifica una línea horizontal completa de la cuadrícula tridimensional (5 índices continuos).<sup>4</sup> Estos nodos son destruidos del DOM (mecanismos normales de limpieza de la vista), enviados al olvido algorítmico, y cinco nuevas ilustraciones del mazo virtual se insertan para reemplazar el vacío, propiciando animaciones de inyección de componentes (slide-in animations).<sup>4</sup>
- **Transición de Macro-Estado**: El término lexicográfico vigente es depurado.<sup>2</sup> El peón de control cardinal avanza iterativamente, transfiriendo el identificador del primer explorador a un nuevo huésped hacia la izquierda lógica.<sup>2</sup> La variable iteradora ronda actual asciende en una unidad entera, y el bucle masivo vuelve a la Fase 1.

## Conclusión Sistémica y Condiciones de Terminación

El flujo circular previamente desglosado se repite rigurosamente durante exactamente cuatro instancias enteras (4 rondas).<sup>7</sup> Al culminar los protocolos de mantenimiento de la iteración final, el bucle principal implosiona y se invoca la rutina de terminación de estado.

El árbitro del servidor compara los valores longitudinales de la variable puntuación total de todos los participantes conectados.<sup>7</sup> La entidad superior se alza con la victoria paramétrica. En la excepcional circunstancia matemática de hallar colisiones paritarias en el umbral máximo, las normativas universales de Stella dictan inequívocamente que los contendientes "comparten la victoria", por lo que Angular deberá renderizar una pantalla modal de victoria equitativa (pantalla final de victoria) que celebre paralelamente a la multiplicidad de ganadores.<sup>9</sup>

Acatar estricta e inexorablemente estas directrices procedimentales, las ecuaciones algebraicas restrictivas de la mecánica de "Oscuridad y Caída" y la arquitectura técnica subyacente garantizará que la adaptación digital no sea un mero simulacro superficial, sino una reconstrucción perfecta, robusta y escalable del ecosistema Dixit dentro de los navegadores web modernos.

#### Obras citadas

- Stella - Dixit Universe - Libellud, fecha de acceso: abril 2, 2026, <https://www.libellud.com/en/our-games/stella-dixit-universe/>
- Dixit (board game) - Wikipedia, fecha de acceso: abril 2, 2026, [https://en.wikipedia.org/wiki/Dixit\_(board_game)](https://en.wikipedia.org/wiki/Dixit_%28board_game%29)
- Review - Stella: Dixit Universe - Geeks Under Grace, fecha de acceso: abril 2, 2026, <https://www.geeksundergrace.com/tabletop/review-stella-dixit-universe/>
- Stella: Dixit Universe Rulebook - 1jour-1jeu.com, fecha de acceso: abril 2, 2026, <https://cdn.1j1ju.com/medias/c0/22/bd-stella-dixit-universe-rulebook.pdf>
- Stella - Dixit Universe - First Play! - 3 Spellcasters and a Dwarf, fecha de acceso: abril 2, 2026, <https://www.3spellcastersandadwarf.com/gaming-blog/stella-dixit-universe-first-play>
- Stella Game Review - The Tabletop Family, fecha de acceso: abril 2, 2026, <https://thetabletopfamily.com/stella-game-review/>
- Stella: Dixit Universe Game Review - Meeple Mountain, fecha de acceso: abril 2, 2026, <https://www.meeplemountain.com/reviews/stella-dixit-universe/>
- Dale Yu: Review of Stella (Dixit Universe) | The Opinionated Gamers, fecha de acceso: abril 2, 2026, <https://opinionatedgamers.com/2022/02/01/dale-yu-review-of-stella-dixit-universe/>
- Stella - Dixit Universe - How To Play - YouTube, fecha de acceso: abril 2, 2026, <https://www.youtube.com/watch?v=H3AVZXEyZGE>
- Stella Dixit Universe - Showing all Cards! | Inside #584 - YouTube, fecha de acceso: abril 2, 2026, <https://www.youtube.com/watch?v=67R9XXdFf0Q>
- What's a boardgame house rule that improves the game experience? - Reddit, fecha de acceso: abril 2, 2026, <https://www.reddit.com/r/boardgames/comments/1ozsxlm/whats_a_boardgame_house_rule_that_improves_the/>