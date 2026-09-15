import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/facundoa.lopezgordillo/Documents/Facundo/Proyectos/crm-ares/outputs/01a0a10a-30fc-7db3-8080-015b1e9f8467";
const outputPath = `${outputDir}/idealista_madrid_larga_estancia_tanda_01.xlsx`;
const previewPath = `${outputDir}/idealista_madrid_larga_estancia_tanda_01.png`;

const rows = [
  [1,"Piso","Calle de Edgar Neville","Cuatro Caminos",1500,1,64,"4ª","Interior","Sí","Incluido","Zona Nuevos Ministerios; casi vacío","108301005"],
  [2,"Ático","Calle de Zurbano","Almagro",4500,3,152,"9ª","Interior","Sí","Opcional 200 €/mes","Sin amueblar; aire acondicionado; no estudiantes","112504689"],
  [3,"Piso","Casco Histórico de Barajas","Casco Histórico de Barajas",950,1,55,"1ª","Exterior","No","No indicado","Amueblado; trastero; aire acondicionado","112548575"],
  [4,"Ático","Calle de Fray Luis de León, 8","Palos de la Frontera",1280,1,40,"4ª","Exterior","No","No indicado","Amueblado; terraza y balcón; no admite mascotas","90827683"],
  [5,"Piso","Calle Entrepeñas","Ensanche de Vallecas - La Gavia",1190,3,110,"1ª","Exterior","Sí","Incluido","Buen estado; vivienda familiar","86540742"],
  [6,"Estudio","Calle del Marqués de la Ensenada","Chueca-Justicia",1375,0,40,"4ª","Interior","Sí","No indicado","Amueblado; calefacción y aire incluidos","93873147"],
  [7,"Piso","Plaza Liceo","Conde Orgaz-Piovera",1350,1,68,"3ª","Exterior","Sí","Incluido","Urbanización con piscina, jardín y gimnasio","82480435"],
  [8,"Piso","Paseo de La Habana, 169","Nueva España",2500,2,100,"1ª","Exterior","Sí","Incluido","Amueblado; cocina equipada; aire acondicionado","110213463"],
  [9,"Piso","Calle de Luisa Fernanda, 25","Argüelles",1750,1,70,"3ª","Interior","Sí","Opcional 100 €/mes","Particular; reformado y amueblado","94064025"],
  [10,"Piso","Calle de la Montera","Sol",1800,1,82,"2ª","Exterior","Sí","No indicado","Amueblado; terraza y balcón; aire acondicionado","100556203"],
  [11,"Ático","Calle Torrelaguna, 106","Colina",1495,1,67,"6ª","Exterior","Sí","Incluido","Amueblado; luminoso y silencioso","1899693"],
  [12,"Piso","Avenida de Alberto Alcocer","Bernabéu-Hispanoamérica",3500,4,174,"6ª","Exterior","Sí","Incluido","Piso amplio para familia","111903783"],
  [13,"Piso","Calle de Cea Bermúdez","Arapiles",1800,2,75,"Bajo","Exterior","Sí","No indicado","Vivienda céntrica y luminosa","112548407"],
  [14,"Piso","Calle de Alfonso X","Almagro",2850,2,77,"1ª","Exterior","Sí","No indicado","Sin amueblar; buen estado","112164496"],
  [15,"Piso","Calle de Julio Palacios","La Paz",2500,3,139,"11ª","Exterior","Sí","Incluido","Amueblado; terraza y piscina","112548416"],
  [16,"Piso","Calle de Evaristo San Miguel","Argüelles",3690,3,140,"4ª","Exterior","Sí","Opcional 250 €/mes","Obra nueva; piscina y gimnasio","110509405"],
  [17,"Piso","Calle de Ponzano","Nuevos Ministerios-Ríos Rosas",2800,2,92,"3ª","Exterior","Sí","No indicado","Disponible desde la segunda semana de octubre de 2026","112548397"],
  [18,"Piso","Calle de la Academia, 8","Jerónimos",2500,1,51,"7ª","Exterior","Sí","No indicado","Amueblado; terraza; no admite mascotas","111832795"],
  [19,"Estudio","Calle de Antonio Zamora","Puerta del Ángel",1300,0,32,"3ª","Exterior","No","No indicado","Requiere documentación de solvencia","105185150"],
  [20,"Piso","Calle de Serrano Anguita","Chueca-Justicia",3000,5,143,"2ª","Exterior","Sí","No indicado","Piso señorial amplio","111915565"],
  [21,"Piso","Calle de Orense","Cuzco-Castillejos",2400,3,126,"4ª","Exterior","Sí","Opcional 100 €/mes","Sin amueblar; reformado; aire acondicionado","112548136"],
  [22,"Piso","Castellana","Castellana",8500,4,160,"No indicada","Exterior","No","No indicado","Vivienda de lujo a estrenar","110509822"],
  [23,"Piso","Recoletos","Recoletos",4000,2,130,"6ª","Exterior","Sí","No indicado","Opción amueblado por 4.500 €/mes","112548096"],
  [24,"Piso","Calle Ardales","Aravaca",3300,3,218,"Bajo","Exterior","Sí","Incluido","Terraza y jardín","111677667"],
  [25,"Piso","Calle del Poeta Joan Maragall, 51","Cuzco-Castillejos",1100,1,54,"19ª","Exterior","Sí","No indicado","Muy luminoso; vistas panorámicas","112547688"],
  [26,"Piso","Paseo del Pintor Rosales","Argüelles",13995,6,360,"1ª","Exterior","Sí","Incluido","Amueblado; terrazas; admite mascotas","106843213"],
  [27,"Piso","Calle de Isaac Peral, 40","Gaztambide",1700,1,126,"8ª","Exterior","Sí","Opcional 100 €/mes","Piscina y vistas","112547756"],
  [28,"Piso","Calle del Doctor Drumen","Lavapiés-Embajadores",3200,4,114,"1ª","Exterior","Sí","No indicado","Amueblado; apto para compartir","111079282"],
  [29,"Piso","Calle de la Cruz del Sur, 12","Estrella",1900,2,90,"6ª","Exterior","Sí","Incluido","Amueblado; reformado en 2021","112547569"],
  [30,"Piso","Goya","Goya",16000,5,366,"1ª","Exterior","Sí","Incluido","Amueblado; vivienda de lujo","109775128"],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Pisos");
sheet.showGridLines = false;
sheet.tabColor = "#1F4E78";

sheet.mergeCells("A2:Q2");
sheet.mergeCells("A3:Q3");
sheet.getRange("A2").values = [["Idealista: alquiler de larga estancia en Madrid — tanda 01"]];
sheet.getRange("A3").values = [["Datos públicos visibles el 14/09/2026. La búsqueda mostraba 6.823 viviendas. Teléfonos y correos no quedaron accesibles por la verificación del sitio."]];
sheet.getRange("A5:Q5").values = [["Nº","Tipo","Dirección / zona","Barrio","Precio €/mes","Habitaciones","m²","€/m²","Planta","Orientación","Ascensor","Garaje","Datos destacados","Teléfono","Email","ID anuncio","Enlace"]];

const data = rows.map(r => [
  ...r.slice(0,7), null, ...r.slice(7,12),
  "No recuperado; consultar anuncio",
  "No publicado",
  r[12],
  `https://www.idealista.com/inmueble/${r[12]}/`,
]);
sheet.getRange(`A6:Q${5 + data.length}`).values = data;
sheet.getRange("H6").formulas = [["=E6/G6"]];
sheet.getRange(`H6:H${5 + data.length}`).fillDown();

sheet.tables.add(`A5:Q${5 + data.length}`, true, "PisosMadridTanda01").style = "TableStyleMedium2";
sheet.freezePanes.freezeRows(5);
sheet.freezePanes.freezeColumns(4);

sheet.getRange("A2:Q35").format.font = { name: "Arial", size: 10, color: "#222222" };
sheet.getRange("A2").format.font = { name: "Arial", size: 15, bold: true, color: "#1F1F1F" };
sheet.getRange("A3").format.font = { name: "Arial", size: 10, italic: true, color: "#666666" };
sheet.getRange("A2:Q2").format.borders = { bottom: { style: "medium", color: "#1F4E78" } };
sheet.getRange("A5:Q5").format = { fill: "#1F4E78", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
sheet.getRange("A6:Q35").format.verticalAlignment = "top";
sheet.getRange("M6:O35").format.wrapText = true;
sheet.getRange("E6:E35").format.numberFormat = "#,##0 [$€-es-ES]";
sheet.getRange("F6:G35").format.numberFormat = "#,##0";
sheet.getRange("H6:H35").format.numberFormat = "0.00 [$€-es-ES]";
sheet.getRange("A5:Q35").format.autofitColumns();
sheet.getRange("A5:Q35").format.autofitRows();

const widths = {A:6,B:11,C:30,D:25,E:14,F:12,G:9,H:10,I:11,J:12,K:10,L:19,M:40,N:27,O:15,P:13,Q:43};
for (const [col,width] of Object.entries(widths)) sheet.getRange(`${col}:${col}`).format.columnWidth = width;
sheet.getRange("2:2").format.rowHeight = 25;
sheet.getRange("3:3").format.rowHeight = 30;
sheet.getRange("5:5").format.rowHeight = 32;
sheet.getRange("M6:M35").format.rowHeight = 36;

sheet.getRange("E6:H35").conditionalFormats.add("colorScale", {
  colors: ["#E2F0D9", "#FFF2CC", "#F4CCCC"], thresholds: ["min", {type:"percentile", value:50}, "max"]
});

sheet.getRange("S2:T4").values = [
  ["Resumen", "Valor"],
  ["Anuncios en esta tanda", data.length],
  ["Oferta total mostrada", 6823],
];
sheet.getRange("S2:T2").format = { fill: "#1F4E78", font: { name:"Arial", size:10, bold:true, color:"#FFFFFF" } };
sheet.getRange("S3:T4").format.font = { name:"Arial", size:10 };
sheet.getRange("S2:T4").format.autofitColumns();
sheet.getRange("S3:T4").format.borders = { preset:"inside", style:"thin", color:"#D9E2F3" };

sheet.getRange("S6:T8").values = [
  ["Fuente", "Idealista"],
  ["Búsqueda", "https://www.idealista.com/alquiler-viviendas/madrid-madrid/con-alquiler-de-larga-temporada/"],
  ["Fecha de consulta", new Date("2026-09-14T00:00:00Z")],
];
sheet.getRange("S6:S8").format.font = { name:"Arial", size:10, bold:true };
sheet.getRange("T6:T8").format.font = { name:"Arial", size:10 };
sheet.getRange("T8").format.numberFormat = "dd/mm/yyyy";
sheet.getRange("S6:T8").format.autofitColumns();
sheet.getRange("T7").format.columnWidth = 65;

workbook.recalculate();
const check = await workbook.inspect({ kind:"table", range:"Pisos!A2:Q12", include:"values,formulas", tableMaxRows:12, tableMaxCols:17 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind:"match", searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options:{useRegex:true,maxResults:100}, summary:"final formula error scan" });
console.log(errors.ndjson);

await fs.mkdir(outputDir, { recursive:true });
const preview = await workbook.render({ sheetName:"Pisos", range:"A2:Q18", scale:1, format:"png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({outputPath, previewPath}));
