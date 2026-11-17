const ExcelJS=require('exceljs');const fs=require('fs');
const tags=['Throughput_MMSCFD','Suction_Pressure_psig','Discharge_Pressure_psig','RPM','Slug_Catcher_Level_pct'];
const display=['Throughput','Suction pressure','Discharge pressure','RPM','Slug catcher level'],units=['MMSCFD','psig','psig','rpm','%'],section=['THR','SUC','DIS','RPM','SCL'];
const checks=[
 'Compare flow indication, valve lineup, and operating load.',
 'Check supply pressure, filter restriction, and transmitter indication.',
 'Compare local pressure indication; check downstream backpressure and valve lineup.',
 'Compare speed indication with controller command; review driver/governor status.',
 'Verify level indication and controller/dump valve feedback; follow site high-level procedure.'
];
async function main(){const wb=new ExcelJS.Workbook();await wb.xlsx.readFile('outputs/PCA_Results.xlsx');const stations=[];
 for(let n=1;n<=10;n++){const id=`COMP-${String(n).padStart(2,'0')}`,ws=wb.getWorksheet(id),m=ws.getSheetValues();let latest=null,trend=[];
  for(let r=13;r<=ws.rowCount;r++){if(ws.getCell(r,2).value!=='monitoring')continue;let item={timestamp:ws.getCell(r,1).value.toISOString(),values:tags.map((_,j)=>ws.getCell(r,3+j).value),contrib:tags.map((_,j)=>ws.getCell(r,8+j).value),t2:ws.getCell(r,13).value,t2Limit:ws.getCell(r,14).value,q:ws.getCell(r,15).value,qLimit:ws.getCell(r,16).value};latest=item;trend.push(item);}
  const ranking=latest.contrib.map((value,j)=>({j,value,tag:tags[j],name:display[j],unit:units[j],sectionId:`${id}-${section[j]}-01`,check:checks[j]})).sort((a,b)=>b.value-a.value);
  stations.push({id,timestamp:latest.timestamp,values:tags.map((tag,j)=>({tag,label:display[j],unit:units[j],value:latest.values[j]})),t2:latest.t2,t2Limit:latest.t2Limit,q:latest.q,qLimit:latest.qLimit,alert:latest.t2>latest.t2Limit||latest.q>latest.qLimit,contributors:ranking.slice(0,3),trend:trend.slice(-24).map(x=>({timestamp:x.timestamp,values:x.values,t2:x.t2,q:x.q}))});
 }
 fs.mkdirSync('web/data',{recursive:true});fs.writeFileSync('web/data/stations.json',JSON.stringify({generatedFrom:'PCA_Results.xlsx',synthetic:true,stations},null,2));console.log(`Exported ${stations.length} model-based station snapshots (answer key not opened).`);
}
main().catch(e=>{console.error(e);process.exit(1)});
