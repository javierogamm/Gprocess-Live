# Historial de cambios

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
