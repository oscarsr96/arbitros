# Modelo de coste de desplazamiento — reescritura a modelo de RUTA

> Dictado por el usuario el 2026-07-21. **Estas reglas NO están en las Bases Generales
> ni en ningún otro documento**: él confirmó que no vienen ahí. Es la única fuente.
> Si esto se pierde, no se recupera de ninguna normativa.

## El modelo

El día de una persona es una **RUTA**, no un conjunto de destinos:
`casa → V1 → V2 → ... → Vn → casa`, con los `Vi` ordenados por hora de partido.

```
fijo    = (∃ i : muni(Vi) == muni(casa)) ? (esMadrid(casa) ? 3 : 2) : 0
casa→V1 = muni(V1) == muni(casa) ? 0 : km(casa, V1)
Vi→Vi+1 = (Vi == Vi+1) ? 0 : km(Vi, Vi+1)      // MISMO municipio también paga km
Vn→casa = (n == 1 && muni(V1) == muni(casa)) ? 0 : km(Vn, casa)
```

Tarifa: 0,26 €/km. Fijo: 3 € Madrid capital, 2 € resto.

## Los 6 casos, como contrato de tests

| #   | Escenario                                            | Resultado                     |
| --- | ---------------------------------------------------- | ----------------------------- |
| 1   | Vive en Pozuelo, 1 partido en Pozuelo                | 2 €                           |
| 2   | Vive en Madrid, 1 partido en Madrid                  | 3 €                           |
| 3   | Vive en Pozuelo, 1 partido en Madrid                 | km(ida) + km(vuelta)          |
| 4   | Pozuelo → pabellón Pozuelo → pabellón otro municipio | 2 € + km(V1→V2) + km(V2→casa) |
| 5   | Segundo partido en el MISMO pabellón                 | +0                            |
| 6   | Pozuelo → 2 pabellones distintos de Pozuelo          | 2 € + km(V1→V2) + km(V2→casa) |

Desambiguaciones confirmadas por el usuario:

- Día entero en tu municipio con 2 pabellones: la vuelta a casa **sí** es kilometraje (caso 6).
- Último partido en tu propio municipio (casa Pozuelo → Madrid → Pozuelo): la vuelta **sí**
  es kilometraje, y el fijo se gana igual.
- El fijo se gana **siempre que haya al menos un partido en tu municipio**, esté en la
  posición que esté de la cadena, no solo si es el primero.

## Qué rompe del código actual

`calculateDailyTravelCost` en `apps/web/src/lib/mock-data.ts`. Cuatro contradicciones, las
cuatro afectan a dinero:

1. **El fijo y el km se excluyen.** Hoy: cualquier salida fuera del municipio → solo km, se
   pierde el fijo. Falso: coexisten (caso 4).
2. **Es una estrella, no una cadena.** Hoy suma `casa→municipio_destino` por cada municipio
   distinto. Debe ser la ruta encadenada entre pabellones, con vuelta desde el último.
3. **Dos pabellones del mismo municipio pagan 0.** `getMockDistance` devuelve 0 si el
   municipio coincide (`mock-data.ts:2045`). Deben pagar km como si fueran municipios
   distintos (casos 5 y 6).
4. **El fijo depende de la posición.** Debe ganarse con que haya un partido local en
   cualquier punto de la cadena.

El **CLAUDE.md documenta el modelo viejo** (sección "Lógica de Coste de Desplazamiento"):
hay que corregirlo también, o volverá a propagarse.

## Dependencias

- **Requiere direcciones exactas y coordenadas** de personas y pabellones. La regla 3 hace
  que la precisión a nivel de calle afecte al DINERO, no solo a la optimización. Ese es el
  trabajo del agente `Direcciones` (rama `scripts/geo/`), que debe aterrizar antes.
- La dirección pasa a ser la **fuente de la verdad** y el municipio se **deriva** de ella.
  Hoy es al revés: `referee-roster.ts:1773` fabrica la dirección a partir del municipio, y
  no había ni una coordenada en el proyecto.

## Propagación

- `calculatePersonTravelCost` y `getPersonTravelCost` (mismo fichero) cuelgan de esto.
- El **solver** (`solver.ts`) puntúa candidatos por coste marginal vía
  `calculateDailyTravelCost`: cambia su función objetivo, así que cambian las asignaciones.
- **Invalida el fingerprint de jornada real** grabado en P6 (`f008736`). Hay que regrabarlo
  después. No es trabajo perdido: sirve para separar "cambió por la regla nueva" de "cambió
  porque una optimización lo rompió".
- Dashboard, portal y reportes leen de aquí.

## Aparcado a propósito

- **S1** (factor constante del solver) y **D1** (medición). Motivo: la función de coste del
  solver está a punto de cambiar entera, y la premisa de S1 no se sostiene (el plan decía
  20,8 s de mediana contra objetivo de 30; medido el 2026-07-21, **5-8 s**). Es la misma
  razón por la que se descartó A1: no optimizar contra una premisa sin medir.
