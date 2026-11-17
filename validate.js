const ExcelJS = require('exceljs');
const assert = require('node:assert/strict');
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
 const guide=new ExcelJS.Workbook(); await guide.xlsx.readFile('outputs/Troubleshooting.xlsx'); assert.equal(guide.worksheets.length,12,'start/index plus 10 equipment sheets');assert.ok(guide.getWorksheet('Section Index').autoFilter,'troubleshooting index filter');for(const id of ids)assert.ok(guide.getWorksheet(id).autoFilter,id+' troubleshooting filter');
 assert.equal(pca.getWorksheet('Charts')._media.length,3,'fleet chart and two fault charts embedded');
 assert.ok(pca.getWorksheet('Validation Report').getSheetValues().flat().some(v=>typeof v==='string'&&v.includes('36,000 T2/Q scores')),'independent reviewer validation documented');
 const badText=['T'+String.fromCharCode(194,178),String.fromCharCode(226,8364,8221),String.fromCharCode(195,8212)];
 for(const wb of [data,pca,guide])for(const ws of wb.worksheets)ws.eachRow(row=>row.eachCell(cell=>{if(typeof cell.value==='string')for(const token of badText)assert.ok(!cell.value.includes(token),ws.name+' contains mojibake');}));
 console.log(JSON.stringify({dataRows:{training:21600,calibration:7200,monitoring:7200},faultCompressors:[...faultIds],compressors:results,monitoringMetrics:metrics,chartImages:pca.getWorksheet('Charts')._media.length,reviewerNote:'Excel desktop rendering, print layout, and filter interactions remain unverified; charts are embedded static PNGs and workbook values are precomputed.'},null,2));
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
