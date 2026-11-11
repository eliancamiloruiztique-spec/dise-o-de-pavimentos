CALCULADORA DE PAVIMENTOS - TECNOLOGICO COMFENALCO  (v7.0)

Version publica: no requiere contrasena ni registro.

Archivos del proyecto:
- index.html: interfaz y SEO basico
- css/estilos.css: identidad visual y responsive
- js/app.js: motor de calculo AASHTO-93, geotextiles AASHTO M288-00 y visualizacion
- logo-comfenalco.png: logo institucional
- robots.txt y sitemap.xml: base para indexacion

Novedades de la v7.0:
- Pavimento flexible con analisis por capas (SN1, SN2, SN3) y espesores minimos AASHTO.
- Transito con factor de dano propio por tipo de vehiculo (flexible y rigido).
- CBR de subrasante como dato; pt y delta PSI coherentes (delta PSI = p0 - pt).
- Z_R interpolado para cualquier confiabilidad; avisos cuando el calculo no converge.
- Nuevo modulo de geotextiles AASHTO M288-00: clase segun CBR y condiciones de instalacion,
  tablas de resistencia y filtracion, traslapes (Tabla A1) y notas normativas.
- Escena animada ampliada, con capas a escala y vehiculos mas rapidos.
- Informe tecnico con logo, listo para imprimir o guardar como PDF.

Para publicar:
1. Subir todo el contenido de esta carpeta a un repositorio de GitHub (index.html en la raiz).
2. Activar GitHub Pages desde Settings > Pages.
3. Reemplazar TU-DOMINIO.com en robots.txt y sitemap.xml por el dominio real.
4. Registrar el sitio en Google Search Console y enviar /sitemap.xml.

Pendiente de verificar: las Tablas 5 y 6 de M288 estan marcadas en pantalla como "pendientes de
verificar contra el PDF de la norma". Se usa la edicion M288-00; existen M288-06 y M288-17.

Nota: herramienta academica/referencial. Verifique los resultados antes de cualquier uso profesional.
