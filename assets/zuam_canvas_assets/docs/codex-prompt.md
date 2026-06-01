# Prompt para Codex

Quiero que implementes el hero canvas interactivo de Zuam usando los assets y la configuración incluidos en esta carpeta.

Objetivo:
Crear un componente de hero canvas llamado `ZuamControlMap` o equivalente, basado en el concepto visual `Living Control Map`.

Archivos disponibles:
- `reference-last-option.png`: referencia visual principal.
- `assets/zuam-z-mark.svg`: ícono Z base.
- `assets/zuam-control-map-static.svg`: composición estática de referencia.
- `assets/zuam-canvas-tokens.css`: tokens de color, sombras, bordes y estilo.
- `config/zuam-control-map.config.json`: configuración de coordenadas, nodos, paths, labels, partículas e interacción.

Concepto:
El canvas debe representar cómo Zuam convierte señales dispersas de un negocio en sistemas inteligentes y escalables.

Mapa conceptual:
- Input signals: entrada de señales de ecommerce, productos, analytics, reviews, SEO, performance y operación.
- Pattern recognition: IA y análisis detectan patrones.
- Insight core: el diamante central representa el momento de claridad/decisión.
- Automation: las decisiones se convierten en software, workflows e integraciones.
- Scale: los sistemas se vuelven medibles, repetibles y escalables.

Requisitos visuales:
- Fondo claro premium con grilla sutil.
- Container con border-radius grande, borde suave y sombra sutil.
- Z central en navy oscuro.
- Líneas internas brillantes en violeta, azul y teal.
- Nodos circulares con anillos blancos y centros de color.
- Diamante central violeta con glow.
- Partículas pequeñas alrededor del sistema.
- Labels glassmorphism con textos: Input signals, Pattern recognition, Automation, Scale.
- Chips inferiores: Signal, System, Scale.
- Debe ser responsive.
- Debe verse bien en desktop y mobile. En mobile se puede simplificar: menos partículas, labels más chicos o algunos ocultos.

Interacción:
- El mouse debe influir levemente sobre nodos y partículas.
- Algunos nodos se atraen al mouse.
- Algunos nodos se repelen.
- Algunos orbitan suavemente cuando el mouse está cerca.
- El diamante central debe hacer un pulso suave cuando el mouse se acerca.
- No exagerar la física: debe sentirse premium, no juguete.
- Al salir el mouse, todo vuelve lentamente a su posición base.
- Respetar `prefers-reduced-motion`: si está activo, desactivar partículas y animaciones intensas.

Implementación sugerida:
- Usar React + TypeScript.
- Puede implementarse con SVG + requestAnimationFrame, o Canvas 2D si ya existe esa base.
- Preferir SVG para la estructura principal y canvas para partículas si facilita performance.
- Usar la configuración JSON como fuente de coordenadas y estilos.
- Mantener el componente encapsulado.
- Evitar dependencias pesadas salvo que ya estén en el proyecto.
- No usar imágenes raster para la Z principal si puede hacerse con SVG.
- Las líneas de flujo pueden implementarse con `stroke-dasharray` y `stroke-dashoffset` animado.
- Los nodos pueden calcular una posición renderizada según mouse y spring.
- Las partículas pueden tener posición base + comportamiento `orbit`, `repel`, `drift`.

Criterios de aceptación:
- Se ve claramente una Z de Zuam, no una forma genérica.
- El diseño comunica señales -> inteligencia -> automatización -> escala.
- El canvas es más significativo que decorativo.
- La interacción es sutil y elegante.
- El componente no rompe performance.
- El componente respeta responsive y reduced motion.
- Colores y estilo coinciden con la marca Zuam.
