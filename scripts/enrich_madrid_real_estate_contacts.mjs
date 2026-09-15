import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const base = "/Users/facundoa.lopezgordillo/Documents/Facundo/Proyectos/crm-ares/outputs/01a0a10a-30fc-7db3-8080-015b1e9f8467";
const inputPath = `${base}/inmobiliarias_madrid_contactos_tanda_01.xlsx`;
const outputPath = `${base}/inmobiliarias_madrid_correos_directos.xlsx`;
const previewPath = `${base}/inmobiliarias_madrid_correos_directos.png`;

const directorySource = "https://www.mejoresinmobiliarias.es/ciudad/madrid";
const E = (email, web, source = web, note = "Web y contacto público verificados") => ({ email, web, source, note });
const enrich = {
  "31Real Servicios Inmobiliarios": E("info@31real.com", "https://www.31real.com/", "https://www.31real.com/contacto/"),
  "Activo Residencial": E("info@activoresidencial.com", "https://www.activoresidencial.com/"),
  "Alquila Direct": E("info@vendedirect.com", "https://www.alquiladirect.com/", "https://www.alquiladirect.com/seccion/company/company/en/", "La web identifica la oficina como Vende Direct; coincide el teléfono y la dirección"),
  "Antilla Grupo Inmobiliario": E("antilla@antilla.es", "https://antilla.es/"),
  "Arteana Inmobiliaria y Reformas": E("info@arteana.com", "https://www.arteana.com/", "https://www.arteana.com/contacto/", "La web oficial indica CP 28009"),
  "Assyss Inmobiliarias": E("assyss@assyss.com", "https://www.assyss.com/", "https://www.assyss.com/site/"),
  "Atlanta Select": E("roxana@atlantaselect.es", "https://www.atlantaselect.es/"),
  "B Homing": E("No localizado", "No localizada", directorySource, "No se encontró una web oficial inequívoca que coincida con teléfono y dirección"),
  "Bon Lar": E("retiro@bonlar.com", "https://bonlar.com/", "https://bonlar.com/contact/", "Correo de la oficina Retiro, que coincide con el teléfono"),
  "Comprarcasa Tengo Piso Arcentales": E("info@tengopisoarcentales.com", "https://www.tengopisoarcentales.com/"),
  "Consorcio Real Estate Opera": E("laura.opera@consorciorealestate.com", "https://www.consorciorealestateopera.com/"),
  "DS Realtors": E("info@dsrealtors.es", "https://www.dsrealtors.es/"),
  "Estudio Home Madrid": E("estudio@ehomemadrid.com", "https://ehomemadrid.com/", "https://ehomemadrid.com/contacto/"),
  "Eurollave Inmobiliaria": E("info@eurollave.es", "https://www.eurollave.es/"),
  "Expohabitat Servicios Inmobiliarios": E("No localizado", "No localizada", directorySource, "No se encontró una web oficial inequívoca que coincida con el teléfono"),
  "Extra Inmobiliaria": E("info@inmobiliariaextra.com", "https://inmobiliariaextra.es/", "https://inmobiliariaextra.es/oficinas-extra/"),
  "Ficasa": E("barriodelpilar@ficasa.es", "https://ficasa.es/", "https://ficasa.es/contacto", "Correo de la oficina Barrio del Pilar"),
  "GoldHouse": E("info@goldhouse.es", "https://goldhouse.es/", "https://goldhouse.es/alquileres/"),
  "Grupo GESPAIN Aluche": E("campamento@grupogespain.com", "https://www.grupogespain.com/"),
  "Grupo GESPAIN Las Águilas": E("lasaguilas@grupogespain.com", "https://www.grupogespain.com/"),
  "Grupo GESPAIN Parque Europa": E("info@grupogespain.com", "https://www.grupogespain.com/"),
  "Häuser Atelier": E("info@hauseratelier.com", "https://www.hauseratelier.com/"),
  "Hauzz Real Estate": E("kwprime@kwspain.es", "https://www.kwspain.es/", "https://www.kwspain.es/", "El teléfono histórico coincide con Keller Williams Prime; posible cambio de marca"),
  "Home Action": E("home@homeaction.es", "https://homeaction.es/", "https://homeaction.es/agency/"),
  "House Hounting": E("info@hhinmuebles.com", "https://househunting.es/", "https://househunting.es/contacto/", "Nombre corregido en la web: House Hunting"),
  "Iceberg Inmobiliaria": E("Formulario en la web", "https://www.iceberginmobiliaria.com/", "https://www.iceberginmobiliaria.com/politica-privacidad.html", "La web y su política de privacidad no publican una dirección de correo; contacto mediante formulario o teléfono"),
  "Infocasa Consulting": E("info@casassg.com", "https://www.infocasaconsulting.com/"),
  "Inmobiliaria 2021 Prosperidad": E("No publicado", "https://www.inmo2021.com/", "https://empresite.eleconomista.es/INMOBILIARIA-2021-PROSPERIDAD.html", "La sociedad figura extinguida desde 2025; web histórica"),
  "Inmobiliaria Eduardo Molet": E("info@eduardomolet.com", "https://www.eduardomolet.com/"),
  "Inmobiliaria Extra": E("info@inmobiliariaextra.com", "https://inmobiliariaextra.es/", "https://inmobiliariaextra.es/oficinas-extra/", "Misma red que Extra Inmobiliaria; oficina Colombia"),
  "Inmobiliaria Ham": E("administracion@inmobiliariaham.es", "https://inmobiliariaham.es/"),
  "Inmobiliaria Transparente": E("hola@inmotransparente.com", "https://inmotransparente.com/", "https://inmotransparente.com/contacto/"),
  "Inmobiliarias Encuentro": E("castellana@iencuentro.es", "https://iencuentro.es/", "https://iencuentro.es/nosotros/red-de-agencias/", "Correo de la oficina Castellana/Serrano"),
  "Inmosai": E("info@inmosai.es", "https://www.inmosai.com/"),
  "Inmuga Homes": E("info@inmuga.com", "https://www.inmuga.com/"),
  "Keller Williams One": E("kwone@kwspain.es", "https://www.kwspain.es/"),
  "Link Casa": E("info@linkcasa.es", "https://www.linkcasa.es/"),
  "MadPiso": E("agarrido@madpiso.es", "https://www.madpiso.es/"),
  "Noow Classic Team": E("adelinam.oancea@noow.es", "https://www.classic-team.es/", "https://www.classic-team.es/agentes-inmobiliarios-madrid-noow/", "Correo de la responsable cuyo teléfono coincide con la ficha"),
  "Properties Investment": E("info@pipropertiesinvestment.com", "https://pipropertiesinvestment.com/", "https://pipropertiesinvestment.com/", "La web actual de PI Properties Investment publica la sede de Madrid en Paseo de la Castellana 77 y este correo general"),
  "Real Home Madrid": E("info@rhmadrid.es", "https://www.rhmadrid.es/"),
  "Remax Dreams": E("info@asihogar.es", "https://www.asihogar.es/", "https://www.asihogar.es/lopd/", "Actualmente figura como Así Hogar; coincide el teléfono y la ubicación"),
  "Rolma Servicios Inmobiliarios": E("info@inmorolma.com", "https://www.inmorolma.com/", "https://www.inmorolma.com/contacto/", "La web actual indica C. Castrojeriz, 26"),
  "Tegeisa": E("viana@tegeisa.com", "https://inmobiliariategeisa.com/", "https://inmobiliariategeisa.com/oficinas/", "Correo de la oficina central de Atocha"),
  "Torre Ñ Inmobiliaria": E("info@torreninmobiliaria.com", "https://www.torreninmobiliaria.com/"),
  "TorresRubí Gestión Inmobiliaria": E("inmobiliaria@torresrubi.com", "https://www.torresrubi.com/"),
  "Tucasamadrid.com": E("info@tucasamadrid.com", "https://www.tucasamadrid.com/", "https://www.tucasamadrid.com/contactar", "La web actual publica otra oficina y el teléfono 699 316 274"),
  "Viancasa": E("info@viancasa.es", "https://www.viancasa.es/"),
  "Vivienda Europa": E("info@viviendaeuropa.es", "https://www.viviendaeuropa.es/", "https://www.viviendaeuropa.es/propiedades/", "Correo directo publicado en la cabecera y en la sección de contacto de la web oficial"),
  "Vivienda Joven": E("comercial@viviendajoven.es", "https://www.viviendajoven.com/", "https://www.viviendajoven.com/agents/"),
  "Wallestate Inmobiliaria": E("info@wallestate.es", "https://wallestate.es/", "https://wallestate.es/contacte-con-nosotros/"),
  "WeGet Inmobiliaria": E("info@wegetinmobiliaria.com", "https://www.wegetinmobiliaria.com/", "https://wgi.es/blog/sorteo-5-aniversario-de-weget/"),
  "YM Inmobiliaria": E("info@yminmobiliaria.es", "https://www.yminmobiliaria.es/"),
  "Zome Madrid": E("madrid@zome.es", "https://www.zome.es/es/business/madrid"),
  "La Casa Agency Punto Atocha": E("28045b@lacasa.net", "https://www.lacasa.net/inmobiliarias/134-punto-atocha-s-l"),
  "La Casa Agency Vistabonita Real Estate": E("info@lacasa.net", "https://www.lacasapremium.com/inmobiliarias/"),
  "ViviendaCapital": E("inmo@viviendacapital.com", "https://viviendacapital.com/", "https://viviendacapital.com/contacto/"),
  "MQ Propiedades": E("comercial@mqpropiedades.com", "https://mqpropiedades.com/"),
};

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const old = workbook.worksheets.getItem("Contactos");
const original = await old.getRange("A6:H63").values;

const sheet = workbook.worksheets.add("Correos directos");
old.delete();
sheet.showGridLines = false;
sheet.tabColor = "#2F6B4F";
sheet.mergeCells("A2:F2");
sheet.mergeCells("A3:F3");
sheet.getRange("A2").values = [["Inmobiliarias de Madrid — correos directos"]];
sheet.getRange("A3").values = [["Esta hoja incluye exclusivamente contactos con una dirección de correo pública y verificada."]];
sheet.getRange("A5:F5").values = [["Inmobiliaria","Correo electrónico","Teléfono","Web oficial","Dirección","Fuente de verificación"]];

const data = original.map((row) => {
  const [n, name, address, cp, city, phone] = row;
  const x = enrich[name] || E("No localizado", "No localizada", directorySource, "Pendiente de verificación");
  return [n, name, address, cp, city, phone, x.email, x.web, x.note, x.source];
});
const direct = data
  .filter((row) => typeof row[6] === "string" && row[6].includes("@"))
  .map((row) => [row[1], row[6], row[5], row[7], `${row[2]}, ${row[3]} ${row[4]}`, row[9]]);
sheet.getRange(`A6:F${5 + direct.length}`).values = direct;
sheet.tables.add(`A5:F${5 + direct.length}`, true, "CorreosMadridVerificados").style = "TableStyleMedium4";
sheet.freezePanes.freezeRows(5);
sheet.freezePanes.freezeColumns(1);

sheet.getRange(`A2:F${5 + direct.length}`).format.font = { name: "Arial", size: 10, color: "#222222" };
sheet.getRange("A2").format.font = { name: "Arial", size: 15, bold: true, color: "#1F1F1F" };
sheet.getRange("A3").format.font = { name: "Arial", size: 10, italic: true, color: "#666666" };
sheet.getRange("A2:F2").format.borders = { bottom: { style: "medium", color: "#2F6B4F" } };
sheet.getRange("A5:F5").format = { fill: "#2F6B4F", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
sheet.getRange(`A6:F${5 + direct.length}`).format.verticalAlignment = "middle";
sheet.getRange(`A6:F${5 + direct.length}`).format.wrapText = true;

const widths = { A: 34, B: 34, C: 20, D: 40, E: 52, F: 54 };
for (const [col, width] of Object.entries(widths)) sheet.getRange(`${col}:${col}`).format.columnWidth = width;
sheet.getRange("2:2").format.rowHeight = 25;
sheet.getRange("3:3").format.rowHeight = 28;
sheet.getRange("5:5").format.rowHeight = 38;
sheet.getRange(`6:${5 + direct.length}`).format.rowHeight = 38;

const withDirectEmail = data.filter((r) => typeof r[6] === "string" && r[6].includes("@")).length;
const withForm = data.filter((r) => r[6] === "Formulario en la web").length;
const unresolved = data.filter((r) => r[6] === "No localizado" || r[6] === "No publicado").length;
sheet.getRange("H2:I3").values = [
  ["Resumen", "Cantidad"],
  ["Correos directos", withDirectEmail],
];
sheet.getRange("H2:I2").format = { fill: "#2F6B4F", font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" } };
sheet.getRange("H3:I3").format.font = { name: "Arial", size: 10 };
sheet.getRange("H2:I3").format.autofitColumns();

workbook.recalculate();
const check = await workbook.inspect({ kind: "table", range: "Correos directos!A2:F15", include: "values,formulas", tableMaxRows: 15, tableMaxCols: 6 });
console.log(check.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson);

await fs.mkdir(base, { recursive: true });
const preview = await workbook.render({ sheetName: "Correos directos", range: "A2:F16", scale: 1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, previewPath, rows: data.length, withDirectEmail, withForm, unresolved }));
