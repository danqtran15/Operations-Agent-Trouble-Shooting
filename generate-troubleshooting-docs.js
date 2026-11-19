const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, ExternalHyperlink } = require('docx');
const { tags, references, revision, compressors } = require('./troubleshooting-content');

const outputDir = path.join(__dirname, 'references');
const sectionId = (compressor, tag) => `${compressor}-${tag.code}-01`;
const urlRun = (url) => new ExternalHyperlink({ link: url, children: [new TextRun({ text: url, style: 'Hyperlink' })] });

async function makeDocument(compressor) {
  const children = [
    new Paragraph({ text: `${compressor} Troubleshooting Reference`, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `${compressor} · Revision ${revision}`, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: 'Status: synthetic demonstration material. This is not an approved operating procedure, controlled PSM document, or site-specific instruction.', bold: true, color: 'A33A2B' })] }),
    new Paragraph({ text: 'Use and limits', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('This reference provides diagnostic checks for reviewing a model alert. It does not establish a root cause, operating envelope, alarm/trip limit, required action, calibration tolerance, or safe condition. Follow current site procedures and equipment-specific manuals. The project does not identify installed transmitter, meter, compressor, driver, or protection-system models.'),
    new Paragraph({ text: 'Immediate response', heading: HeadingLevel.HEADING_1 }),
    new Paragraph('If an existing site alarm, trip, suspected loss of containment, carryover, abnormal vibration, or other unsafe condition occurs, follow the applicable approved site response immediately. Do not delay an urgent response to perform these diagnostic checks.'),
    new Paragraph({ text: 'Troubleshooting sections', heading: HeadingLevel.HEADING_1 })
  ];
  for (const tag of tags) {
    const id = sectionId(compressor, tag);
    children.push(new Paragraph({ text: `${id} — ${tag.name} (${tag.unit})`, heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ children: [new TextRun({ text: 'Summary: ', bold: true }), new TextRun(tag.summary)] }));
    tag.steps.forEach((step, index) => {
      children.push(new Paragraph({ text: `${index + 1}. ${step.action}` }));
      children.push(new Paragraph({ children: [new TextRun({ text: 'What this helps distinguish: ', bold: true }), new TextRun(step.distinguishes)], indent: { left: 360 } }));
      children.push(new Paragraph({ children: [new TextRun({ text: 'Escalate when: ', bold: true }), new TextRun(step.escalate)], indent: { left: 360 } }));
    });
    children.push(new Paragraph({ text: `Cited sources for ${id}`, heading: HeadingLevel.HEADING_3 }));
    for (const refId of tag.sources) {
      const ref = references[refId];
      children.push(new Paragraph({ children: [new TextRun({ text: `${ref.publisher}. ${ref.title}. ` }), urlRun(ref.url), new TextRun({ text: ` Applicability: ${ref.note}` })] }));
    }
  }
  children.push(new Paragraph({ text: 'General reference notes', heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph('Manufacturer manuals are examples of authoritative equipment references, but the installed model and configuration must be matched before use. NIST material concerns measurement traceability; it does not prescribe site tolerances or intervals. OSHA PSM requirements apply according to the covered process and employer program; this demo is not a substitute for required site procedures or training.'));
  const doc = new Document({
    creator: 'Station Pulse demonstration', title: `${compressor} Demonstration Troubleshooting Reference`, subject: 'Synthetic troubleshooting guidance with references',
    styles: { default: { document: { run: { font: 'Arial', size: 22, color: '172538' }, paragraph: { spacing: { after: 140, line: 288 } } } } },
    sections: [{ properties: {}, children }]
  });
  const target = path.join(outputDir, `${compressor}.docx`);
  fs.writeFileSync(target, await Packer.toBuffer(doc));
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const compressor of compressors) await makeDocument(compressor);
  console.log(`Generated ${compressors.length} Word references in ${outputDir}`);
}
main().catch(error => { console.error(error); process.exit(1); });
