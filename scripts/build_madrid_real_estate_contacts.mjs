import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/facundoa.lopezgordillo/Documents/Facundo/Proyectos/crm-ares/outputs/01a0a10a-30fc-7db3-8080-015b1e9f8467";
const outputPath = `${outputDir}/inmobiliarias_madrid_contactos_tanda_01.xlsx`;
const previewPath = `${outputDir}/inmobiliarias_madrid_contactos_tanda_01.png`;
const directorySource = "https://www.mejoresinmobiliarias.es/ciudad/madrid";
const agencyDirectorySource = "https://agenciasinmobiliarias.com.es/";

const rows = [
 ["31Real Servicios Inmobiliarios","C/ La Hiruela, 5, local 5","28035","910 52 34 97","",directorySource],
 ["Activo Residencial","C/ Velázquez, 104","28006","915 138 603","",directorySource],
 ["Alquila Direct","C/ Blasco de Garay, 42","28015","912 779 439","",directorySource],
 ["Antilla Grupo Inmobiliario","C/ Fermín Caballero, 64","28034","91 587 95 59","",directorySource],
 ["Arteana Inmobiliaria y Reformas","C/ Alcalde Sainz de Baranda, 62","28003","914 009 308","",directorySource],
 ["Assyss Inmobiliarias","C/ Fernando El Católico, 44","28015","914 464 732","",directorySource],
 ["Atlanta Select","C/ María de Molina, 54, 5ª planta","28006","665 345 684","",directorySource],
 ["B Homing","C/ Jaén, 14","28991","673 577 265","",directorySource],
 ["Bon Lar","C/ Cavanilles, 29","28007","915 011 010","",directorySource],
 ["Comprarcasa Tengo Piso Arcentales","Avda. de Canillejas a Vicálvaro, 57","28022","913 717 548","",directorySource],
 ["Consorcio Real Estate Opera","Plaza de la Marina Española, 4, bajo local 3","28013","915 937 927","",directorySource],
 ["DS Realtors","C/ Núñez de Balboa, 35A, 5ª oficina A1","28001","918 271 079","",directorySource],
 ["Estudio Home Madrid","C/ Fermín Caballero, 76, local S","28034","91 378 39 37","",directorySource],
 ["Eurollave Inmobiliaria","C/ Gabriel Usera, 25","28026","913 920 202","",directorySource],
 ["Expohabitat Servicios Inmobiliarios","C/ Marqués de Zafra, 25, local","28028","674 573 143","",directorySource],
 ["Extra Inmobiliaria","C/ Reina Mercedes, 16","28020","912 203 885","",directorySource],
 ["Ficasa","Avda. de Betanzos, 52","28029","911 620 474","",directorySource],
 ["GoldHouse","Avda. de Oporto, 21","28019","918 33 75 88","",directorySource],
 ["Grupo GESPAIN Aluche","C/ Tembleque, 111","28024","915 099 717","",directorySource],
 ["Grupo GESPAIN Las Águilas","C/ José de Cadalso, 53","28044","911 377 269","",directorySource],
 ["Grupo GESPAIN Parque Europa","C/ Fuente de Lima, 19, local B","28024","917 060 416","",directorySource],
 ["Häuser Atelier","C/ Goya, 115, 2ª planta, oficina 217","28009","911 44 63 17","",directorySource],
 ["Hauzz Real Estate","C/ María de Molina, 39, 3ª planta","28006","914 311 630","",directorySource],
 ["Home Action","C/ Modesto Lafuente, 45","28003","91 022 83 53","",directorySource],
 ["House Hounting","C/ Vallehermoso, 40","28015","91 758 73 50","",directorySource],
 ["Iceberg Inmobiliaria","C/ Ponzano, 69-71","28003","912 195 251","",directorySource],
 ["Infocasa Consulting","C/ Doctor Esquerdo, 165","28007","911 610 726","",directorySource],
 ["Inmobiliaria 2021 Prosperidad","C/ Clara del Rey, 5","28002","914 163 319","",directorySource],
 ["Inmobiliaria Eduardo Molet","C/ Fernando el Católico, 19, local","28015","915 912 901","",directorySource],
 ["Inmobiliaria Extra","C/ Colombia, 2","28016","91 220 38 85","",directorySource],
 ["Inmobiliaria Ham","C/ Sánchez Barcáiztegui, 36","28007","722 616 216","",directorySource],
 ["Inmobiliaria Transparente","C/ San Bernardo, 5, local 10","28013","914 44 02 10","",directorySource],
 ["Inmobiliarias Encuentro","C/ Serrano, 81","28006","91 819 96 72","",directorySource],
 ["Inmosai","C/ General Ricardos, 74","28031","911 680 354","",directorySource],
 ["Inmuga Homes","C/ Galileo, 89","28003","914 539 441","",directorySource],
 ["Keller Williams One","C/ Marqués del Riscal, 6, 1º B","28010","912 368 000","",directorySource],
 ["Link Casa","C/ General Ricardos, 85","28019","910 533 844","",directorySource],
 ["MadPiso","C/ Alcalá, 196","28028","914 224 166","",directorySource],
 ["Noow Classic Team","C/ Cristóbal Bordiú, 22","28030","639 135 039","",directorySource],
 ["Properties Investment","Paseo de la Castellana, 77","28046","691 480 123","",directorySource],
 ["Real Home Madrid","C/ Mayor, 4, planta 3ª, oficina 10","28013","910 867 436","",directorySource],
 ["Remax Dreams","C/ López de Hoyos, 344","28043","916 087 602","",directorySource],
 ["Rolma Servicios Inmobiliarios","Paseo Marcelino Camacho, 16","28025","91 166 83 84","",directorySource],
 ["Tegeisa","C/ Atocha, 89","28012","914 20 14 26","",directorySource],
 ["Torre Ñ Inmobiliaria","C/ Ponts de Molins, 27","28038","910 018 149","",directorySource],
 ["TorresRubí Gestión Inmobiliaria","C/ San Claudio, 27, local 3","28038","913 03 63 55","inmobiliaria@torresrubi.com",agencyDirectorySource],
 ["Tucasamadrid.com","C/ Estela, 3-11","28050","914 898 223","",directorySource],
 ["Viancasa","C/ Bocángel, 48, local","28028","917 554 863","",directorySource],
 ["Vivienda Europa","C/ Doctor Esquerdo, 124","28007","914 374 921","",directorySource],
 ["Vivienda Joven","Paseo de Extremadura, 62","28011","914 645 440","",directorySource],
 ["Wallestate Inmobiliaria","C/ El Algabeño, 55, local 7","28043","91 237 75 88","",directorySource],
 ["WeGet Inmobiliaria","Av. Cardenal Herrera Oria, 169","28034","689 922 008","",directorySource],
 ["YM Inmobiliaria","C/ Ferrocarril, 14","28045","681 177 251","",directorySource],
 ["Zome Madrid","Paseo de la Habana, 5","28036","911 04 97 97","",directorySource],
 ["La Casa Agency Punto Atocha","Paseo de las Delicias, 45, local D","28045","910 933 081","28045b@lacasa.net",agencyDirectorySource],
 ["La Casa Agency Vistabonita Real Estate","Av. de Nuestra Señora de Fátima, 13","28047","910 60 97 76","info@lacasa.net",agencyDirectorySource],
 ["ViviendaCapital","C/ Manuela Malasaña, 16","28004","914 45 05 30","inmo@viviendacapital.com","https://viviendacapital.com/contacto/"],
 ["MQ Propiedades","C/ Sarria, 56","28029","679 05 66 14 / 91 736 58 23","comercial@mqpropiedades.com","https://mqpropiedades.com/"],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Contactos");
sheet.showGridLines = false;
sheet.tabColor = "#1F4E78";
sheet.mergeCells("A2:H2");
sheet.mergeCells("A3:H3");
sheet.getRange("A2").values = [["Inmobiliarias de Madrid con teléfono — tanda 01"]];
sheet.getRange("A3").values = [["Contactos públicos consultados el 14/09/2026. Conviene confirmar los datos antes de una campaña o visita."]];
sheet.getRange("A5:H5").values = [["Nº","Inmobiliaria","Dirección","CP","Ciudad","Teléfono","Email público","Fuente"]];
const data = rows.map((r,i)=>[i+1,r[0],r[1],r[2],"Madrid",r[3],r[4] || "No publicado",r[5]]);
sheet.getRange(`A6:H${5+data.length}`).values = data;
sheet.tables.add(`A5:H${5+data.length}`,true,"ContactosInmobiliariasMadrid").style="TableStyleMedium2";
sheet.freezePanes.freezeRows(5);
sheet.freezePanes.freezeColumns(2);

sheet.getRange(`A2:H${5+data.length}`).format.font={name:"Arial",size:10,color:"#222222"};
sheet.getRange("A2").format.font={name:"Arial",size:15,bold:true,color:"#1F1F1F"};
sheet.getRange("A3").format.font={name:"Arial",size:10,italic:true,color:"#666666"};
sheet.getRange("A2:H2").format.borders={bottom:{style:"medium",color:"#1F4E78"}};
sheet.getRange("A5:H5").format={fill:"#1F4E78",font:{name:"Arial",size:10,bold:true,color:"#FFFFFF"},horizontalAlignment:"center",verticalAlignment:"center",wrapText:true};
sheet.getRange(`A6:H${5+data.length}`).format.verticalAlignment="middle";
sheet.getRange(`B6:C${5+data.length}`).format.wrapText=true;
sheet.getRange(`G6:G${5+data.length}`).conditionalFormats.add("containsText",{text:"No publicado",format:{fill:"#FFF2CC",font:{color:"#7F6000"}}});
sheet.getRange(`G6:G${5+data.length}`).conditionalFormats.add("notContainsText",{text:"No publicado",format:{fill:"#E2F0D9",font:{color:"#375623"}}});
const widths={A:6,B:31,C:40,D:10,E:12,F:27,G:32,H:55};
for(const [col,width] of Object.entries(widths)) sheet.getRange(`${col}:${col}`).format.columnWidth=width;
sheet.getRange("2:2").format.rowHeight=25;
sheet.getRange("3:3").format.rowHeight=22;
sheet.getRange("5:5").format.rowHeight=30;
sheet.getRange(`6:${5+data.length}`).format.rowHeight=29;

sheet.getRange("J2:K5").values=[
  ["Resumen","Cantidad"],
  ["Inmobiliarias con teléfono",data.length],
  ["Con email público",data.filter(r=>r[6]!=="No publicado").length],
  ["Solo teléfono",data.filter(r=>r[6]==="No publicado").length],
];
sheet.getRange("J2:K2").format={fill:"#1F4E78",font:{name:"Arial",size:10,bold:true,color:"#FFFFFF"}};
sheet.getRange("J3:K5").format.font={name:"Arial",size:10};
sheet.getRange("J2:K5").format.autofitColumns();

workbook.recalculate();
const check=await workbook.inspect({kind:"table",range:"Contactos!A2:H14",include:"values,formulas",tableMaxRows:14,tableMaxCols:8});
console.log(check.ndjson);
const errors=await workbook.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",options:{useRegex:true,maxResults:100},summary:"final formula error scan"});
console.log(errors.ndjson);

await fs.mkdir(outputDir,{recursive:true});
const preview=await workbook.render({sheetName:"Contactos",range:"A2:H18",scale:1,format:"png"});
await fs.writeFile(previewPath,new Uint8Array(await preview.arrayBuffer()));
const output=await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({outputPath,previewPath,count:data.length,emails:data.filter(r=>r[6]!=="No publicado").length}));
