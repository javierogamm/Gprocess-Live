# Historial de cambios

## v1.1.55
- Actualizada la exportación de flujo a CSV para que la columna **Texto plantilla** use el contenido real configurado en cada nodo formulario y mantenga el valor por defecto únicamente cuando no exista plantilla.
- Corregido el serializado CSV de tareas y condiciones para escapar correctamente celdas con saltos de línea, comillas o separadores, preservando el formato multilínea de las plantillas en la exportación.
- Consolidación de versión de la app en `1.1.55`.

## v1.1.54
- Ajustado el icono 📝 de plantilla en el canvas para que solo se muestre cuando el nodo de tipo **Formulario** o **Documento** está seleccionado individualmente.
- Ampliado el modal de plantilla (`templateNodeModal`) para trabajar con mayor ancho/alto visible y facilitar la edición de textos largos.
- Consolidación de ajustes de usabilidad del editor de plantillas con versionado de la APP.

## v1.1.53
- Añadido un icono flotante 📝 en nodos de tipo **Formulario** y **Documento**, posicionado a la derecha y por encima del contenido del nodo para abrir la edición de plantilla en un modal.
- Incorporado un modal de plantilla con edición de texto libre y guardado en el propio nodo (`plantillaTexto`) para conservar el contenido al exportar/importar el flujo.
- Replicado el acceso al editor de plantilla en el panel lateral derecho, junto al desplegable **Tipo de nodo**, visible solo para tipos **Formulario** y **Documento**.
- Consolidación de la nueva funcionalidad de plantillas con versionado de la APP.

## v1.1.52
- Añadido soporte de actualización de `ultimo_acceso_process` para sesiones restauradas desde almacenamiento del navegador (cookie/cache/localStorage), sin requerir nuevo login manual.
- Extendido el endpoint `api/users` con método `PATCH` para registrar el último acceso a partir del `id` de usuario ya autenticado.
- Actualizada la inicialización de sesión en la UI para notificar al backend y persistir en local el usuario devuelto tras refrescar el último acceso.
- Consolidación de cambios de trazabilidad de accesos con versionado de la APP.

## v1.1.51
- Registrado el `ultimo_acceso_process` en la tabla `users` durante el login, guardando un timestamp ISO en cada autenticación correcta.
- Ajustado el endpoint `POST /api/users` para actualizar y devolver el valor de `ultimo_acceso_process` junto con los datos del usuario autenticado.
- Consolidación de cambios de autenticación y versionado de la APP.

## v1.1.50
- Corregido el error en la importación desde APP CODE que detenía el proceso con `TypeError: Renderer.updateNode is not a function` al pulsar **Cargar**.
- Sustituida la llamada incorrecta al renderer por la actualización oficial vía `Engine.updateNode`, garantizando que cada plantilla importada se cree y se rotule correctamente como nodo.
- Se mantiene el comportamiento de descomponer plantillas separadas por comas, usar valores únicos y respetar el tipo indicado entre paréntesis.

## v1.1.49
- Consolidada la importación desde APP CODE para descomponer correctamente la columna `plantillas` cuando llega como string o como array con elementos que incluyen múltiples valores separados por comas.
- Aplicada deduplicación de plantillas para contar y dibujar únicamente valores únicos, evitando que el listado muestre un total incorrecto o que se creen nodos repetidos.
- Asegurada en la UI la creación de un nodo por cada plantilla única importada, manteniendo la detección del tipo de nodo indicado entre paréntesis junto al nombre (por ejemplo, `Nombre (Documento)`).
- Añadida cobertura de pruebas unitarias para validar el split por comas dentro de arrays y la normalización con plantillas únicas.

## v1.1.48
- Corregida la importación desde APP CODE para crear **un nodo individual por cada plantilla** separada por comas en el campo de plantillas.
- Añadido parseo del tipo de nodo desde el sufijo entre paréntesis de cada plantilla, por ejemplo `Nombre (Formulario)`, creando el tipo correspondiente (`formulario`, `documento`, `subproceso`, etc.).
- Ajustada la lectura de `Code_Markdowns` para recuperar los datos con `select("*")` y soportar variantes de esquema (`plantillas`/`plantilla`) durante la normalización.

## v1.1.47
- Añadido el botón **"Cargar desde APP CODE"** en la sección de carga para abrir un modal dedicado a la tabla `Code_Markdowns`.
- Incorporado un nuevo modal de importación organizado por **subfunción** (carpetas) y listado de **proyectos** para seleccionar qué registro cargar.
- Implementado el endpoint `GET /api/code-markdowns` para leer proyectos y plantillas de Supabase, normalizando el campo de plantillas (incluyendo variantes `plantilla/plantillas`).
- Al confirmar la carga, la app limpia el diagrama actual, crea nodos de tipo **formulario** por cada plantilla importada y asigna el nombre del proyecto al procedimiento actual.

## v1.1.46
- Ajustado el botón **Sobrescribir** del modal BDD para que, tras actualizar correctamente el registro seleccionado, cierre el modal automáticamente.
- Mantenida la actualización sobre la misma fila (mismo ID) antes del cierre para conservar la sobrescritura en el registro original.

## v1.1.45
- Añadidas acciones de **Sobrescribir** y **Eliminar** en el modal de guardado en BDD, visibles en modo guardar y con confirmación explícita antes de ejecutar cambios destructivos.
- Restringidas las acciones de sobrescritura y eliminación para que solo estén habilitadas cuando el usuario autenticado coincide con el creador del registro seleccionado.
- Extendida la API `process-flows` con métodos `PUT` y `DELETE` validados por creador para actualizar o borrar registros de forma segura desde la interfaz.

## v1.1.44
- Compatibilizado el guardado/carga de flujos JSON (local, copiado/pegado y BDD) para normalizar nodos con tipos heredados como `sub_process`, `sub process` o `nodeType`, convirtiéndolos a `subproceso`.
- Añadida normalización de estructuras legacy `nodes/connections` a `nodos/conexiones` durante importación para evitar errores al copiar JSON o recuperar registros antiguos de base de datos.
- Actualizada la API `process-flows` para sanear tipos de nodo al guardar y al leer, garantizando que los flujos persistidos sean compatibles con el nuevo tipo de nodo Subproceso.
- Incorporada cobertura de pruebas para validar la importación de payloads incompatibles y su conversión automática.

## v1.1.43
- Añadido el nuevo tipo de nodo **Subproceso** con alta desde panel, edición desde propiedades y selección desde el asistente.
- Implementada la nueva forma SVG de **Subproceso** como rectángulos apilados, manteniendo todas las funcionalidades de un nodo estándar (conexiones, edición y resize).
- Extendida la representación del minimapa para dibujar el tipo **Subproceso** con su iconografía apilada y etiqueta abreviada.

## v1.1.42
- Ajustado el asistente de importación para crear solo tesauros coincidentes y reubicar los botones de confirmación sobre los listados.

## v1.1.41
- Actualizado el asistente de importación desde Gestiona con nuevos pasos para pegar flujo, tesauros, revisar coincidencias, pedir valores de selectores coincidentes y confirmar montaje.

## v1.1.40
- Sincronizado el resaltado de nodos desde el minimapa para que aplique el mismo estado visual del canvas (nodo seleccionado y conexiones).

## v1.1.39
- Sincronizada la selección del minimapa con el canvas para aplicar resaltados completos del nodo y sus conexiones, incluyendo selección múltiple con Ctrl.

## v1.1.38
- Sincronizado el resaltado visual del canvas al seleccionar nodos desde el minimapa (nodo activo y conexiones) para que se comporte como el clic directo en el canvas.

## v1.1.37
- Iniciado el acordeón de Usuario colapsado por defecto.
- Mostrado el minimapa desde el arranque con tamaño 300x300 y posición inferior derecha.

## v1.1.36
- Añadidas etiquetas abreviadas en los nodos del minimapa para identificar tipos (CR, DOC, FOR, LIB, OP) e icono de reloj de arena para plazo.

## v1.1.35
- Sincronizada la selección real de nodos al navegar desde el minimapa, incluyendo la selección múltiple con Ctrl/Cmd clic.

## v1.1.34
- Corregido el arrastre del viewport del minimapa para mover el canvas real desde el rectángulo de vista.

## v1.1.33
- Ajustada la forma del documento en el minimapa y habilitado el arrastre del viewport para desplazar el canvas.
- Sincronizados los overlays de asignaciones/cambios y los resaltados de conexiones/nodos relacionados en el minimapa.

## v1.1.32
- Ajustado el minimapa para dibujar conexiones con el mismo trazado ortogonal del canvas y permitir navegación al seleccionar nodos.
- Añadidas formas miniaturizadas por tipo de nodo y soporte de selección múltiple en el minimapa.

## v1.1.31
- Añadido el minimapa flotante del procedimiento con vista miniaturizada, resaltado de selección y marcador del viewport visible.
- Incorporado el botón flotante "Minimap" debajo de Tesauro y habilitado el redimensionado/arrastre de la ventana.

## v1.1.30
- Reducida un 40% la separación vertical entre niveles al importar procesos por copypaste.

## v1.1.29
- Compactada la separación vertical del layout importado sin permitir solapes y ampliado un 10% el espaciado horizontal entre nodos.

## v1.1.28
- Desplazados los nodos dead end a los lados del tronco al importar por copypaste, manteniendo el nodo final centrado.

## v1.1.27
- Ajustado el cálculo de niveles al importar por copypaste para garantizar que los hijos no queden por encima de sus padres y evitar que los back-edges arrastren niveles hacia arriba.

## v1.1.26
- Recalculada la distribución espacial al importar procesos por copypaste usando únicamente las relaciones "Lanzar tarea", con espaciado dinámico por nivel para evitar solapes.
- Ampliado el ancho útil del canvas en importaciones con muchos nodos y aplicado un ajuste horizontal por nivel para aprovechar mejor el espacio disponible.

## v1.1.25
- Reubicados los loops opcionales que vuelven al camino principal para que se dibujen más a los lados con mayor separación horizontal y evitar solapes.

## v1.1.24
- Separados los subprocesos importados por copypaste respecto a la línea principal, empujándolos a izquierda/derecha para distinguirlos visualmente.
- Forzada la colocación de los subprocesos de subsanación a la derecha y alternado el lado del resto de ramas para distinguir bucles.

## v1.1.23
- Añadido el botón flotante "Importar desde Gestiona" con un modal guiado para importar tesauros, proceso y ficha del procedimiento en secuencia.
- Incorporada la validación final con resumen para confirmar y montar el proceso completo en la app.

## v1.1.22
- Forzado el modal de inicio de sesión al entrar a la app y bloqueada la interacción con botones hasta autenticar.
- Mejorada la visibilidad del indicador de sesión activa con un punto verde más notorio.

## v1.1.21
- Añadido inicio de sesión y edición de usuario con persistencia local para gestionar credenciales en la app.
- Al guardar flujos en la BDD se informa el creador y se muestra en el modal de carga.
- Incorporado el endpoint de usuarios y ampliada la API de flujos para incluir el campo creador.

## v1.1.20
- Reorganizado el panel izquierdo en un acordeón colapsado por defecto, agrupando acciones y renombrando secciones según la nueva estructura.
- Ajustados los rótulos de acciones de guardado, carga y exportación CSV en el panel izquierdo para reflejar la nueva nomenclatura.

## v1.1.19
- Sustituido el guardado/carga por un modal amplio con carpetas por subfunción, edición de nombre y creación de subfunciones para organizar flujos.
- Incluida la columna subfunción en la API de Process_Flows y en los envíos al guardar.

## v1.1.18
- Añadidos botones para guardar y cargar flujos JSON desde base de datos, con selector por nombre.

## v1.1.17
- Añadido microservicio para importar/exportar JSON de Process_Flows en Supabase vía endpoints GET/POST.

## v1.1.16
- Ajustada la importación de tesauros por copypaste para aceptar el pegado directo desde la app, manteniendo compatibilidad con el formato anterior.

## v1.1.15
- Actualizada la importación de valores de selectores para detectar referencias/valores pegados y omitir etiquetas de idioma.

## v1.1.14
- Actualizado el copypaste de tesauros para aceptar el formato con momento/agrupación/referencia/nombre/tipo y mantener compatibilidad con el formato anterior.
- Propagados momento y agrupación al actualizar o crear tesauros importados.

## v1.1.13
- Añadida la importación de tesauros por copypaste con modal dedicado y configuración guiada de selectores I18N.
- Ajustada la paleta de botones de tesauro para mantener el rojo corporativo en paneles y modales.

## v1.1.12
- Ajustada la importación de tesauros desde CSV para leer las columnas exportadas y reconstruir tipos, nombres, referencias y valores de selectores sin usar la tabla de vinculación.

## v1.1.11
- El modal de importación desde Gestiona muestra desde el inicio las tablas del resumen vacías, listas para rellenarse tras Cargar y permitir Validar.

## v1.1.10
- Sustituido el copypaste por un modal de importación desde Gestiona con área de pegado, botón Cargar y validación posterior tras revisar el resumen.
- Añadida una vista resumen previa idéntica a "Ver procedimiento" antes de validar la importación.

## v1.1.9
- Actualizado el copypaste para transformar automáticamente las condiciones importadas en tesauros, reutilizando la lógica del botón de transformación.

## v1.0.0
- Sustituida la asignación legacy única por asignaciones múltiples de grupos y usuarios en todas las interfaces, incluida la selección masiva.
- Ajustadas las importaciones/exportaciones (CSV y texto) para utilizar los campos de asignación múltiples y poblar los pools globales.
- Actualizadas las plantillas y asistentes para crear nodos únicamente con asignaciones en formato de lista.

## v1.1.0
- Asignados colores persistentes a las conexiones seleccionadas y sus resaltados para mejorar la lectura visual.
- Guardadas las posiciones manuales de tramos para que las conexiones no se reinicien al mover nodos.
- Habilitado el arrastre de etiquetas de condición a lo largo de cada línea para reubicarlas con precisión.

## v1.1.1
- Revertida la persistencia del movimiento manual de tramos en conexiones.
- Añadido selector de color en el panel lateral para cambiar el color de la conexión seleccionada y su highlight.

## v1.1.2
- Ajustado el color base de las conexiones para que el selector pinte la línea incluso sin selección.

## v1.1.3
- Ajustado el selector de color para respetar el color base por defecto y solo aplicar cambios cuando el usuario elige un color.

## v1.1.4
- Actualizada la importación de copypaste para aceptar la nueva columna de tipo de tarea y mantener la compatibilidad con el formato anterior.

## v1.1.5
- Ajustada la importación de copypaste para detectar bloques copiados desde la app sin pasar por Excel, preservando asignaciones y condiciones.
- Actualizada la guía del copypaste para indicar que se acepta texto desde la app o Excel.

## v1.1.6
- Corregida la detección de columnas en el copypaste para mantener separadores con tabulaciones aunque falten columnas, asegurando compatibilidad con el formato de la app externa.

## v1.1.7
- Evitada la propagación visual de asignaciones entre nodos al clonar arrays de asignación por nodo.
- Ajustadas las ediciones y eliminaciones de asignaciones para no compartir referencias entre nodos.

## v1.1.8
- Ocultado el campo legacy de "Asignado a" en el panel lateral para mostrar solo asignaciones por grupo y usuario.
