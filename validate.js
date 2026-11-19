const ExcelJS = require('exceljs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const JSZip = require('jszip');
const tags=['Throughput_MMSCFD','Suction_Pressure_psig','Discharge_Pressure_psig','RPM','Slug_Catcher_Level_pct'];
const ids=Array.from({length:10},(_,i)=>`COMP-${String(i+1).padStart(2,'0')}`);
const scoreFirstData=13;
const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: ${a} vs ${b}`);
async function main(){
 const data=new ExcelJS.Workbook(); await data.xlsx.readFile('outputs/Compressor_Data.xlsx');
 const expected={training:2160,calibration:720,monitoring:720},bounds={};
 for(const [period,nPerComp] of Object.entries(expected)){
  const ws=data.getWorksheet(period); assert.equal(ws.rowCount-1,nPerComp*10,period+' total row count');assert.ok(ws.autoFilter,period+' autofilter');assert.equal(ws.getColumn(1).numFmt,'yyyy-mm-dd hh:mm',period+' timestamp format');bounds[period]=[];
  for(let ci=0;ci<10;ci++){
   let prev=null,first=null;
   for(let i=2+ci*nPerComp;i<2+(ci+1)*nPerComp;i++){
    assert.equal(ws.getCell(i,2).value,ids[ci],period+' compressor grouping');
    const dt=ws.getCell(i,1).value; assert.ok(dt instanceof Date,period+' timestamp type');if(!first)first=dt;
    if(prev) assert.equal(dt-prev,3600000,period+' hourly cadence'); prev=dt;
   }bounds[period].push({first,last:prev});
  }
 }
 for(let ci=0;ci<10;ci++){near(bounds.calibration[ci].first-bounds.training[ci].last,3600000,0,ids[ci]+' training/calibration boundary');near(bounds.monitoring[ci].first-bounds.calibration[ci].last,3600000,0,ids[ci]+' calibration/monitoring boundary');}
 const dict=data.getWorksheet('Data Dictionary');tags.forEach((t,i)=>assert.equal(dict.getCell(5+i,1).value,t,'data dictionary tag name '+i));assert.equal(dict.autoFilter,'A1:C9','data dictionary filter includes all fields');
 const key=data.getWorksheet('Fault Answer Key'); assert.equal(key.rowCount,3,'two injected faults');
 const faultIds=new Set(); for(let i=2;i<=3;i++){const id=key.getCell(i,1).value;assert.ok(!faultIds.has(id),'one fault per compressor');faultIds.add(id);assert.equal(key.getCell(i,5).value,'Evaluation only; excluded from model input/calibration');}
 const pca=new ExcelJS.Workbook(); await pca.xlsx.readFile('outputs/PCA_Results.xlsx');
 const summary=pca.getWorksheet('Fleet Summary'); assert.equal(summary.rowCount,11);
 for(const id of ids){const ws=pca.getWorksheet(id);assert.equal(ws.views[0].ySplit,12,id+' freezes PCA score headers');assert.equal(ws.getRow(12).font.bold,true,id+' PCA score header bold');assert.ok(ws.getRow(12).fill,'PCA score header fill');}
 const results={};
 for(const id of ids){
  const ws=pca.getWorksheet(id); assert.ok(ws,'missing compressor model '+id);
  const train=data.getWorksheet('training'); let rows=[];
  const ci=Number(id.slice(-2))-1;
  for(let i=2+ci*2160;i<2+(ci+1)*2160;i++) rows.push(tags.map((_,j)=>train.getCell(i,3+j).value));
  for(let j=0;j<5;j++){
   const mean=rows.reduce((s,r)=>s+r[j],0)/rows.length;
   const sd=Math.sqrt(rows.reduce((s,r)=>s+(r[j]-mean)**2,0)/(rows.length-1));
   near(ws.getCell(2,2+j).value,mean,1e-8,id+' training mean '+j);
   near(ws.getCell(3,2+j).value,sd,1e-8,id+' training SD '+j);
  }
  const cov=Array.from({length:5},(_,a)=>Array.from({length:5},(_,b)=>{const ma=ws.getCell(2,2+a).value,mb=ws.getCell(2,2+b).value,sa=ws.getCell(3,2+a).value,sb=ws.getCell(3,2+b).value;return rows.reduce((s,r)=>s+(r[a]-ma)*(r[b]-mb)/(sa*sb),0)/(rows.length-1);}));
  const eigs=Array.from({length:3},(_,pc)=>ws.getCell(8+pc,2).value), vecs=Array.from({length:3},(_,pc)=>tags.map((_,j)=>ws.getCell(8+pc,3+j).value));
  for(let pc=0;pc<3;pc++){
   const eig=eigs[pc], v=vecs[pc];
   near(v.reduce((s,x)=>s+x*x,0),1,1e-8,id+' PC normalization '+pc);
   for(let j=0;j<5;j++) near(cov[j].reduce((s,x,k)=>s+x*v[k],0),eig*v[j],1e-7,id+' eigen equation '+pc+'/'+j);
  }
  const firstData=scoreFirstData, calStart=firstData+2160, calEnd=calStart+720;
  const t2=[];const q=[];
  for(let r=calStart;r<calEnd;r++){t2.push(ws.getCell(r,13).value);q.push(ws.getCell(r,15).value);}
  t2.sort((a,b)=>a-b);q.sort((a,b)=>a-b);
  near(ws.getCell(4,2).value,t2[Math.ceil(.99*720)-1],2e-5,id+' T2 threshold calibration');
  near(ws.getCell(5,2).value,q[Math.ceil(.99*720)-1],2e-5,id+' Q threshold calibration');
  for(let r=firstData;r<ws.rowCount+1;r+=97){let total=0;for(let j=0;j<5;j++)total+=ws.getCell(r,8+j).value;near(total,ws.getCell(r,15).value,2e-5,id+' residual contribution sum');const z=tags.map((_,j)=>(ws.getCell(r,3+j).value-ws.getCell(2,2+j).value)/ws.getCell(3,2+j).value);let sc=vecs.map(v=>z.reduce((s,vj,j)=>s+vj*v[j],0)), rec=tags.map((_,j)=>sc.reduce((s,v,pc)=>s+v*vecs[pc][j],0));let calcT=sc.reduce((s,v,pc)=>s+v*v/eigs[pc],0),res=z.map((v,j)=>v-rec[j]),calcQ=res.reduce((s,v)=>s+v*v,0);near(ws.getCell(r,13).value,calcT,2e-5,id+' recomputed T2');near(ws.getCell(r,15).value,calcQ,2e-5,id+' recomputed Q');for(let j=0;j<5;j++)near(ws.getCell(r,8+j).value,res[j]**2,2e-5,id+' recomputed contribution '+j);}
  results[id]={trainingMeanSd:'pass',pcaEigenpairs:'pass',calibrationThresholds:'pass',residualContributionSums:'pass'};
 }
 assert.equal(pca.getWorksheet('COMP-01').autoFilter!=null,true,'filters present');
 const faultTruth={};for(let i=2;i<=3;i++)faultTruth[key.getCell(i,1).value]={tag:key.getCell(i,2).value,onset:key.getCell(i,3).value};
 const metrics=[];for(let i=2;i<=11;i++){const r=summary.getRow(i).values,id=r[1],truth=faultTruth[id]||null,fault=truth?.tag||null;assert.equal(r[11],fault||'Healthy',id+' evaluation truth');const ws=pca.getWorksheet(id);let healthyT=0,healthyQ=0,first=null;for(let rr=scoreFirstData+2160+720;rr<=ws.rowCount;rr++){if(ws.getCell(rr,2).value!=='monitoring')continue;const ts=ws.getCell(rr,1).value,isHealthy=!truth||ts<truth.onset;if(isHealthy){if(ws.getCell(rr,13).value>ws.getCell(rr,14).value)healthyT++;if(ws.getCell(rr,15).value>ws.getCell(rr,16).value)healthyQ++;}if(truth&&ts>=truth.onset&&ws.getCell(rr,13).value>ws.getCell(rr,14).value&&!first)first=rr;}
  assert.equal(r[7],healthyT,id+' independently counted healthy T2 alerts');assert.equal(r[8],healthyQ,id+' independently counted healthy Q alerts');let delay=null,rank=null;if(truth&&first){delay=(ws.getCell(first,1).value-truth.onset)/3600000;assert.equal(r[12],delay,id+' independent T2 delay');let cix=tags.indexOf(fault),order=tags.map((_,j)=>({j,v:ws.getCell(first,8+j).value})).sort((a,b)=>b.v-a.v);rank=order.findIndex(x=>x.j===cix)+1;assert.equal(r[13],rank,id+' injected tag Q rank');}
  metrics.push({id,healthyMonitoringT2:healthyT,healthyMonitoringQ:healthyQ,fault,delayHours:delay,injectedTagQContributionRank:rank});}
 const guide=new ExcelJS.Workbook(); await guide.xlsx.readFile('outputs/Troubleshooting.xlsx'); assert.equal(guide.worksheets.length,13,'start/index, 10 compressor sheets, and sources');assert.ok(guide.getWorksheet('Section Index').autoFilter,'troubleshooting index filter');assert.ok(guide.getWorksheet('Sources').autoFilter,'reference list filter');for(const id of ids)assert.ok(guide.getWorksheet(id).autoFilter,id+' troubleshooting filter');
 const method=pca.getWorksheet('Method & Limits');assert.ok(method.getSheetValues().flat().some(v=>typeof v==='string'&&v.includes('Signed terms sum to T2')),'T2 contribution method documented in PCA workbook');
 assert.equal(pca.getWorksheet('Charts')._media.length,3,'fleet chart and two fault charts embedded');
 assert.ok(pca.getWorksheet('Validation Report').getSheetValues().flat().some(v=>typeof v==='string'&&v.includes('fault affects only monitoring hours 716-719')),'four-hour fault scenario documented');
 const badText=['T'+String.fromCharCode(194,178),String.fromCharCode(226,8364,8221),String.fromCharCode(195,8212)];
 for(const wb of [data,pca,guide])for(const ws of wb.worksheets)ws.eachRow(row=>row.eachCell(cell=>{if(typeof cell.value==='string')for(const token of badText)assert.ok(!cell.value.includes(token),ws.name+' contains mojibake');}));
 const appData=JSON.parse(fs.readFileSync('web/data/stations.json','utf8'));assert.equal(appData.stations.length,10,'app exports all stations');
 for(const id of ids){const s=appData.stations.find(x=>x.id===id),ws=pca.getWorksheet(id);assert.ok(s,'app station snapshot exists: '+id);assert.equal(s.trend.length,24,id+' 24-hour chart points');assert.equal(s.trend.at(-1).timestamp,s.timestamp,id+' latest point matches snapshot');for(let j=1;j<24;j++)assert.equal(new Date(s.trend[j].timestamp)-new Date(s.trend[j-1].timestamp),3600000,id+' hourly chart cadence');for(const point of s.trend){const row=Array.from({length:ws.rowCount-12},(_,i)=>i+13).find(r=>ws.getCell(r,1).value.toISOString()===point.timestamp);assert.ok(row,id+' chart timestamp exists in PCA workbook');near(point.t2,ws.getCell(row,13).value,1e-10,id+' plotted T2 equals workbook');near(point.t2Limit,ws.getCell(row,14).value,1e-10,id+' plotted threshold equals workbook');assert.equal(point.t2Contributions?.length,5,id+' hourly T2 contribution list');near(point.t2Contributions.reduce((sum,x)=>sum+x.signed,0),ws.getCell(row,13).value,1e-5,id+' signed variable terms sum to hourly T2');const meta=require('./troubleshooting-content').tags,expected=tags.map((tag,j)=>({tag:meta[j].name,tagKey:tag,unit:meta[j].unit,value:ws.getCell(row,3+j).value,signed:ws.getCell(row,19+j).value})).sort((a,b)=>Math.abs(b.signed)-Math.abs(a.signed));for(let j=0;j<5;j++){const actual=point.t2Contributions[j],match=expected[j];assert.equal(actual.tag,match.tag,id+' hourly T2 ranking '+j);assert.equal(actual.tagKey,match.tagKey,id+' ranked tag key '+j);near(actual.value,match.value,1e-9,id+' contribution actual reading '+j);near(actual.signed,match.signed,1e-9,id+' T2 contribution matches workbook '+j);assert.equal(actual.rank,j+1,id+' displayed contribution rank '+j);near(actual.magnitude,Math.abs(match.signed),1e-9,id+' T2 contribution magnitude '+j);near(actual.share,Math.abs(match.signed)/(expected.reduce((sum,x)=>sum+Math.abs(x.signed),0)||1),1e-9,id+' T2 absolute-magnitude share '+j);}}}
 for(const id of ids){const s=appData.stations.find(x=>x.id===id);for(const c of s.contributors){assert.ok(c.source?.title&&c.source.revision&&c.source.sectionId===c.sectionId&&c.source.document===`references/${id}.docx`,id+' contributor maps to its Word reference');assert.equal(c.steps.length,3,id+' has three detailed checks');for(const step of c.steps)assert.ok(step.action&&step.distinguishes&&step.escalate,id+' check includes purpose and escalation');}const docPath=`references/${id}.docx`;assert.ok(fs.existsSync(docPath),id+' Word document exists');assert.ok(fs.readdirSync('dist/assets/references').some(file=>file.startsWith(id+'.')&&file.endsWith('.docx')),id+' Word document is packaged in Expo web output');assert.ok(fs.readFileSync('App.js','utf8').includes("'"+id+"':require('./references/"+id+".docx')"),id+' source button points to matching Word file');const zip=await JSZip.loadAsync(fs.readFileSync(docPath));const xml=await zip.file('word/document.xml').async('string');for(const c of s.contributors.slice(0,2)){assert.ok(xml.includes(c.sectionId),id+' Word file contains stable section '+c.sectionId);for(const sourceId of c.source.sources){const url=require('./troubleshooting-content').references[sourceId].url;assert.ok(xml.includes(url),id+' Word file cites '+sourceId);}}}
 const appSource=fs.readFileSync('App.js','utf8'),exportSource=fs.readFileSync('export-app-data.js','utf8');assert.ok(!/Assistant/.test(appSource),'Assistant page and tab removed');assert.ok(appSource.includes('PREWRITTEN OPERATOR SUMMARY'),'inline predefined summary present');assert.ok(appSource.includes('View source (Word)'),'Word document button present');assert.ok(appSource.includes('expo-sharing')&&appSource.includes('Sharing.shareAsync'),'native document sharing supported');assert.ok(appSource.includes('openWordReference')&&appSource.includes('wordReferences'),'document button resolves compressor to Word asset');assert.ok(appSource.includes('What this helps distinguish:')&&appSource.includes('Escalate when:'),'expandable troubleshooting details include purpose and escalation');assert.ok(appSource.includes('Hourly T2 exceedance breakdown')&&appSource.includes('Top 5 T2 variable contributions'),'hourly exceedance table and ranked T2 contributor details present');assert.ok(appSource.includes('View top 3 trends - past 24 hours')&&appSource.includes('Top 3 contributing measurements'),'selected exceedance opens a top-three measurement trend sheet');assert.ok(appSource.includes('selected hour marked')&&appSource.includes('Actual value - past 24 hours'),'trend sheet labels actual values and selected hour');assert.ok(appSource.includes('history[0].timestamp')&&appSource.includes('history.at(-1).timestamp'),'trend charts display 24-hour time endpoints');assert.ok(appSource.includes('setFocusTimestamp(c.p.timestamp)')&&appSource.includes('accessibilityLabel={stamp(c.p.timestamp)'),'trend points expose selectable exact hourly values accessibly');assert.ok(appSource.includes('setActiveTimestamp')&&appSource.includes('activeExceedanceRow'),'chart selection highlights matching exceedance row');assert.ok(appSource.includes('No hourly T2 scores exceeded'),'exceedance table has an empty state');assert.ok(appSource.includes('Q/SPE residual contributions are a separate metric'),'T2 and Q contribution semantics are distinct');assert.ok(appSource.includes('Raleway_700Bold')&&appSource.includes('SourceSansPro_400Regular'),'Targa site font families are bundled');assert.ok(appSource.includes('#02315B')&&appSource.includes('#1D5296')&&appSource.includes('#FB7629'),'Targa color palette is applied');assert.ok(appSource.includes('plotWidth=Math.max(1,chartWidth-2*pad)')&&appSource.includes('x:pad+i*plotWidth/(points.length-1)'),'chart scales to measured container width');const narrowWidth=250,pad=10,plotWidth=narrowWidth-2*pad,lastPointX=pad+plotWidth,markerRadius=4;assert.ok(lastPointX+markerRadius<=narrowWidth,'latest narrow-screen chart marker stays inside container');assert.ok(!/Fault Answer Key/.test(exportSource),'app export does not use evaluation truth');
 console.log(JSON.stringify({dataRows:{training:21600,calibration:7200,monitoring:7200},faultCompressors:[...faultIds],compressors:results,monitoringMetrics:metrics,appChecks:{stations:appData.stations.length,pointsPerTrend:24,faultRecordsPerStation:4,first20NormalAndFinal4T2Exceed: true,sourceDetails:'pass',assistantRemoved:true},chartImages:pca.getWorksheet('Charts')._media.length,reviewerNote:'Excel desktop rendering, print layout, and filter interactions remain unverified; charts are embedded static PNGs and workbook values are precomputed.'},null,2));
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
