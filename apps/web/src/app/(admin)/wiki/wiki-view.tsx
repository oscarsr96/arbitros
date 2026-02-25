'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const sections = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'partidos', label: 'Partidos' },
  { id: 'personal', label: 'Personal' },
  { id: 'asignacion', label: 'Asignación' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'faq', label: 'FAQ' },
  { id: 'glosario', label: 'Glosario' },
]

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
      <span className="font-semibold">Consejo:</span> {children}
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium hover:bg-gray-50">
        {open ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-500" />
        )}
        {question}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-3 pt-2 text-sm text-gray-600">
        {answer}
      </CollapsibleContent>
    </Collapsible>
  )
}

function GlossaryItem({ term, description }: { term: string; description: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <dt className="text-sm font-semibold text-gray-900">{term}</dt>
      <dd className="mt-1 text-sm text-gray-600">{description}</dd>
    </div>
  )
}

export function WikiView() {
  const [activeId, setActiveId] = useState('dashboard')
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 },
    )

    for (const section of sections) {
      const el = document.getElementById(section.id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [])

  function scrollTo(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Wiki</h1>
        <p className="mt-1 text-sm text-gray-500">Guía completa del panel de administración</p>
      </div>

      {/* Mobile TOC */}
      <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4 py-2 lg:hidden">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeId === s.id
                ? 'bg-fbm-navy text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        {/* Desktop TOC */}
        <nav className="hidden w-48 flex-shrink-0 lg:block">
          <div className="sticky top-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Contenido
            </p>
            <ul className="space-y-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => scrollTo(s.id)}
                    className={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
                      activeId === s.id
                        ? 'bg-fbm-navy/10 text-fbm-navy font-semibold'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-8">
          {/* Dashboard */}
          <section
            id="dashboard"
            className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6"
          >
            <h2 className="text-lg font-bold text-gray-900">Dashboard</h2>
            <p className="mt-2 text-sm text-gray-600">
              La pantalla principal del panel de administración. Muestra un resumen rápido del
              estado de la jornada seleccionada.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-gray-600">
              <li>
                <strong>Tarjetas resumen:</strong> total de partidos, partidos cubiertos, partidos
                pendientes y coste estimado de desplazamiento.
              </li>
              <li>
                <strong>Barra de cobertura:</strong> indicador visual del porcentaje de partidos con
                todos los oficiales asignados. Verde (&ge;80%), amarillo (50-79%), rojo (&lt;50%).
              </li>
              <li>
                <strong>Alertas:</strong> avisos automáticos cuando hay partidos sin cobertura,
                personas sin disponibilidad registrada, o rechazos pendientes de gestionar.
              </li>
              <li>
                <strong>Selector de escenario demo:</strong> permite cargar distintos conjuntos de
                datos de ejemplo para probar el sistema (disponible solo en modo demo).
              </li>
            </ul>
            <Tip>
              Revisa el dashboard al inicio de cada semana para detectar problemas de cobertura con
              tiempo suficiente.
            </Tip>
          </section>

          {/* Calendario */}
          <section
            id="calendario"
            className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6"
          >
            <h2 className="text-lg font-bold text-gray-900">Calendario</h2>
            <p className="mt-2 text-sm text-gray-600">
              Vista semanal de todos los partidos organizados por día y hora. Permite ver de un
              vistazo la distribución de la jornada.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-gray-600">
              <li>
                <strong>Cuadrícula semanal:</strong> filas por franja horaria, columnas por día de
                la semana (lunes a domingo).
              </li>
              <li>
                <strong>Código de colores:</strong> verde = totalmente cubierto, amarillo =
                parcialmente cubierto, rojo = sin oficiales asignados.
              </li>
              <li>
                <strong>Popover de detalle:</strong> haz clic en cualquier partido para ver equipos,
                pabellón, categoría y oficiales asignados.
              </li>
              <li>
                <strong>Navegación entre semanas:</strong> flechas para avanzar o retroceder entre
                jornadas.
              </li>
            </ul>
            <Tip>
              Usa la vista de calendario para identificar franjas horarias con muchos partidos
              simultáneos — ahí es donde suelen faltar oficiales.
            </Tip>
          </section>

          {/* Partidos */}
          <section
            id="partidos"
            className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6"
          >
            <h2 className="text-lg font-bold text-gray-900">Partidos</h2>
            <p className="mt-2 text-sm text-gray-600">
              Listado completo de todos los partidos de la jornada con opciones de filtrado y
              detalle expandible.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-gray-600">
              <li>
                <strong>Filtros:</strong> filtra por día de la semana, categoría de competición,
                municipio del pabellón, o estado de cobertura.
              </li>
              <li>
                <strong>Importación CSV:</strong> sube un archivo CSV con los partidos de la
                jornada. El sistema valida pabellones, categorías y formato antes de importar.
              </li>
              <li>
                <strong>Detalle expandible:</strong> expande cualquier fila para ver los slots de
                asignación (árbitros y anotadores), con nombre, municipio, coste de desplazamiento y
                botón &quot;Cómo llegar&quot;.
              </li>
              <li>
                <strong>Estado del partido:</strong> programado, designado (todos los oficiales
                asignados), jugado o suspendido.
              </li>
            </ul>
            <Tip>
              Importa los partidos al menos 7 días antes de la jornada para dar tiempo a los
              árbitros a registrar su disponibilidad.
            </Tip>
          </section>

          {/* Personal */}
          <section
            id="personal"
            className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6"
          >
            <h2 className="text-lg font-bold text-gray-900">Personal</h2>
            <p className="mt-2 text-sm text-gray-600">
              Directorio de todos los árbitros y anotadores registrados en el sistema.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-gray-600">
              <li>
                <strong>Grid de tarjetas:</strong> cada persona muestra nombre, rol
                (árbitro/anotador), categoría, municipio y carga actual de la jornada.
              </li>
              <li>
                <strong>Filtros:</strong> filtra por rol, categoría arbitral, municipio de
                residencia, o disponibilidad en la jornada actual.
              </li>
              <li>
                <strong>Ficha de detalle:</strong> panel lateral (sheet) con toda la información de
                la persona: disponibilidad semanal, partidos asignados, historial de carga e
                incompatibilidades.
              </li>
              <li>
                <strong>Indicador de disponibilidad:</strong> badge verde si ha registrado
                disponibilidad para la semana, gris si no.
              </li>
            </ul>
            <Tip>
              Revisa la sección de personal antes de lanzar la asignación automática para asegurarte
              de que hay suficientes árbitros con disponibilidad.
            </Tip>
          </section>

          {/* Asignación */}
          <section
            id="asignacion"
            className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6"
          >
            <h2 className="text-lg font-bold text-gray-900">Asignación</h2>
            <p className="mt-2 text-sm text-gray-600">
              El corazón del sistema. Aquí se asignan oficiales a los partidos, ya sea de forma
              manual o automática.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-gray-600">
              <li>
                <strong>Asignación manual:</strong> expande un partido y usa el PersonPicker para
                buscar y seleccionar oficiales. El selector muestra solo personas disponibles,
                ordenadas por coste de desplazamiento.
              </li>
              <li>
                <strong>Asignación automática:</strong> lanza el motor de optimización que encuentra
                la combinación óptima minimizando coste y equilibrando carga. Configura los
                parámetros (peso coste vs equilibrio, máximo partidos por persona) antes de
                ejecutar.
              </li>
              <li>
                <strong>Propuesta y diff:</strong> la asignación automática genera una propuesta que
                puedes revisar. El diff visual muestra qué cambiaría respecto a asignaciones
                manuales previas.
              </li>
              <li>
                <strong>Sustituciones:</strong> al eliminar un oficial asignado, el sistema sugiere
                automáticamente sustitutos ordenados por coste y cercanía.
              </li>
              <li>
                <strong>Publicación:</strong> una vez conforme con las asignaciones, pulsa
                &quot;Publicar&quot; para notificar por email a todos los oficiales. Cada persona
                recibe los detalles de sus partidos.
              </li>
            </ul>
            <Tip>
              Puedes combinar ambos métodos: asigna manualmente los partidos más importantes y deja
              que el optimizador complete el resto.
            </Tip>
          </section>

          {/* Reportes */}
          <section
            id="reportes"
            className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6"
          >
            <h2 className="text-lg font-bold text-gray-900">Reportes</h2>
            <p className="mt-2 text-sm text-gray-600">
              Informes financieros y estadísticas de carga para el seguimiento y la liquidación.
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-gray-600">
              <li>
                <strong>Tarjetas resumen:</strong> coste total, número de partidos, oficiales
                activos y media de coste por partido.
              </li>
              <li>
                <strong>Coste por jornada:</strong> gráfico de barras que muestra la evolución del
                coste de desplazamiento a lo largo de las jornadas.
              </li>
              <li>
                <strong>Coste por municipio:</strong> desglose de costes agrupado por municipio del
                pabellón.
              </li>
              <li>
                <strong>Carga por persona:</strong> gráfico de barras con el número de partidos
                asignados a cada oficial, útil para detectar desequilibrios.
              </li>
              <li>
                <strong>Tabla de liquidación:</strong> listado detallado por persona con partidos,
                desglose de desplazamiento y total. Alterna entre vista de jornada actual y
                acumulado mensual (jornadas 13-15).
              </li>
              <li>
                <strong>Exportación:</strong> descarga los datos en formato Excel (XLSX) o PDF para
                el departamento financiero.
              </li>
            </ul>
            <Tip>
              Exporta la liquidación mensual en Excel para enviarla directamente a tesorería. El PDF
              sirve como justificante individual para cada árbitro.
            </Tip>
          </section>

          {/* FAQ */}
          <section id="faq" className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900">Preguntas Frecuentes</h2>
            <p className="mt-2 text-sm text-gray-600">
              Respuestas a las dudas más comunes sobre el funcionamiento del sistema.
            </p>
            <div className="mt-4 space-y-2">
              <FaqItem
                question="¿Cómo funciona la asignación automática?"
                answer="El motor de optimización recibe los partidos, las personas disponibles, las distancias y las restricciones, y busca la combinación que minimiza el coste total de desplazamiento mientras equilibra la carga entre oficiales. Usa programación lineal entera (CP-SAT de Google OR-Tools) con un límite de tiempo de 30 segundos."
              />
              <FaqItem
                question="¿Qué pasa si un árbitro rechaza una designación?"
                answer="El partido queda marcado como parcialmente cubierto. El designador puede buscar un sustituto manualmente (el sistema sugiere candidatos ordenados por coste) o relanzar una optimización parcial que solo reasigna ese slot sin tocar el resto."
              />
              <FaqItem
                question="¿Qué significan los colores de cobertura?"
                answer="Verde: todos los oficiales necesarios están asignados y confirmados. Amarillo: algunos slots cubiertos pero faltan oficiales. Rojo: ningún oficial asignado. Estos colores aparecen en el dashboard, el calendario y la lista de partidos."
              />
              <FaqItem
                question="¿Cómo se calcula el coste de desplazamiento?"
                answer="Si el oficial vive en el mismo municipio que el pabellón, la tarifa es fija (3 €). Si vive en otro municipio, se consulta la matriz de distancias precalculada y se multiplica por la tarifa por kilómetro (0,10 €/km). Ejemplo: 45 km → 4,50 €."
              />
              <FaqItem
                question="¿Qué es una sustitución?"
                answer="Cuando un oficial asignado no puede acudir (rechaza la designación, enfermedad, etc.), se necesita un sustituto. El sistema propone automáticamente candidatos disponibles para esa franja horaria, ordenados por menor coste de desplazamiento."
              />
              <FaqItem
                question="¿Qué restricciones aplica el sistema?"
                answer="Disponibilidad horaria, categoría mínima del árbitro, incompatibilidades (un árbitro no puede pitar a su propio club), solapamiento temporal (no dos partidos a la vez), carga máxima por jornada (configurable, por defecto 3), y restricción de coche (sin coche y más de 30 km → descartado)."
              />
              <FaqItem
                question="¿Puedo forzar una asignación manual antes de optimizar?"
                answer="Sí. Las asignaciones manuales previas se marcan como fijas. Al lanzar la optimización automática, el solver respeta esas asignaciones y solo optimiza los slots vacantes."
              />
              <FaqItem
                question="¿Cómo se importan los partidos?"
                answer="Desde la sección Partidos, sube un archivo CSV con las columnas: fecha, hora, pabellón, equipo local, equipo visitante y categoría. El sistema valida el formato, comprueba que los pabellones existen, y crea los partidos con estado 'programado'."
              />
            </div>
          </section>

          {/* Glosario */}
          <section
            id="glosario"
            className="scroll-mt-20 rounded-xl border border-gray-200 bg-white p-6"
          >
            <h2 className="text-lg font-bold text-gray-900">Glosario</h2>
            <p className="mt-2 text-sm text-gray-600">
              Terminología clave utilizada en el sistema.
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <GlossaryItem
                term="Designación"
                description="Asignación de un oficial (árbitro o anotador) a un partido concreto, con su rol, coste de desplazamiento y estado de confirmación."
              />
              <GlossaryItem
                term="Cobertura"
                description="Porcentaje de slots de oficiales cubiertos para un partido o jornada. Cobertura 100% = todos los árbitros y anotadores asignados."
              />
              <GlossaryItem
                term="Incompatibilidad"
                description="Restricción que impide a un árbitro pitar partidos de su propio club. Se configura por persona y equipo."
              />
              <GlossaryItem
                term="Liquidación"
                description="Proceso mensual de cálculo del total a pagar a cada oficial por sus desplazamientos. Se exporta en Excel/PDF."
              />
              <GlossaryItem
                term="Jornada"
                description="Conjunto de partidos que se disputan en una semana concreta dentro de una temporada."
              />
              <GlossaryItem
                term="Franja horaria"
                description="Intervalo de tiempo en el que una persona declara estar disponible para arbitrar o anotar."
              />
              <GlossaryItem
                term="Categoría arbitral"
                description="Nivel de cualificación: Provincial, Autonómico, Nacional o FEB. Cada competición exige una categoría mínima."
              />
              <GlossaryItem
                term="Anotador"
                description="Oficial de mesa responsable del acta del partido, cronometraje y control del marcador."
              />
              <GlossaryItem
                term="Árbitro"
                description="Oficial de cancha que dirige el partido aplicando las reglas de juego."
              />
              <GlossaryItem
                term="Pabellón"
                description="Instalación deportiva donde se disputa un partido. Cada pabellón pertenece a un municipio."
              />
              <GlossaryItem
                term="Municipio"
                description="Localidad de la Comunidad de Madrid. La matriz de distancias entre municipios determina los costes de desplazamiento."
              />
              <GlossaryItem
                term="Matriz de distancias"
                description="Tabla precalculada con la distancia en km entre cada par de municipios (~32.000 combinaciones). Se usa para calcular costes."
              />
            </dl>
          </section>
        </div>
      </div>
    </div>
  )
}
