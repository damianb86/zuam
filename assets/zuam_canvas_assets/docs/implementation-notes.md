# Zuam Living Control Map - implementation notes

## Concepto

La última opción funciona como un **living control map**. No es una Z decorativa: es un sistema visual que explica qué hace Zuam.

- **Input signals:** entran señales de comercio: productos, reviews, performance, conversión, SEO, operación, analytics.
- **Pattern recognition:** la IA identifica relaciones, patrones, fricciones y oportunidades.
- **Insight core:** el diamante central representa el momento donde la información se convierte en criterio y decisión.
- **Automation:** las decisiones se transforman en flujos, apps, integraciones y sistemas.
- **Scale:** el sistema se vuelve repetible, medible y escalable.

## Capas visuales recomendadas

1. **Background grid:** grilla muy sutil, no protagonista.
2. **Z infrastructure:** forma oscura en navy, sólida, tipo arquitectura/software.
3. **Neon route:** líneas violeta/teal que viajan sobre la Z, representando señales y razonamiento.
4. **Nodes:** puntos principales con comportamientos físicos.
5. **Insight diamond:** centro con pulso suave.
6. **Ambient particles:** partículas chicas que orbitan, se repelen o se atraen por el mouse.
7. **Labels:** pequeñas cards glassmorphism con estado: Live, Analyzing, Active, Optimizing.

## Interacción

- El mouse representa una señal o problema del cliente.
- Los nodos no deben moverse mucho: máximo 16-22 px.
- Algunos puntos se atraen: señales útiles.
- Algunos se repelen: ruido o fricción.
- Algunos orbitan: información en análisis.
- El diamante central pulsa o se ilumina cuando el mouse se acerca.
- Al salir el mouse, todo vuelve lentamente a su estructura original.

## Animación sugerida

- Flow lines: stroke-dashoffset constante, lento.
- Partículas: mover sobre paths o por ruido/perlin simple.
- Nodos: spring suave, damping alto.
- Center diamond: pulse 0.96 a 1.08, glow dinámico.
- Reduced motion: apagar particles y mantener SVG estático.

## Textos recomendados para labels

Versión directa:
- Input signals
- Pattern recognition
- Automation
- Scale

Versión más comercial:
- Commerce signals
- AI reasoning
- Operational systems
- Scale

Versión más corta:
- Signals
- Intelligence
- Systems
- Scale

## Archivos incluidos

- `reference-last-option.png`: imagen de referencia generada.
- `assets/zuam-z-mark.svg`: ícono Z aislado y editable.
- `assets/zuam-control-map-static.svg`: referencia estática SVG de la composición.
- `assets/zuam-canvas-tokens.css`: tokens visuales para CSS.
- `config/zuam-control-map.config.json`: coordenadas, colores, nodos, labels e interacción.
- `docs/codex-prompt.md`: prompt para pedirle a Codex que implemente el canvas.
