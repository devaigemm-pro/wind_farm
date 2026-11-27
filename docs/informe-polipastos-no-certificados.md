# Informe de polipastos — ANEXO II (EQUIPOS NO CERTIFICADOS)

Fuente: `ANEXO II (EQUIPOS NO CERTIFICADOS).docx` entregado por el usuario.
Implementado en `src/services/hoistCertificationReportPdf.service.ts` (`variant: 'not_certified'`).

Se genera con las turbinas completas cuya condición es **NO CERTIFICADO**
(alguna verificación "no cumple", o condición fijada a mano).

## Portada
Misma portada del informe de certificación + "Anexo II" / "Equipos no certificados".

## Página 2 — texto exacto (nn dinámico)

**EQUIPOS NO CERTIFICADOS**

Terminado el proceso de Inspección y certificación de Polipastos, se determinó que
__**nn polipastos NO pasaron la inspección.**__

A continuación, se entrega un detalle de las unidades NO certificadas. Las unidades
catalogadas como “**NO CERTIFICADO**” se entenderán “**NO APTOS**” para realizar
maniobras hasta que las observaciones sean subsanadas y se proceda a su recertificación.

## Por turbina
Misma ficha del informe principal con encabezado `WTG xx` en rojo (FF0000) y
CONDICIÓN "NO CERTIFICADO" en rojo; luego la tabla de resultados en página aparte.

## Cierre
Página de firma y derechos de informe (igual al informe principal).
