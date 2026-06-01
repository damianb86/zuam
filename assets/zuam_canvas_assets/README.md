# Zuam Canvas Assets

Assets para desarrollar la última opción del hero interactivo de Zuam: un **Living Control Map** basado en la Z de la marca.

## Contenido

- `reference-last-option.png`: imagen de referencia visual.
- `assets/zuam-z-mark.svg`: Z aislada, editable y reusable.
- `assets/zuam-control-map-static.svg`: versión estática del hero/control map.
- `assets/zuam-canvas-tokens.css`: variables CSS de marca.
- `config/zuam-control-map.config.json`: coordenadas, nodos, labels y reglas de interacción.
- `docs/implementation-notes.md`: explicación conceptual y técnica.
- `docs/codex-prompt.md`: prompt para pedirle a Codex que lo implemente.

## Uso sugerido

1. Usar `zuam-control-map-static.svg` como referencia estructural.
2. Implementar la Z y los nodos como SVG dinámico.
3. Usar `zuam-control-map.config.json` para mantener posiciones y comportamiento fuera del componente.
4. Usar `zuam-canvas-tokens.css` o copiar las variables al sistema de estilos existente.
5. Usar `docs/codex-prompt.md` para pedirle a Codex la implementación.
