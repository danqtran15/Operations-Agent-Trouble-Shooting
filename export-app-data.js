const ExcelJS = require('exceljs');
const fs = require('fs');
const { tags, revision, compressors } = require('./troubleshooting-content');
const tagKeys = ['Throughput_MMSCFD', 'Suction_Pressure_psig', 'Discharge_Pressure_psig', 'RPM', 'Slug_Catcher_Level_pct'];

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('outputs/PCA_Results.xlsx');
  const stations = [];
  for (const id of compressors) {
    const ws = wb.getWorksheet(id);
    let latest = null;
    const trend = [];
    for (let r = 13; r <= ws.rowCount; r++) {
      if (ws.getCell(r, 2).value !== 'monitoring') continue;
      const item = {
        timestamp: ws.getCell(r, 1).value.toISOString(),
        values: tags.map((_, j) => ws.getCell(r, 3 + j).value),
        contrib: tags.map((_, j) => ws.getCell(r, 8 + j).value),
        t2: ws.getCell(r, 13).value, t2Limit: ws.getCell(r, 14).value,
        q: ws.getCell(r, 15).value, qLimit: ws.getCell(r, 16).value,
        t2Contrib: tags.map((_, j) => ws.getCell(r, 19 + j).value)
      };
      latest = item; trend.push(item);
    }
    const ranking = latest.contrib.map((value, j) => {
      const tag = tags[j], sectionId = `${id}-${tag.code}-01`;
      return {
        j, value, tag: tagKeys[j], name: tag.name, unit: tag.unit, sectionId,
        summary: tag.summary, steps: tag.steps,
        source: {
          title: `${id} Demonstration Troubleshooting Reference`, revision, sectionId,
          status: 'Synthetic demonstration document', document: `references/${id}.docx`,
          sources: tag.sources
        }
      };
    }).sort((a, b) => b.value - a.value);
    stations.push({
      id, timestamp: latest.timestamp,
      values: tags.map((tag, j) => ({ tag: tagKeys[j], label: tag.name, unit: tag.unit, value: latest.values[j] })),
      t2: latest.t2, t2Limit: latest.t2Limit, q: latest.q, qLimit: latest.qLimit,
      alert: latest.t2 > latest.t2Limit || latest.q > latest.qLimit,
      contributors: ranking.slice(0, 3),
      trend: trend.slice(-24).map(x => { const absTotal=x.t2Contrib.reduce((sum,v)=>sum+Math.abs(v),0)||1;const t2Contributions=x.t2Contrib.map((signed,j)=>({rank:0,tag:tags[j].name,tagKey:tagKeys[j],unit:tags[j].unit,value:x.values[j],signed,magnitude:Math.abs(signed),share:Math.abs(signed)/absTotal})).sort((a,b)=>b.magnitude-a.magnitude).map((v,i)=>({...v,rank:i+1}));return {timestamp:x.timestamp,t2:x.t2,t2Limit:x.t2Limit,q:x.q,qLimit:x.qLimit,t2Contributions};})
    });
  }
  fs.mkdirSync('web/data', { recursive: true });
  fs.writeFileSync('web/data/stations.json', JSON.stringify({ generatedFrom: 'PCA_Results.xlsx', synthetic: true, stations }, null, 2));
  console.log(`Exported ${stations.length} model-based station snapshots (answer key not opened).`);
}
main().catch(error => { console.error(error); process.exit(1); });
